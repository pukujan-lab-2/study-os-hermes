"""Ways to watch and listen to a section: a two-host podcast, a one-minute recap, a quiz in your ear, and three videos
(explainer, Short, slides). The words come from your Hermes model; voice.py speaks them; film.py draws the videos."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

from . import film, llm, play, prompts, voice
from .courses import Problem, _changed, background
from .store import db, loads, new_id, now, row, rows, run

AUDIO = ("podcast", "recap")
VIDEO = ("explainer", "short", "slides")
HYPERFRAMES = "hyperframes@0.9.80"

_S = {"type": "string"}
TALK_SCHEMA = {"type": "object", "required": ["title", "turns"], "properties": {"title": _S, "turns": {"type": "array", "items": {"type": "object", "required": ["who", "text"], "properties": {"who": {"type": "string", "enum": ["a", "b"]}, "text": _S}}}}}
FILM_SCHEMA = {
    "type": "object", "required": ["title", "scenes"],
    "properties": {
        "title": _S,
        "scenes": {"type": "array", "items": {"type": "object", "required": ["kind", "heading", "say"], "properties": {
            "kind": {"type": "string", "enum": ["title", "points", "steps", "compare", "big", "question"]}, "heading": _S,
            "items": {"type": "array", "items": {"type": "object", "required": ["label"], "properties": {"label": _S, "note": _S}}}, "say": _S}}},
    },
}
PODCAST = f"""Write a short two-host audio lesson about one section. Host a explains; host b is curious, asks what a learner would ask, gets one thing slightly wrong and is kindly put right, and sums up at the end.
- 12 to 16 turns, each one to three spoken sentences. Open with the puzzle, not a welcome. No names, no music notes, no stage directions, no lists, no symbols that can't be read aloud.
- Teach only what the lesson teaches.
{prompts.HOUSE}"""
RECAP = f"""Write a one-minute spoken recap of one section: the question it answers, the idea, one example, and the line to remember. 5 to 7 turns, all by host a, one or two sentences each. Written to be heard. Teach only what the lesson teaches.
{prompts.HOUSE}"""
FILM = {
    "explainer": "a narrated explainer video of 6 to 8 scenes (about 80 seconds). Scene 1 is kind title. Include at least one steps or compare scene and one big scene, and end on a question to think about.",
    "short": "a vertical Short of 4 or 5 scenes, under 40 seconds in all. Scene 1 is kind question or big and hooks in three seconds with the surprising thing. Every say is one or two short sentences. The last scene pays the hook off.",
    "slides": "a deck of 6 to 8 slides someone clicks through, with speaker notes. Scene 1 is kind title. say is what a teacher would say on that slide, two to four sentences.",
}
FILM_RULES = f"""- kind: title (heading, one item as the subtitle), points (2 to 4 items), steps (2 to 5 items in order), compare (2 or 3 items side by side, each with a note), big (heading is one number or at most three words, plus one item explaining it), question (heading only).
- heading: at most 8 words. label: at most 6 words. note: at most 10 words. say: what the narrator says while it shows, never just reading the screen.
- Teach only what the lesson teaches.
{prompts.HOUSE}"""


def _section(section_id: str) -> dict:
    s = row("select s.*, c.title course, c.level, c.story, c.compare_to from sections s join courses c on c.id = s.course_id where s.id = ?", section_id)
    if not s or not s["body"]:
        raise Problem("That section isn't written yet.")
    return s


def _stamp(body: str) -> str:
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def listing(section_id: str) -> list[dict]:
    s = _section(section_id)
    out = []
    for m in rows("select * from media where section_id = ?", section_id):
        out.append({"kind": m["kind"], "status": m["status"], "error": m["error"], "data": _shown(m) if m["status"] == "ready" else None, "stale": m["made_from"] != _stamp(s["body"]), "export": {"status": m["export_status"], "error": m["export_error"], "file": m["export_file"]}})
    return out


def _shown(m: dict):
    d = loads(m["data"], None)
    if m["kind"] == "play" and d:
        return {"title": d["title"], "html": play.page(d["js"])} if d.get("js") else None
    return d


def make(section_id: str, kind: str) -> None:
    if kind not in (*AUDIO, *VIDEO, "play"):
        raise Problem("Unknown kind.")
    s = _section(section_id)
    with db() as c:
        if c.execute("select 1 from media where section_id = ? and kind = ? and status = 'making' and created_at > datetime('now', '-6 minutes')", (section_id, kind)).fetchone():
            return
        c.execute(
            "insert into media (id, section_id, kind, status, made_from, created_at) values (?,?,?,'making',?,datetime('now')) on conflict(section_id, kind) do update set status = 'making', error = null, made_from = excluded.made_from, created_at = excluded.created_at, export_status = null, export_error = null, export_file = null",
            (new_id(), section_id, kind, _stamp(s["body"])),
        )

    def work():
        try:
            data = _audio(s, kind) if kind in AUDIO else _film(s, kind) if kind in VIDEO else play.make(s, [o["label"] for o in rows("select label from objectives where section_id = ?", section_id)])
            run("update media set status = 'ready', data = ? where section_id = ? and kind = ?", json.dumps(data), section_id, kind)
        except Exception as err:  # noqa: BLE001
            run("update media set status = 'failed', error = ? where section_id = ? and kind = ?", str(err)[:300], section_id, kind)
        _changed(s["course_id"])

    background(work)


def fix_game(section_id: str, error: str) -> None:
    """One repair when a game stops with an error on the learner's screen."""
    m = row("select * from media where section_id = ? and kind = 'play' and status = 'ready'", section_id)
    d = loads(m["data"], {}) if m else {}
    if not d or d.get("fixed"):
        return
    run("update media set status = 'making', created_at = datetime('now') where id = ?", m["id"])
    course = _section(section_id)["course_id"]

    def work():
        try:
            run("update media set status = 'ready', data = ? where id = ?", json.dumps({**d, "js": play.fix(d["js"], error), "fixed": True}), m["id"])
        except Exception as err:  # noqa: BLE001
            run("update media set status = 'failed', error = ? where id = ?", str(err)[:300], m["id"])
        _changed(course)

    background(work)


