"""The one SQLite file. In Hermes it is <hermes home>/plugin-data/study-os-solo/data.db, which survives updates."""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from . import PLUGIN

SCHEMA = """
create table if not exists courses (
  id text primary key, title text not null, subject text, summary text, level integer not null default 10,
  story text, compare_to text, source_kind text not null, source_name text,
  status text not null default 'planning', error text, owner text, heartbeat text, created_at text not null, opened_at text
);
create table if not exists sections (
  id text primary key, course_id text not null references courses(id) on delete cascade, pos integer not null,
  title text not null, goal text, source text, body text, terms text not null default '[]', visual text,
  status text not null default 'waiting', error text, how text, read_at text,
  draft_status text, draft_error text
);
create index if not exists sections_course on sections(course_id, pos);
create table if not exists versions (
  id text primary key, section_id text not null references sections(id) on delete cascade, status text not null,
  body text not null, terms text not null default '[]', visual text, how text, created_at text not null
);
create table if not exists objectives (
  id text primary key, course_id text not null references courses(id) on delete cascade,
  section_id text not null references sections(id) on delete cascade, label text not null,
  alpha real not null default 1, beta real not null default 1, streak integer not null default 0, next_review text
);
create index if not exists objectives_course on objectives(course_id);
create table if not exists questions (
  id text primary key, objective_id text not null references objectives(id) on delete cascade,
  section_id text not null references sections(id) on delete cascade, kind text not null, difficulty text not null,
  prompt text not null, options text, answer text not null, hint text, explanation text
);
create table if not exists attempts (
  id text primary key, question_id text, objective_id text not null references objectives(id) on delete cascade,
  score real not null, tries integer not null, hints integer not null, created_at text not null
);
create index if not exists attempts_time on attempts(created_at);
create table if not exists explanations (
  id text primary key, section_id text not null references sections(id) on delete cascade, text text not null,
  score real not null, feedback text not null, authorship text, created_at text not null
);
create table if not exists media (
  id text primary key, section_id text not null references sections(id) on delete cascade, kind text not null,
  status text not null, data text, error text, made_from text, export_status text, export_error text, export_file text, created_at text not null,
  unique (section_id, kind)
);
create table if not exists students (id text primary key, name text not null, email text, created_at text not null);
create table if not exists assignments (
  id text primary key, title text not null, kind text not null, instructions text, due text, minutes integer, questions text not null,
  source_name text, source_check text, read_by text, status text not null default 'draft', error text, created_at text not null
);
create table if not exists submissions (
  id text primary key, assignment_id text not null references assignments(id) on delete cascade, student_id text not null, student_name text not null,
  status text not null default 'working', answers text not null default '{}', process text not null default '{}', started_at text, handed_in_at text,
  checked text, check_status text, marks text, comment text, returned_at text, unique (assignment_id, student_id)
);
create table if not exists meetings (
  id text primary key, title text not null, who text not null, start text not null, minutes integer not null default 30, note text,
  status text not null default 'asked', asked_by text not null default 'student', created_at text not null
);
create table if not exists uploads (id text primary key, name text not null, text text not null, read_by text not null, created_at text not null);
create table if not exists prefs (key text primary key, value text not null);
"""

_ready: set[str] = set()
_lock = threading.Lock()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id() -> str:
    return uuid.uuid4().hex[:16]


def _connect() -> sqlite3.Connection:
    path = os.environ.get("STUDYOS_SOLO_DB")
    if path:
        c = sqlite3.connect(path, check_same_thread=False, timeout=20)
    else:
        from plugins.plugin_storage import plugin_db  # type: ignore

        c = plugin_db(PLUGIN)
    c.row_factory = sqlite3.Row
    c.execute("pragma foreign_keys = on")
    c.execute("pragma busy_timeout = 20000")
    return c


@contextmanager
def db():
    """One connection for one unit of work: committed at the end, rolled back on an error."""
    c = _connect()
    try:
        where = c.execute("pragma database_list").fetchone()[2]
        if where not in _ready:
            with _lock:
                c.executescript(SCHEMA)
                _ready.add(where)
        yield c
        c.commit()
    except BaseException:
        c.rollback()
        raise
    finally:
        c.close()


def rows(sql: str, *args) -> list[dict]:
    with db() as c:
        return [dict(r) for r in c.execute(sql, args).fetchall()]


def row(sql: str, *args) -> dict | None:
    with db() as c:
        r = c.execute(sql, args).fetchone()
        return dict(r) if r else None


def run(sql: str, *args) -> int:
    with db() as c:
        return c.execute(sql, args).rowcount


def loads(x, default):
    try:
        return json.loads(x) if x else default
    except ValueError:
        return default


def get_prefs() -> dict:
    out = {"level": 10, "story": "plain", "compare_to": "", "want": []}
    for r in rows("select key, value from prefs"):
        out[r["key"]] = loads(r["value"], out.get(r["key"]))
    return out


def set_prefs(changes: dict) -> dict:
    with db() as c:
        for k, v in changes.items():
            c.execute("insert into prefs (key, value) values (?, ?) on conflict(key) do update set value = excluded.value", (k, json.dumps(v)))
    return get_prefs()
