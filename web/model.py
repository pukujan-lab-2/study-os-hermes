"""Claude for the web version, in the shape Hermes' own model access has (complete, complete_structured)."""

from __future__ import annotations

import json
import os
from types import SimpleNamespace

import anthropic

MODEL = os.environ.get("STUDYOS_MODEL", "claude-sonnet-5-5")


class Claude:
    def __init__(self) -> None:
        self._made, self._client = None, None

    def client(self) -> anthropic.Anthropic:
        """A key from the environment, or a lease file that may be renewed while this runs."""
        f = os.environ.get("CLAUDE_LEASE_FILE")
        stamp = os.stat(f).st_mtime if f else 0
        if self._client is None or stamp != self._made:
            if f:
                lease = json.load(open(f, encoding="utf-8"))
                self._client = anthropic.Anthropic(api_key=None, auth_token=lease["key"], base_url=lease["proxyUrl"].rstrip("/") + "/https://api.anthropic.com", max_retries=2, default_headers={"user-agent": "study-os/0.1"})
            else:
                self._client = anthropic.Anthropic(max_retries=2)
            self._made = stamp
        return self._client

    def _ask(self, system, messages, max_tokens, timeout, purpose, schema=None):
        out = {"effort": "medium" if "game" in purpose else "low"}
        if schema:
            out["format"] = {"type": "json_schema", "schema": schema}
        r = self.client().with_options(timeout=timeout).messages.create(model=MODEL, max_tokens=max_tokens, system=system, messages=messages, extra_body={"output_config": out})
        return "".join(b.text for b in r.content if b.type == "text")

    def complete(self, *, messages, max_tokens=7000, timeout=240, purpose="", **_):
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        return SimpleNamespace(text=self._ask(system, [m for m in messages if m["role"] != "system"], max_tokens, timeout, purpose))

    def complete_structured(self, *, instructions, input, json_schema, max_tokens=7000, timeout=240, purpose="", **_):
        text = self._ask(instructions, [{"role": "user", "content": "\n".join(x["text"] for x in input if x.get("type") == "text")}], max_tokens, timeout, purpose, json_schema)
        try:
            return SimpleNamespace(parsed=json.loads(text), text=text)
        except ValueError:
            return SimpleNamespace(parsed=None, text=text)