def _lesson(s: dict) -> str:
    return f"{prompts.learner({'level': s['level'], 'story': 'plain', 'compare_to': ''})}\n\n<lesson course=\"{s['course']}\" title=\"{s['title']}\">\n{s['body']}\n</lesson>"


def _audio(s: dict, kind: str) -> dict:
    out = llm.data(PODCAST if kind == "podcast" else RECAP, _lesson(s), TALK_SCHEMA, purpose=kind)
    turns = [{"who": "b" if t.get("who") == "b" and kind == "podcast" else "a", "text": re.sub(r"\s+", " ", str(t.get("text", ""))).strip()[:700]} for t in out["turns"] if str(t.get("text", "")).strip()][:20]
    if len(turns) < 2:
        raise Problem("It came back too short. Try again.")
    if turns:
        voice.say(turns[0]["text"], turns[0]["who"])  # the first line is ready when they press play
    return {"title": out["title"][:120], "turns": turns}


def clean_scenes(raw: list, kind: str) -> list[dict]:
    out = []
    for x in raw[:8]:
        if not isinstance(x, dict) or not str(x.get("heading", "")).strip() or not str(x.get("say", "")).strip():
            continue
        items = [{"label": str(i.get("label", "")).strip()[:80], "note": str(i.get("note") or "").strip()[:110]} for i in x.get("items") or [] if isinstance(i, dict) and str(i.get("label", "")).strip()][:5]
        k = x.get("kind") if x.get("kind") in ("title", "points", "steps", "compare", "big", "question") else "points"
        if k in ("points", "steps", "compare") and not items:
            k = "question" if str(x["heading"]).strip().endswith("?") else "big" if len(str(x["heading"])) < 18 else "title"
        if k == "big" and len(str(x["heading"])) > 24:
            k = "title"
        out.append({"kind": k, "heading": str(x["heading"]).strip()[:90], "items": items, "say": re.sub(r"\s+", " ", str(x["say"])).strip()[:600]})
    return out


def _film(s: dict, kind: str) -> dict:
    out = llm.data(f"Turn one lesson section into {FILM[kind]}\n{FILM_RULES}", _lesson(s), FILM_SCHEMA, purpose=f"video-{kind}")
    scenes = clean_scenes(out["scenes"], kind)
    if len(scenes) < 3:
        raise Problem("The storyboard came back too short. Try again.")
    for i, x in enumerate(scenes):
        x["kicker"] = s["course"] if x["kind"] == "title" and i == 0 else ""
        wav = voice.say(x["say"], "a")
        x["spoken"] = round(voice.seconds_of(wav), 2) if wav else round(len(x["say"].split()) / 2.5, 2)
        x["has_sound"] = bool(wav)
        x["duration"] = round(max(3.0, x["spoken"] + 0.75), 2)
    return {"title": out["title"][:120] or s["title"], "format": kind, "seed": s["course_id"], "scenes": scenes}


def film_html(section_id: str, kind: str) -> dict:
    m = row("select * from media where section_id = ? and kind = ? and status = 'ready'", section_id, kind)
    if not m or kind not in VIDEO:
        raise Problem("That video isn't made yet.")
    f = loads(m["data"], {})
    w, h = film.SIZES[kind]
    return {"html": film.build(f), "width": w, "height": h, "duration": round(sum(x["duration"] for x in f["scenes"]), 2), "scenes": [{"say": x["say"], "duration": x["duration"], "spoken": x["spoken"], "heading": x["heading"]} for x in f["scenes"]], "title": f["title"]}


