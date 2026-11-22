"""Whose space a request works in. In Hermes there is one person and this stays empty. The web version (web/server.py)
sets it for every request, so each device has its own database and the class routes use the class's database."""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable


@dataclass
class Place:
    db: Path  # this request's database
    data: Path  # files that belong to it
    shared: Path  # files that are the same for everyone (the spoken lines)
    me: dict = field(default_factory=dict)  # who the student is, decided by the server
    teacher: bool = True  # runs the class this request works in
    spend: Callable[[str], None] = lambda kind: None  # raises when a limit is reached


here: ContextVar[Place | None] = ContextVar("study_os_place", default=None)


def spend(kind: str) -> None:
    p = here.get()
    if p:
        p.spend(kind)
