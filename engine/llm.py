"""Model calls, made by Hermes with whatever model the person uses there. This plugin never sees a model key."""

from __future__ import annotations

import json
import re

from . import PLUGIN

_llm = None


class ModelError(Exception):
    """Something to show the learner."""


def use(llm) -> None:
    """The agent half hands over ctx.llm; the Desktop routes make their own (same host-owned access)."""
    global _llm
    _llm = llm


def _get():
    global _llm
    if _llm is None:
        from agent.plugin_llm import PluginLlm  # type: ignore

        _llm = PluginLlm(plugin_id=PLUGIN)
    return _llm


def _explain(err: Exception) -> str:
    t = str(err)
    if "rate" in t.lower() or "429" in t:
        return "Your Hermes model is rate limited right now. Wait a minute and try again."
    if "credential" in t.lower() or "401" in t or "auth" in t.lower():
        return "Hermes isn't signed in to a model. Run `hermes model` to pick one."
    return f"The model didn't answer: {t[:160]}"


def text(system: str, user: str, *, max_tokens: int = 7000, purpose: str = "lesson") -> str:
    for attempt in range(2):
        try:
            r = _get().complete([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=max_tokens, timeout=240, purpose=f"study-os-solo.{purpose}")
            out = strip_fence(r.text or "")
            if out.strip():
                return out
            err: Exception = ValueError("an empty reply")
        except Exception as e:  # noqa: BLE001 - every provider fails its own way
            err = e
    raise ModelError(_explain(err))


def data(system: str, user: str, schema: dict, *, max_tokens: int = 7000, purpose: str = "quiz") -> dict:
    """A JSON reply that fits `schema`. One retry tells the model what was wrong."""
    note = ""
    for attempt in range(3):
        try:
            r = _get().complete_structured(
                instructions=system + note, input=[{"type": "text", "text": user}], json_schema=schema, max_tokens=max_tokens, timeout=240, purpose=f"study-os-solo.{purpose}"
            )
            parsed = r.parsed if r.parsed is not None else first_json(r.text or "")
            if isinstance(parsed, dict):
                missing = [k for k in schema.get("required", []) if k not in parsed]
                if not missing:
                    return parsed
                err: Exception = ValueError(f"the reply had no {', '.join(missing)}")
            else:
                err = ValueError("the reply wasn't JSON")
        except Exception as e:  # noqa: BLE001
            err = e
        note = f"\n\nYour last reply couldn't be used ({str(err)[:200]}). Reply with only a JSON object that fits the schema."
    raise ModelError(_explain(err))


def strip_fence(s: str) -> str:
    m = re.fullmatch(r"\s*```(?:markdown|md)?\s*\n(.*?)\n```\s*", s, flags=re.S)
    return (m.group(1) if m else s).strip()


def first_json(s: str):
    """The first JSON object in a reply (some models wrap it in prose or a fence)."""
    for i in (m.start() for m in re.finditer(r"\{", s)):
        try:
            return json.JSONDecoder().raw_decode(s[i:])[0]
        except ValueError:
            continue
    return None
