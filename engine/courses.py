"""Making a course: plan it, write each section, then its quiz. Work happens in background threads, is saved after
every step, and picks up where it stopped if Hermes was closed."""

from __future__ import annotations

import contextvars
import json
import os
import re
import threading
from datetime import datetime, timedelta, timezone

from . import llm, prompts, store
from .mastery import is_mastered, shown, started
from .store import db, loads, new_id, now, row, rows, run

def background(fn, *args) -> threading.Thread:
    """A thread that keeps Hermes' context, so it stays in the profile that asked."""
    t = threading.Thread(target=contextvars.copy_context().run, args=(fn, *args), name="study-os-solo", daemon=True)
    t.start()
    return t


OWNER = f"{os.getpid()}-{new_id()}"
STALE_SECONDS = 75
MAX_PARTS = 12
PART_CHARS = 5500


class Problem(Exception):
    """Something to show the learner."""


# ---- splitting material ------------------------------------------------------------------------------

def split_material(text: str) -> list[str]:
    """Material in parts of about a page or two, cut at headings where there are any, else between paragraphs."""
    text = re.sub(r"\n{3,}", "\n\n", text.replace("\r", "")).strip()
    blocks = re.split(r"\n(?=#{1,3} )", text) if re.search(r"^#{1,3} ", text, flags=re.M) else [text]
    parts: list[str] = []
    for b in blocks:
        while len(b) > PART_CHARS:
            cut = max(b.rfind("\n\n", 0, PART_CHARS), b.rfind(". ", 0, PART_CHARS) + 1)
            cut = cut if cut > PART_CHARS // 3 else PART_CHARS
            parts.append(b[:cut].strip())
            b = b[cut:]
        if b.strip():
            parts.append(b.strip())
    merged: list[str] = []
    for p in parts:  # small neighbours belong together
        if merged and len(merged[-1]) + len(p) < PART_CHARS * 0.6:
            merged[-1] += "\n\n" + p
        else:
            merged.append(p)
    return merged


# ---- making one --------------------------------------------------------------------------------------

def how_of(course: dict, extra: dict | None = None) -> dict:
    return {"level": course["level"], "story": course["story"] or "plain", "compare_to": course["compare_to"] or "", "ask": "", **(extra or {})}


def clean_how(x: dict | None, base: dict) -> dict:
    x = x or {}
    level = x.get("level", base["level"])
    story = x.get("story", base["story"])
    return {
        "level": level if level in prompts.LEVELS else base["level"],
        "story": story if story in prompts.STORIES else "plain",
        "compare_to": re.sub(r"\s+", " ", str(x.get("compare_to", base["compare_to"]) or "")).strip()[:40],
        "ask": re.sub(r"\s+", " ", str(x.get("ask", "") or "")).strip()[:240],
    }


def create(*, topic: str | None = None, material: str | None = None, name: str | None = None, how: dict | None = None) -> str:
    topic = re.sub(r"\s+", " ", topic or "").strip()[:200]
    material = (material or "").strip()
    if not topic and len(material) < 200:
        raise Problem("Say what you want to learn, or add at least a paragraph of material.")
    p = store.get_prefs()
    h = clean_how(how, {"level": p["level"], "story": p["story"], "compare_to": p["compare_to"]})
    cid = new_id()
    with db() as c:
        c.execute(
            "insert into courses (id, title, level, story, compare_to, source_kind, source_name, created_at) values (?,?,?,?,?,?,?,?)",
            (cid, topic or name or "Your material", h["level"], h["story"], h["compare_to"], "material" if material else "topic", name, now()),
        )
        for i, part in enumerate(split_material(material)[:MAX_PARTS] if material else []):
            c.execute("insert into sections (id, course_id, pos, title, source) values (?,?,?,?,?)", (new_id(), cid, i, f"Part {i + 1}", part))
    start(cid)
    return cid


