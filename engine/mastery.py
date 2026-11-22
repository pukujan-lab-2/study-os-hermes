"""How well each learning goal is known, and when to see it again. Pure functions.

Mastery is a Beta(alpha, beta) belief. A clean first-try answer is full evidence; retries and hints
shrink it; giving up is strong evidence against. Harder questions weigh more.
"""

from __future__ import annotations

from datetime import datetime, timedelta

MASTERED = 0.8
WEIGHT = {"recall": 0.8, "understand": 1.0, "apply": 1.25}
RETRY, HINT = 0.75, 0.7
LADDER_DAYS = (1, 3, 7, 16, 35, 75)


def mastery(alpha: float, beta: float) -> float:
    return alpha / (alpha + beta)


def shown(alpha: float, beta: float) -> float:
    """The share to show: 0 until something is right, and high once it's really known."""
    if not started(alpha, beta):
        return 0.0
    m = (alpha - 1) / (alpha + beta - 1)
    return round(max(m, 0.9) if is_mastered(alpha, beta) else m, 3)


def started(alpha: float, beta: float) -> bool:
    return alpha + beta > 2


def is_mastered(alpha: float, beta: float) -> bool:
    return mastery(alpha, beta) >= MASTERED and alpha + beta - 2 >= 2


def apply_answer(
    state: dict, *, score: float, difficulty: str = "understand", tries: int = 1, hints: int = 0, gave_up: bool = False, now: datetime
) -> dict:
    """The belief after one resolved question: {alpha, beta, streak, next_review}."""
    w = WEIGHT.get(difficulty, 1.0)
    s = 0.0 if gave_up else max(0.0, min(1.0, score)) * RETRY ** max(0, tries - 1) * HINT ** max(0, hints)
    if gave_up:
        w *= 0.8
    alpha, beta = state["alpha"] + w * s, state["beta"] + w * (1 - s)
    streak = state["streak"] + 1 if s >= 0.6 else 0
    days = LADDER_DAYS[min(streak, len(LADDER_DAYS)) - 1] if streak else 0
    # A miss comes back soon, but not in the same sitting.
    due = now + (timedelta(days=days) if days else timedelta(minutes=10))
    return {"alpha": alpha, "beta": beta, "streak": streak, "next_review": due.isoformat(timespec="seconds")}


def pick(objectives: list[dict], asked: set[str], now_iso: str) -> dict | None:
    """Which goal to ask about next: due ones first, then the least known; skips goals with nothing left to ask."""
    left = [o for o in objectives if any(q not in asked for q in o["question_ids"])]
    if not left:
        return None
    def rank(o: dict):
        due = bool(o["next_review"]) and o["next_review"] <= now_iso
        seen = sum(q in asked for q in o["question_ids"])
        return (not due, seen, mastery(o["alpha"], o["beta"]))
    return min(left, key=rank)


def difficulty_for(m: float) -> list[str]:
    """Question difficulties to try, best fit first."""
    if m < 0.45:
        return ["recall", "understand", "apply"]
    if m < 0.7:
        return ["understand", "apply", "recall"]
    return ["apply", "understand", "recall"]
