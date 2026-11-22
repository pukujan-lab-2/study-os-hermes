"""Asking, marking, reviewing, explaining back, and the streak."""

from __future__ import annotations

import difflib
import json
import re
from datetime import datetime, timedelta, timezone

from . import llm, prompts
from .courses import Problem
from .mastery import apply_answer, difficulty_for, is_mastered, mastery, pick, shown, started
from .store import db, loads, new_id, now, row, rows


def next_question(*, course_id: str | None = None, section_id: str | None = None, asked: list[str] | None = None, due_only: bool = False) -> dict | None:
    done = set(asked or [])
    where, args = [], []
    if course_id:
        where.append("o.course_id = ?")
        args.append(course_id)
    if section_id:
        where.append("o.section_id = ?")
        args.append(section_id)
    if due_only:
        where.append("o.next_review is not null and o.next_review <= ?")
        args.append(now())
    objs = rows("select o.*, c.title course from objectives o join courses c on c.id = o.course_id" + (" where " + " and ".join(where) if where else ""), *args)
    if not objs:
        return None
    qs: dict[str, list[dict]] = {}
    for q in rows(f"select q.*, (select max(a.created_at) from attempts a where a.question_id = q.id) last from questions q where objective_id in ({','.join('?' * len(objs))})", *[o["id"] for o in objs]):
        qs.setdefault(q["objective_id"], []).append(q)
    for o in objs:
        o["question_ids"] = [q["id"] for q in qs.get(o["id"], [])]
    o = pick(objs, done, now())
    if not o:
        return None
    order = difficulty_for(mastery(o["alpha"], o["beta"]))
    q = min((q for q in qs[o["id"]] if q["id"] not in done), key=lambda q: (q["last"] or "", order.index(q["difficulty"])) if q["last"] else ("", order.index(q["difficulty"])))
    return public(q, o)


def public(q: dict, o: dict) -> dict:
    """A question without its answer."""
    return {
        "id": q["id"], "kind": q["kind"], "difficulty": q["difficulty"], "prompt": q["prompt"], "goal": o["label"], "course": o.get("course"), "course_id": o["course_id"], "section_id": o["section_id"],
        "options": [x["text"] for x in loads(q["options"], [])] if q["options"] else None, "has_hint": bool(q["hint"]), "mastery": shown(o["alpha"], o["beta"]),
    }


def hint(question_id: str) -> str:
    q = row("select hint from questions where id = ?", question_id)
    return (q or {}).get("hint") or "No hint for this one. Think about what the lesson said first."


def _norm(s: str) -> str:
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower())
    return re.sub(r"\s+", " ", re.sub(r"\b(a|an|the)\b", " ", s)).strip()


def blank_right(answer: str, said: str) -> bool:
    a, s = _norm(answer), _norm(said)
    if not s:
        return False
    if a == s or a.rstrip("s") == s.rstrip("s"):
        return True
    return len(a) > 4 and difflib.SequenceMatcher(None, a, s).ratio() >= 0.86  # a slip of the keyboard


def answer(question_id: str, *, option: int | None = None, text: str | None = None, tries: int = 1, hints: int = 0, give_up: bool = False) -> dict:
    q = row("select q.*, o.alpha, o.beta, o.streak, o.course_id, o.label from questions q join objectives o on o.id = q.objective_id where q.id = ?", question_id)
    if not q:
        raise Problem("That question isn't here any more.")
    opts = loads(q["options"], [])
    why, right = "", False
    if not give_up:
        if q["kind"] == "choice":
            if option is None or not 0 <= option < len(opts):
                raise Problem("Pick one of the options.")
            right, why = opts[option]["correct"], opts[option]["why"]
        else:
            if not (text or "").strip():
                raise Problem("Type an answer first.")
            right = blank_right(q["answer"], text or "")
    tries = max(1, min(int(tries), 5))
    if not right and not give_up and tries < 2:
        return {"correct": False, "final": False, "why": why or "Not that. Have another go."}
    before = shown(q["alpha"], q["beta"])
    at = datetime.now(timezone.utc)
    st = apply_answer({"alpha": q["alpha"], "beta": q["beta"], "streak": q["streak"]}, score=1.0 if right else 0.0, difficulty=q["difficulty"], tries=tries, hints=max(0, int(hints)), gave_up=give_up, now=at)
    with db() as c:
        c.execute("update objectives set alpha = ?, beta = ?, streak = ?, next_review = ? where id = ?", (st["alpha"], st["beta"], st["streak"], st["next_review"], q["objective_id"]))
        c.execute("insert into attempts (id, question_id, objective_id, score, tries, hints, created_at) values (?,?,?,?,?,?,?)", (new_id(), question_id, q["objective_id"], 1.0 if right else 0.0, tries, max(0, int(hints)), now()))
    return {
        "correct": right, "final": True, "why": why, "answer": q["answer"], "answer_index": next((i for i, o in enumerate(opts) if o["correct"]), None), "explanation": q["explanation"], "goal": q["label"],
        "mastery_before": before, "mastery_after": shown(st["alpha"], st["beta"]), "mastered": is_mastered(st["alpha"], st["beta"]), "next_review": st["next_review"],
    }