# ---- an ear quiz is the section's own questions, read out --------------------------------------------------------

def ear_quiz(section_id: str) -> dict:
    s = _section(section_id)
    out = []
    for q in rows("select q.* from questions q join objectives o on o.id = q.objective_id where q.section_id = ? order by o.alpha / (o.alpha + o.beta), random() limit 6", section_id):
        opts = loads(q["options"], [])
        ask = q["prompt"].replace("___", " blank ").replace("____", " blank ")
        if opts:
            ask += " " + " ".join(f"{'ABCD'[i]}: {o['text'].rstrip('.')}." for i, o in enumerate(opts[:4]))
            right = next(i for i, o in enumerate(opts) if o["correct"])
            told = f"The answer is {'ABCD'[right]}: {opts[right]['text'].rstrip('.')}. {q['explanation']}"
        else:
            told = f"The answer is {q['answer'].rstrip('.')}. {q['explanation']}"
        out.append({"ask": ask, "answer": told})
    if not out:
        raise Problem("This section has no questions yet.")
    return {"title": s["title"], "items": out}


# ---- exporting a video with HyperFrames ------------------------------------------------------------------------------

def export_ready() -> dict:
    env = _env()
    return {"node": bool(shutil.which("npx", path=env["PATH"])), "ffmpeg": all(env.get(f"HYPERFRAMES_{x.upper()}_PATH") or shutil.which(x, path=env["PATH"]) for x in ("ffmpeg", "ffprobe"))}


def _env() -> dict:
    env = {k: v for k, v in os.environ.items() if k in ("HOME", "PATH", "TMPDIR", "LANG", "HYPERFRAMES_FFMPEG_PATH", "HYPERFRAMES_FFPROBE_PATH", "USERPROFILE", "APPDATA", "SYSTEMROOT")}  # no keys
    env["PATH"] = os.pathsep.join([env.get("PATH", ""), "/opt/homebrew/bin", "/usr/local/bin", str(Path.home() / ".local/node/bin")])
    return {**env, "DO_NOT_TRACK": "1", "HYPERFRAMES_NO_TELEMETRY": "1", "CI": "1"}


def project(section_id: str, kind: str) -> Path:
    """Writes the video as a HyperFrames project: index.html and its narration."""
    m = row("select * from media where section_id = ? and kind = ? and status = 'ready'", section_id, kind)
    if not m or kind not in VIDEO:
        raise Problem("Make the video first.")
    f = loads(m["data"], {})
    slug = re.sub(r"[^a-z0-9]+", "-", f"{f['title']}-{kind}".lower()).strip("-")[:60] or kind
    d = voice.data_dir("videos") / f"{slug}-{section_id[:6]}"
    (d / "voice").mkdir(parents=True, exist_ok=True)
    for i, x in enumerate(f["scenes"]):
        wav = voice.say(x["say"], "a")
        if wav:
            x["sound"] = f"voice/{i}.wav"
            x["spoken"] = round(voice.seconds_of(wav), 2)
            (d / x["sound"]).write_bytes(wav)
    (d / "index.html").write_text(film.build(f, audio=True), encoding="utf-8")
    (d / "README.txt").write_text(f"A HyperFrames project. Render it with:\n\n  npx {HYPERFRAMES} render -o video.mp4\n", encoding="utf-8")
    return d


def export(section_id: str, kind: str, render: bool) -> dict:
    d = project(section_id, kind)
    if not render:
        return {"folder": str(d)}
    can = export_ready()
    if not can["node"] or not can["ffmpeg"]:
        raise Problem(f"Rendering needs {'Node 22 or newer' if not can['node'] else 'FFmpeg'} on this computer. The project folder is ready either way: {d}")
    if not run("update media set export_status = 'rendering', export_error = null where section_id = ? and kind = ? and coalesce(export_status, '') != 'rendering'", section_id, kind):
        return {"folder": str(d)}
    course = row("select course_id from sections where id = ?", section_id)["course_id"]

    def work():
        out = d / "video.mp4"
        try:
            r = subprocess.run(["npx", "--yes", HYPERFRAMES, "render", str(d), "-o", str(out)], cwd=d, env=_env(), capture_output=True, text=True, timeout=1500)
            if r.returncode != 0 or not out.exists():
                tail = re.sub(r"\x1b\[[0-9;]*m", "", (r.stderr or r.stdout)).strip().splitlines()
                raise Problem("HyperFrames couldn't render it: " + " ".join(tail[-3:])[:260])
            run("update media set export_status = 'done', export_file = ? where section_id = ? and kind = ?", str(out), section_id, kind)
        except Exception as err:  # noqa: BLE001
            run("update media set export_status = 'failed', export_error = ? where section_id = ? and kind = ?", str(err)[:400], section_id, kind)
        _changed(course)

    background(work)
    return {"folder": str(d)}