def start(course_id: str) -> bool:
    """Builds in the background, unless something is already building it."""
    old = (datetime.now(timezone.utc) - timedelta(seconds=STALE_SECONDS)).isoformat(timespec="seconds")
    if not run("update courses set owner = ?, heartbeat = ? where id = ? and status in ('planning','writing') and (owner is null or heartbeat < ?)", OWNER, now(), course_id, old):
        return False
    background(_build, course_id)
    return True


def resume_stopped() -> None:
    """Courses left half made by a closed app."""
    for c in rows("select id from courses where status in ('planning','writing')"):
        start(c["id"])


def retry(course_id: str) -> None:
    run("update sections set status = 'waiting', error = null where course_id = ? and status = 'failed'", course_id)
    n = row("select count(*) n from sections where course_id = ? and body is not null", course_id)
    run("update courses set status = ?, error = null, owner = null where id = ?", "writing" if n and n["n"] else "planning", course_id)
    start(course_id)


def _build(course_id: str) -> None:
    done = threading.Event()

    def beat():
        while not done.wait(15):
            run("update courses set heartbeat = ? where id = ? and owner = ?", now(), course_id, OWNER)

    background(beat)
    try:
        course = row("select * from courses where id = ?", course_id)
        if course and course["status"] == "planning":
            _plan(course)
        _write_all(course_id)
        left = row("select count(*) n from sections where course_id = ? and status = 'failed'", course_id)["n"]
        ready = row("select count(*) n from sections where course_id = ? and status = 'ready'", course_id)["n"]
        run("update courses set status = ?, error = ? where id = ?", "ready" if ready else "failed", f"{left} of {left + ready} sections couldn't be written." if left else None, course_id)
    except Exception as err:  # noqa: BLE001 - shown on the course
        run("update courses set status = 'failed', error = ? where id = ?", str(err)[:300], course_id)
    finally:
        done.set()
        run("update courses set owner = null where id = ? and owner = ?", course_id, OWNER)
        _changed(course_id)


def _plan(course: dict) -> None:
    parts = rows("select id, pos, source from sections where course_id = ? order by pos", course["id"])
    who = f"Learner: {prompts.LEVELS.get(course['level'], 'Grade 10')}"
    if parts:
        listed = "\n\n".join(f"<part number=\"{p['pos'] + 1}\">\n{p['source'][:1600]}\n</part>" for p in parts)
        plan = llm.data(prompts.PLAN_SOURCE, f"{who}\n\n{listed}", prompts.PLAN_SCHEMA, purpose="plan")
        named = {int(s.get("number") or i + 1): s for i, s in enumerate(plan["sections"])}
        with db() as c:
            for p in parts:
                s = named.get(p["pos"] + 1)
                if s and s.get("skip") and len(parts) > 1:
                    c.execute("delete from sections where id = ?", (p["id"],))
                elif s:
                    c.execute("update sections set title = ?, goal = ? where id = ?", (s["title"][:120], s["goal"][:300], p["id"]))
            if not c.execute("select 1 from sections where course_id = ?", (course["id"],)).fetchone():
                raise Problem("There was nothing to teach in that material.")
    else:
        plan = llm.data(prompts.PLAN, f"{who}\nThey want to learn: {course['title']}", prompts.PLAN_SCHEMA, purpose="plan")
        if not plan["sections"]:
            raise Problem("The model couldn't plan that. Try saying it another way.")
        with db() as c:
            for i, s in enumerate(plan["sections"][:6]):
                c.execute("insert into sections (id, course_id, pos, title, goal) values (?,?,?,?,?)", (new_id(), course["id"], i, s["title"][:120], s["goal"][:300]))
    run("update courses set title = ?, subject = ?, summary = ?, status = 'writing' where id = ?", plan["title"][:120], plan["subject"][:80], plan["summary"][:400], course["id"])
    _changed(course["id"])


def _write_all(course_id: str) -> None:
    todo = [s["id"] for s in rows("select id from sections where course_id = ? and status != 'ready' order by pos", course_id)]
    lock = threading.Lock()

    def lane():
        while True:
            with lock:
                if not todo:
                    return
                sid = todo.pop(0)
            try:
                _write_one(course_id, sid)
            except Exception as err:  # noqa: BLE001 - one section failing leaves the others readable
                run("update sections set status = 'failed', error = ? where id = ?", str(err)[:300], sid)
            _changed(course_id)

    for t in [background(lane) for _ in range(2)]:
        t.join()


