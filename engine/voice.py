"""Speaking and hearing. Speaking: your own Modal, else this computer's voice (macOS `say`, Linux `espeak-ng`), else the
page uses the browser's. Hearing: your own Modal, else the speech-to-text Hermes is set to. Sound is kept in a small cache."""

from __future__ import annotations

import base64
import hashlib
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

from . import PLUGIN, services

CACHE_BYTES = 300_000_000
MODAL_VOICES = {"a": "af_heart", "b": "am_michael"}
MAC_VOICES = {"a": ("Samantha", "Allison", "Ava"), "b": ("Daniel", "Tom", "Alex")}


def data_dir(name: str) -> Path:
    root = os.environ.get("STUDYOS_SOLO_DATA")
    if root:
        p = Path(root) / name
    else:
        from plugins.plugin_storage import plugin_data_dir  # type: ignore

        p = plugin_data_dir(PLUGIN) / name
    p.mkdir(parents=True, exist_ok=True)
    return p


def speakable(text: str) -> str:
    text = re.sub(r"^\s*>.*$", "", text, flags=re.M)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    return re.sub(r"\s+", " ", re.sub(r"[#*_`|]", "", text)).strip()[:3800]


def seconds_of(wav: bytes) -> float:
    with wave.open(io.BytesIO(wav)) as w:
        return w.getnframes() / float(w.getframerate() or 1)


_mac_names: set[str] | None = None


def _mac_voice(who: str) -> str | None:
    global _mac_names
    if _mac_names is None:
        try:
            out = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, timeout=10).stdout
            _mac_names = {re.split(r"\s{2,}", line)[0].strip() for line in out.splitlines()}
        except (OSError, subprocess.SubprocessError):
            _mac_names = set()
    return next((v for v in MAC_VOICES[who] if v in _mac_names), None)


def computer(text: str, who: str) -> bytes | None:
    """This computer's own voice, as a WAV. The text goes in on stdin, never on a command line."""
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, "v.wav")
        if sys.platform == "darwin" and shutil.which("say"):
            v = _mac_voice(who)
            cmd = ["say", *(["-v", v] if v else []), "-o", out, "--file-format=WAVE", "--data-format=LEI16@22050", "-f", "-"]
        elif shutil.which("espeak-ng"):
            cmd = ["espeak-ng", "-v", "en-us+f3" if who == "a" else "en-us+m3", "-s", "160", "-w", out, "--stdin"]
        else:
            return None
        try:
            subprocess.run(cmd, input=text.encode(), capture_output=True, timeout=90, check=True)
            wav = Path(out).read_bytes()
            return wav if len(wav) > 100 and seconds_of(wav) > 0.05 else None
        except (OSError, subprocess.SubprocessError, wave.Error, EOFError):
            return None


def say(text: str, who: str = "a") -> bytes | None:
    """A WAV of the text in voice a or b, or None when this computer can't make one (the page speaks it then)."""
    text = speakable(text)
    if not text:
        return None
    who = who if who in MODAL_VOICES else "a"
    modal = services.status()["modal"]
    kind = f"modal:{services.setting('voice', MODAL_VOICES['a']) if who == 'a' else MODAL_VOICES[who]}" if modal else f"computer:{who}"
    f = data_dir("voice") / (hashlib.sha256(f"{kind}|{text}".encode()).hexdigest()[:32] + ".wav")
    if f.exists():
        f.touch()
        return f.read_bytes()
    wav = None
    if modal:
        try:
            wav = services.modal_tts(text, kind.split(":", 1)[1])
        except services.ServiceError:
            wav = None  # asleep or out of credit: this computer's voice carries on
    if wav is None:
        wav = computer(text, who)
    if wav:
        f.write_bytes(wav)
        _prune(f.parent)
    return wav


def _prune(d: Path) -> None:
    files = sorted(d.glob("*.wav"), key=lambda p: p.stat().st_mtime, reverse=True)
    total = 0
    for p in files:
        total += p.stat().st_size
        if total > CACHE_BYTES:
            p.unlink(missing_ok=True)


def speak(text: str, who: str = "a") -> dict:
    wav = say(text, who)
    if not wav:
        return {"local": True}
    return {"audio": base64.b64encode(wav).decode(), "mime": "audio/wav", "seconds": round(seconds_of(wav), 2)}


def hear(wav: bytes) -> str:
    """What was said. Modal first, then whatever Hermes uses to listen."""
    if len(wav) < 44 or wav[:4] != b"RIFF":
        raise services.ServiceError("That recording couldn't be read.")
    if services.status()["modal"]:
        try:
            return services.modal_stt(wav)
        except services.ServiceError:
            pass
    try:
        from tools.transcription_tools import transcribe_audio  # type: ignore
    except ImportError:
        transcribe_audio = None
    if transcribe_audio:
        with tempfile.NamedTemporaryFile(suffix=".wav") as f:
            f.write(wav)
            f.flush()
            out = transcribe_audio(f.name)
        if out.get("success"):
            return str(out.get("transcript") or "").strip()
    raise services.ServiceError("Hermes can't hear yet. Pick a speech-to-text provider in Hermes Settings, Voice, or add your Modal voice. You can type here meanwhile.")
