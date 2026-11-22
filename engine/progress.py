"""What is being made right now, anywhere: how long it has taken, how long it usually takes, and what it is doing. Work
that a closed app left behind is picked up once, then marked as stopped, so nothing spins forever."""

from __future__ import annotations

import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from .store import now, rows, run

TYPICAL = {"podcast": 14, "recap": 9, "explainer": 26, "short": 18, "slides": 26, "play": 50, "assignment": 16, "exam": 22, "course": 70, "wording": 30, "label": 9, "sketch": 5}
NAMES = {"podcast": "Podcast", "recap": "Recap", "explainer": "Explainer", "short": "Short", "slides": "Slides", "play": "Game", "assignment": "Assignment", "exam": "Mock exam", "course": "Course", "wording": "New wording"}
TABS = {"podcast": "listen", "recap": "listen", "explainer": "watch", "short": "watch", "slides": "watch", "play": "play", "wording": "learn"}
BEAT, STALE, LIMIT = 8, 40, 600  # seconds: how often work says it is alive, when it isn't, and when to give up


def seconds(at: str | None) -> float:
    if not at:
        return 0.0
    t = datetime.fromisoformat(at)
    return max(0.0, (datetime.now(timezone.utc) - (t if t.tzinfo else t.replace(tzinfo=timezone.utc))).total_seconds())


def ago(s: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(seconds=s)).isoformat(timespec="seconds")


@contextmanager
def alive(table: str, row_id: str):
    """Says the work is still going, for as long as it is."""
    from .courses import background

    done = threading.Event()

    def beat():
        while not done.wait(BEAT):
            run(f"update {table} set beat = ? where id = ?", now(), row_id)

    run(f"update {table} set beat = ? where id = ?", now(), row_id)
    background(beat)
    try:
        yield
    finally:
        done.set()


def stage(table: str, row_id: str, text: str, share: float = 0.0) -> None:
    """The step it is on, and how much is surely done (0 to 1)."""
    run(f"update {table} set stage = ? where id = ?", f"{text}|{share:.2f}", row_id)


def stage_of(text: str | None) -> tuple[str, float]:
    if not text or "|" not in text:
        return "", 0.0
    a, b = text.rsplit("|", 1)
    try:
        return a, float(b)
    except ValueError:
        return a, 0.0


def of_media(m: dict) -> dict:
    s, share = stage_of(m["stage"])
    return {"seconds": round(seconds(m["created_at"]), 1), "typical": TYPICAL.get(m["kind"], 40), "stage": s, "share": share}


def _item(kind: str, key: str, title: str, at: str | None, stage_text: str | None, **where) -> dict:
    s, share = stage_of(stage_text)
    return {"key": key, "at": at, "kind": kind, "name": NAMES[kind], "title": title, "seconds": round(seconds(at), 1), "typical": TYPICAL[kind], "stage": s, "share": share, **where}


def course(c: dict) -> dict:
    secs = rows("select status from sections where course_id = ?", c["id"])
    done, n = sum(s["status"] == "ready" for s in secs), len(secs)
    planning = c["status"] == "planning"
    return {"seconds": round(seconds(c["created_at"]), 1), "typical": 14 + 30 * ((max(n, 2) + 1) // 2), "stage": "Planning it" if planning else f"{done} of {n} sections written", "share": 0.0 if planning or not n else 0.08 + 0.9 * done / n}


def making() -> dict:
    """Everything being made, and what finished in the last minute and a half."""
    from . import courses, media

    courses.resume_stopped()
    media.pick_up()
    stopped_work()
    out, done, since = [], [], ago(90)
    for m in rows("select m.*, s.title section, s.course_id from media m join sections s on s.id = m.section_id where m.status = 'making' or (m.done_at >= ?)", since):
        x = _item(m["kind"], f"media:{m['section_id']}:{m['kind']}", m["section"], m["created_at"], m["stage"], course_id=m["course_id"], section_id=m["section_id"], tab=TABS[m["kind"]])
        (out if m["status"] == "making" else done).append({**x, "failed": m["status"] == "failed"})
    for c in rows("select * from courses where status in ('planning','writing') or done_at >= ?", since):
        x = {**_item("course", f"course:{c['id']}", c["title"], c["created_at"], None, course_id=c["id"], tab="learn"), **course(c)}
        (out if c["status"] in ("planning", "writing") else done).append({**x, "failed": c["status"] == "failed"})
    for a in rows("select * from assignments where status = 'making' or done_at >= ?", since):
        x = _item("exam" if a["kind"] == "exam" else "assignment", f"work:{a['id']}", a["title"], a["created_at"], a["stage"], work=a["id"])
        (out if a["status"] == "making" else done).append({**x, "failed": a["status"] == "failed"})
    for s in rows("select * from sections where draft_status = 'writing'"):
        out.append({**_item("wording", f"wording:{s['id']}", s["title"], s["draft_at"], "Writing it the new way|0", course_id=s["course_id"], section_id=s["id"], tab="learn"), "failed": False})
    return {"making": out, "done": done}


def stopped_work() -> None:
    """Assignments left half made: their document isn't kept, so they are marked, not retried."""
    run("update assignments set status = 'failed', done_at = ?, error = 'It stopped part way. Make it again.' where status = 'making' and coalesce(beat, created_at) < ?", now(), ago(STALE))
    run("update sections set draft_status = null, draft_error = 'It stopped part way. Try again.' where draft_status = 'writing' and draft_at is not null and draft_at < ?", ago(LIMIT))