def _write_one(course_id: str, sid: str) -> None:
    course, s = row("select * from courses where id = ?", course_id), row("select * from sections where id = ?", sid)
    if not course or not s:
        return
    run("update sections set status = 'writing' where id = ?", sid)
    _changed(course_id)
    how = how_of(course)
    body = s["body"]
    if not body:
        body = clean_lesson(llm.text(prompts.LESSON, _lesson_input(course, s, how)), how["compare_to"])
        run("update sections set body = ? where id = ?", body, sid)
    if not row("select 1 from objectives where section_id = ?", sid):
        quiz = llm.data(prompts.QUIZ, f"{prompts.learner(how)}\n\n<lesson title=\"{s['title']}\">\n{body}\n</lesson>", prompts.QUIZ_SCHEMA, purpose="quiz")
        save_quiz(course_id, sid, quiz)
    run("update sections set status = 'ready', error = null where id = ?", sid)


def _lesson_input(course: dict, s: dict, how: dict) -> str:
    outline = "\n".join(f"{x['pos'] + 1}. {x['title']}" for x in rows("select pos, title from sections where course_id = ? order by pos", course["id"]))
    src = f"\n<source>\n{s['source']}\n</source>" if s["source"] else ""
    return f"{prompts.learner(how)}\n\nCourse: {course['title']}\n{outline}\n\nSection to write: {s['title']}\nGoal: {s['goal'] or ''}{src}"


def clean_lesson(md: str, compare_to: str) -> str:
    """What the rules say whatever the model wrote: no top heading, no comparison nobody asked for, at most one."""
    md = re.sub(r"^\s*#{1,2} .*\n+", "", md.strip())
    out, kept, dropping = [], 0, False
    for line in md.split("\n"):
        if re.match(r"^>\s*\*\*Compare it to", line, flags=re.I):
            dropping = not compare_to or kept > 0
            kept += 0 if dropping else 1
        elif not line.startswith(">"):
            dropping = False
        if not dropping:
            out.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()


def clean_question(q: dict) -> dict | None:
    """A question in the shape the quiz needs, or None when it can't be marked fairly."""
    prompt, kind = str(q.get("prompt", "")).strip(), q.get("kind")
    diff = q.get("difficulty") if q.get("difficulty") in ("recall", "understand", "apply") else "understand"
    if not prompt:
        return None
    if kind == "choice":
        opts = [{"text": str(o.get("text", "")).strip(), "correct": bool(o.get("correct")), "why": str(o.get("why", "")).strip()} for o in q.get("options") or [] if isinstance(o, dict)]
        texts = [o["text"].lower() for o in opts]
        if len(opts) < 3 or not all(texts) or len(set(texts)) != len(texts) or sum(o["correct"] for o in opts) != 1:
            return None
        answer = next(o["text"] for o in opts if o["correct"])
    else:
        kind, opts, answer = "blank", None, str(q.get("answer", "")).strip()
        if not answer or len(answer.split()) > 4 or "__" not in prompt:
            return None
    return {"kind": kind, "difficulty": diff, "prompt": prompt, "options": opts, "answer": answer, "hint": str(q.get("hint", "")).strip(), "explanation": str(q.get("explanation", "")).strip()}


def clean_visual(v) -> dict | None:
    if not isinstance(v, dict) or v.get("kind") not in ("flow", "cycle", "compare", "parts"):
        return None
    items = [
        {"label": str(i.get("label", "")).strip()[:60], "points": [str(p).strip()[:120] for p in (i.get("points") or []) if str(p).strip()][:4]}
        for i in v.get("items") or []
        if isinstance(i, dict) and str(i.get("label", "")).strip()
    ][:6]
    return {"kind": v["kind"], "title": str(v.get("title", "")).strip()[:100], "items": items} if len(items) >= 2 else None


