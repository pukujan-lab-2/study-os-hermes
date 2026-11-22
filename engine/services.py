"""Three optional services, each with the person's own key: Reducto reads PDFs, Pangram says how a text reads,
Modal speaks. Without a key, the plugin works on this computer alone. Keys are only ever sent to their own service."""

from __future__ import annotations

import base64
import io
import json
import os
import time
import urllib.error
import urllib.request
import uuid
import wave

from . import PLUGIN

REDUCTO = "https://platform.reducto.ai"
PANGRAM = "https://text.external-api.pangram.com"


class ServiceError(Exception):
    """Something to show the learner."""


def secret(name: str) -> str | None:
    try:
        from agent.secret_scope import get_secret  # type: ignore

        v = get_secret(name)
        if v:
            return v
    except Exception:  # noqa: BLE001 - outside Hermes (tests), the environment
        pass
    return os.environ.get(name) or None


def setting(key: str, default: str = "") -> str:
    try:
        from hermes_cli.config import load_config_readonly  # type: ignore

        entry = ((load_config_readonly() or {}).get("plugins", {}).get("entries", {}) or {}).get(PLUGIN, {}) or {}
        v = (entry.get("settings") or {}).get(key)
        if v not in (None, ""):
            return str(v)
    except Exception:  # noqa: BLE001
        pass
    return os.environ.get(f"STUDYOS_SOLO_{key.upper()}", default)


def status() -> dict:
    return {"reducto": bool(secret("REDUCTO_API_KEY")), "pangram": bool(secret("PANGRAM_API_KEY")), "modal": bool(setting("modal_url") and secret("MODAL_SPEECH_TOKEN"))}


def _safe(url: str) -> str:
    if not url.startswith("https://") and not url.startswith(("http://127.0.0.1", "http://localhost")):
        raise ServiceError("Only https addresses are used, so a key is never sent in the clear.")
    return url.rstrip("/")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):  # a redirect could carry a key somewhere else
        return None


def _http(method: str, url: str, *, headers: dict | None = None, body: bytes | None = None, timeout: float = 120) -> tuple[bytes, dict]:
    req = urllib.request.Request(url, data=body, method=method, headers={"User-Agent": "study-os-solo", **(headers or {})})
    try:
        with urllib.request.build_opener(_NoRedirect).open(req, timeout=timeout) as r:
            return r.read(60_000_000), {k.lower(): v for k, v in r.headers.items()}
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise ServiceError("That key wasn't accepted. Check it in Settings, Plugins, Study OS.") from None
        if e.code == 402:
            raise ServiceError("That account is out of credit.") from None
        raise ServiceError(f"The service answered {e.code}.") from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise ServiceError("The service couldn't be reached.") from None


def _json(method: str, url: str, headers: dict, body=None, timeout: float = 120) -> dict:
    raw, _ = _http(method, url, headers={"Content-Type": "application/json", **headers}, body=json.dumps(body).encode() if body is not None else None, timeout=timeout)
    return json.loads(raw)


# ---- Reducto: PDFs (and scans) to Markdown -----------------------------------------------------------------

def reducto(data: bytes, name: str) -> str:
    key = secret("REDUCTO_API_KEY")
    if not key:
        raise ServiceError("No Reducto key.")
    base, auth = _safe(setting("reducto_url", REDUCTO)), {"Authorization": f"Bearer {key}"}
    mark = uuid.uuid4().hex
    safe_name = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in name)[:80] or "document.pdf"
    form = b"".join([f'--{mark}\r\nContent-Disposition: form-data; name="file"; filename="{safe_name}"\r\nContent-Type: application/pdf\r\n\r\n'.encode(), data, f"\r\n--{mark}--\r\n".encode()])
    raw, _ = _http("POST", f"{base}/upload", headers={**auth, "Content-Type": f"multipart/form-data; boundary={mark}"}, body=form)
    file_id = json.loads(raw).get("file_id")
    if not file_id:
        raise ServiceError("Reducto didn't take the file.")
    out = _json("POST", f"{base}/parse", auth, {"input": file_id, "retrieval": {"chunking": {"chunk_mode": "section"}}, "formatting": {"table_output_format": "md"}}, timeout=300)
    result = out.get("result") or {}
    if result.get("type") == "url" and result.get("url"):  # big results are a short-lived link, fetched without the key
        raw, _ = _http("GET", _safe(result["url"]))
        result = json.loads(raw)
    return "\n\n".join(c.get("content", "") for c in result.get("chunks") or []).strip()


# ---- Pangram: how a text reads -------------------------------------------------------------------------------

def pangram(text: str) -> dict:
    """{label, ai, assisted, human}: shares from 0 to 1. A signal, never proof."""
    key = secret("PANGRAM_API_KEY")
    if not key:
        raise ServiceError("No Pangram key.")
    base, h = _safe(setting("pangram_url", PANGRAM)), {"x-api-key": key}
    t = _json("POST", f"{base}/task", h, {"text": text}, timeout=20)
    task, end = t.get("task_id"), time.time() + 40
    while t.get("stage") != "STAGE_SUCCESS":
        if t.get("stage") in ("STAGE_FAILED", "STAGE_ERROR") or not task or time.time() > end:
            raise ServiceError("Pangram didn't finish the check.")
        time.sleep(0.8)
        t = _json("GET", f"{base}/task/{task}", h, timeout=20)
    ai, assisted = float(t.get("fraction_ai") or 0), float(t.get("fraction_ai_assisted") or 0)
    human = float(t["fraction_human"]) if t.get("fraction_human") is not None else max(0.0, 1 - ai - assisted)
    return {"label": t.get("prediction_short") or ("Human" if human >= 0.5 else "AI"), "ai": round(ai, 3), "assisted": round(assisted, 3), "human": round(human, 3)}


# ---- Modal: a voice on your own account (voice/modal_speech.py) ------------------------------------------------------

def speak(text: str) -> dict:
    """{audio: base64 WAV}, or {local: True} for the page to use this computer's own voice."""
    if not status()["modal"]:
        return {"local": True}
    url = _safe(setting("modal_url"))
    raw, h = _http("POST", f"{url}/tts", headers={"Authorization": f"Bearer {secret('MODAL_SPEECH_TOKEN')}", "Content-Type": "application/json"}, body=json.dumps({"text": text[:3800], "voice": setting("voice", "af_heart")}).encode(), timeout=180)
    if not raw[:4] == b"RIFF":  # 16-bit mono PCM
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(int(h.get("x-sample-rate", 24000)))
            w.writeframes(raw[: len(raw) // 2 * 2])
        raw = buf.getvalue()
    return {"audio": base64.b64encode(raw).decode(), "mime": "audio/wav"}