def explain_back(section_id: str, text: str, authorship=None) -> dict:
    """Grades an explanation in the learner's own words and moves their mastery. `authorship(text)` may say how it reads."""
    text = text.strip()[:6000]
    if len(text.split()) < 8:
        raise Problem("Say a little more: two or three sentences in your own words.")
    s = row("select * from sections where id = ?", section_id)
    if not s or not s["body"]:
        raise Problem("That section isn't written yet.")
    goals = rows("select * from objectives where section_id = ?", section_id)
    listed = "\n".join(f"{i + 1}. {g['label']}" for i, g in enumerate(goals))
    out = llm.data(prompts.GRADE, f"<lesson title=\"{s['title']}\">\n{s['body']}\n</lesson>\n\nGoals:\n{listed}\n\n<explanation>\n{text}\n</explanation>", prompts.GRADE_SCHEMA, purpose="grade", max_tokens=5000)
    scores = {int(g["number"]): max(0.0, min(1.0, float(g["score"]))) for g in out["goals"] if 1 <= int(g.get("number", 0)) <= len(goals)}
    verdict, note = None, None
    if authorship:
        try:
            verdict = authorship(text)
        except Exception as err:  # noqa: BLE001 - the check is a signal; grading never depends on it
            note = str(err)[:160]
    at = datetime.now(timezone.utc)
    overall = round(sum(scores.values()) / len(goals), 3) if goals else 0.0
    fb = {"got": out["got"][:5], "missing": out["missing"][:5], "next_question": out["next_question"], "goals": [{"label": g["label"], "score": scores.get(i + 1)} for i, g in enumerate(goals)]}
    with db() as c:
        for i, g in enumerate(goals):
            if i + 1 not in scores:
                continue
            # A goal the learner didn't mention isn't evidence they can't do it.
            if scores[i + 1] == 0:
                continue
            st = apply_answer({"alpha": g["alpha"], "beta": g["beta"], "streak": g["streak"]}, score=scores[i + 1], difficulty="apply", now=at)
            c.execute("update objectives set alpha = ?, beta = ?, streak = ?, next_review = ? where id = ?", (st["alpha"], st["beta"], st["streak"], st["next_review"], g["id"]))
            c.execute("insert into attempts (id, objective_id, score, tries, hints, created_at) values (?,?,?,1,0,?)", (new_id(), g["id"], scores[i + 1], now()))
        c.execute("insert into explanations (id, section_id, text, score, feedback, authorship, created_at) values (?,?,?,?,?,?,?)", (new_id(), section_id, text, overall, json.dumps(fb), json.dumps(verdict) if verdict else None, now()))
    return {"score": overall, **fb, "authorship": verdict, "authorship_note": note}


def streak(today: datetime | None = None) -> dict:
    """Days in a row with an answer, by this computer's clock. Today not done yet doesn't break it."""
    tz = datetime.now().astimezone().tzinfo
    today = (today or datetime.now(timezone.utc)).astimezone(tz)
    days = {datetime.fromisoformat(r["created_at"]).astimezone(tz).date() for r in rows("select created_at from attempts")}
    d = today.date()
    done_today = d in days
    if not done_today:
        d -= timedelta(days=1)
    n = 0
    while d in days:
        n += 1
        d -= timedelta(days=1)
    week = [{"day": (today.date() - timedelta(days=i)).strftime("%a"), "done": (today.date() - timedelta(days=i)) in days} for i in range(6, -1, -1)]
    return {"days": n, "today": done_today, "week": week}


def progress() -> dict:
    """Everything, by course: what's known, being learned, not started, and due."""
    t = now()
    out = []
    for c in rows("select id, title, subject from courses where status in ('ready','writing') order by coalesce(opened_at, created_at) desc"):
        goals = []
        for o in rows("select o.*, s.title section from objectives o join sections s on s.id = o.section_id where o.course_id = ? order by s.pos, o.rowid", c["id"]):
            st = started(o["alpha"], o["beta"])
            goals.append({"id": o["id"], "label": o["label"], "section": o["section"], "section_id": o["section_id"], "mastery": shown(o["alpha"], o["beta"]), "state": "mastered" if is_mastered(o["alpha"], o["beta"]) else "learning" if st else "new", "due": bool(o["next_review"]) and o["next_review"] <= t})
        if goals:
            out.append({**c, "goals": goals})
    return {"courses": out, "due": sum(g["due"] for c in out for g in c["goals"])}