def save_quiz(course_id: str, sid: str, quiz: dict) -> None:
    import random

    n = 0
    with db() as c:
        for o in quiz.get("objectives") or []:
            qs = [x for x in (clean_question(q) for q in o.get("questions") or []) if x]
            if not qs or not str(o.get("label", "")).strip():
                continue
            oid = new_id()
            c.execute("insert into objectives (id, course_id, section_id, label) values (?,?,?,?)", (oid, course_id, sid, str(o["label"]).strip()[:200]))
            for q in qs:
                if q["options"]:
                    random.shuffle(q["options"])  # models like to put the right one in the same place
                c.execute(
                    "insert into questions (id, objective_id, section_id, kind, difficulty, prompt, options, answer, hint, explanation) values (?,?,?,?,?,?,?,?,?,?)",
                    (new_id(), oid, sid, q["kind"], q["difficulty"], q["prompt"], json.dumps(q["options"]) if q["options"] else None, q["answer"], q["hint"], q["explanation"]),
                )
                n += 1
        if not n:
            raise Problem("The quiz came back without a single usable question.")
        terms = [{"term": str(t.get("term", "")).strip(), "definition": str(t.get("definition", "")).strip()} for t in quiz.get("terms") or [] if isinstance(t, dict) and t.get("term")][:6]
        v = clean_visual(quiz.get("visual"))
        c.execute("update sections set terms = ?, visual = ? where id = ?", (json.dumps(terms), json.dumps(v) if v else None, sid))


def _changed(course_id: str) -> None:
    """Tells an open Study OS page to look again."""
    try:
        from hermes_cli.plugin_events import broadcast_plugin_event  # type: ignore

        broadcast_plugin_event(store.PLUGIN, "course.changed", {"id": course_id})
    except Exception:  # noqa: BLE001 - the page also polls
        pass


# ---- changing how a section is explained --------------------------------------------------------------

def preview(section_id: str, how: dict) -> None:
    s = row("select s.*, c.level, c.story, c.compare_to from sections s join courses c on c.id = s.course_id where s.id = ?", section_id)
    if not s or not s["body"]:
        raise Problem("That section isn't written yet.")
    h = clean_how(how, how_of(s))
    if not run("update sections set draft_status = 'writing', draft_error = null where id = ? and coalesce(draft_status, '') != 'writing'", section_id):
        return

    def work():
        try:
            goals = "\n".join(f"- {o['label']}" for o in rows("select label from objectives where section_id = ?", section_id))
            course = row("select * from courses where id = ?", s["course_id"])
            user = f"{_lesson_input(course, s, h)}\n\nGoals it must teach:\n{goals}\n\n<current_wording>\n{s['body']}\n</current_wording>"
            body = clean_lesson(llm.text(f"{prompts.LESSON}\n\n{prompts.REWORD}", user, purpose="reword"), h["compare_to"])
            with db() as c:
                c.execute("delete from versions where section_id = ? and status = 'draft'", (section_id,))
                c.execute("insert into versions (id, section_id, status, body, terms, visual, how, created_at) values (?,?,?,?,?,?,?,?)", (new_id(), section_id, "draft", body, s["terms"], s["visual"], json.dumps(h), now()))
                c.execute("update sections set draft_status = null where id = ?", (section_id,))
        except Exception as err:  # noqa: BLE001
            run("update sections set draft_status = null, draft_error = ? where id = ?", str(err)[:300], section_id)
        _changed(s["course_id"])

    background(work)


def use_version(section_id: str, version_id: str | None = None) -> None:
    """Puts a preview (or an earlier wording) in place and keeps the one it replaces."""
    v = row("select * from versions where section_id = ? and " + ("id = ?" if version_id else "status = ?"), section_id, version_id or "draft")
    s = row("select s.*, c.level, c.story, c.compare_to from sections s join courses c on c.id = s.course_id where s.id = ?", section_id)
    if not v or not s:
        raise Problem("That wording isn't there any more.")
    with db() as c:
        c.execute("insert into versions (id, section_id, status, body, terms, visual, how, created_at) values (?,?,?,?,?,?,?,?)", (new_id(), section_id, "earlier", s["body"], s["terms"], s["visual"], s["how"] or json.dumps(how_of(s)), now()))
        c.execute("update sections set body = ?, terms = ?, visual = ?, how = ? where id = ?", (v["body"], v["terms"], v["visual"], v["how"], section_id))
        c.execute("delete from versions where id = ?", (v["id"],))
        c.execute("delete from versions where section_id = ? and status = 'earlier' and id not in (select id from versions where section_id = ? and status = 'earlier' order by created_at desc limit 6)", (section_id, section_id))


def discard(section_id: str) -> None:
    run("delete from versions where section_id = ? and status = 'draft'", section_id)


# ---- reading --------------------------------------------------------------------------------------------

def summary(c: dict) -> dict:
    secs = rows("select status, read_at from sections where course_id = ?", c["id"])
    objs = rows("select alpha, beta, next_review from objectives where course_id = ?", c["id"])
    t = now()
    return {
        "id": c["id"], "title": c["title"], "subject": c["subject"], "summary": c["summary"], "status": c["status"], "error": c["error"], "level": c["level"],
        "level_label": prompts.LEVELS.get(c["level"]), "story": c["story"], "compare_to": c["compare_to"], "source_kind": c["source_kind"], "source_name": c["source_name"],
        "sections": len(secs), "written": sum(s["status"] == "ready" for s in secs), "read": sum(bool(s["read_at"]) for s in secs),
        "goals": len(objs), "mastered": sum(is_mastered(o["alpha"], o["beta"]) for o in objs),
        "mastery": round(sum(shown(o["alpha"], o["beta"]) for o in objs) / len(objs), 3) if objs else 0,
        "due": sum(bool(o["next_review"]) and o["next_review"] <= t for o in objs),
        "created_at": c["created_at"], "opened_at": c["opened_at"],
    }


def list_courses() -> list[dict]:
    resume_stopped()
    return [summary(c) for c in rows("select * from courses order by coalesce(opened_at, created_at) desc")]


def get(course_id: str) -> dict:
    c = row("select * from courses where id = ?", course_id)
    if not c:
        raise Problem("That course isn't here any more.")
    if c["status"] in ("planning", "writing"):
        start(course_id)
    out = summary(c)
    goals: dict[str, list] = {}
    for o in rows("select * from objectives where course_id = ?", course_id):
        goals.setdefault(o["section_id"], []).append({"id": o["id"], "label": o["label"], "mastery": shown(o["alpha"], o["beta"]), "started": started(o["alpha"], o["beta"]), "mastered": is_mastered(o["alpha"], o["beta"]), "next_review": o["next_review"]})
    out["list"] = [
        {
            "id": s["id"], "title": s["title"], "goal": s["goal"], "status": s["status"], "error": s["error"], "body": s["body"], "terms": loads(s["terms"], []), "visual": loads(s["visual"], None),
            "how": loads(s["how"], how_of(c)), "read": bool(s["read_at"]), "from_material": bool(s["source"]), "goals": goals.get(s["id"], []),
        }
        for s in rows("select * from sections where course_id = ? order by pos", course_id)
    ]
    return out


def opened(course_id: str, section_id: str | None = None) -> None:
    run("update courses set opened_at = ? where id = ?", now(), course_id)
    if section_id:
        run("update sections set read_at = coalesce(read_at, ?) where id = ? and course_id = ?", now(), section_id, course_id)


def wordings(section_id: str) -> dict:
    s = row("select * from sections where id = ?", section_id)
    if not s:
        raise Problem("That section isn't here any more.")
    vs = rows("select * from versions where section_id = ? order by created_at desc", section_id)
    d = next((v for v in vs if v["status"] == "draft"), None)
    return {
        "writing": s["draft_status"] == "writing", "error": s["draft_error"],
        "draft": {"body": d["body"], "how": loads(d["how"], {})} if d else None,
        "earlier": [{"id": v["id"], "how": loads(v["how"], {}), "until": v["created_at"]} for v in vs if v["status"] == "earlier"],
    }


def delete(course_id: str) -> bool:
    return bool(run("delete from courses where id = ?", course_id))
