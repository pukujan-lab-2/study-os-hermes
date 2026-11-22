"""Turning a file into text to teach from. PDFs go to Reducto when there is a key, else they are read here."""

from __future__ import annotations

import io
import re
import zipfile
from xml.etree import ElementTree

from . import services
from .courses import Problem
from .store import new_id, now, row, run

MAX_BYTES = 30_000_000
MAX_CHARS = 200_000


def read(name: str, data: bytes) -> tuple[str, str]:
    """(text, what read it)."""
    if len(data) > MAX_BYTES:
        raise Problem("That file is over 30 MB.")
    low = name.lower()
    if data[:5] == b"%PDF-" or low.endswith(".pdf"):
        if services.status()["reducto"]:
            try:
                text = services.reducto(data, name)
                if len(text) >= 200:
                    return text[:MAX_CHARS], "Reducto"
            except services.ServiceError as err:
                text, by = _pdf(data)
                if len(text) >= 200:
                    return text, f"this computer (Reducto: {err})"
                raise Problem(f"Reducto couldn't read it: {err}") from None
        text, by = _pdf(data)
        if len(text) < 200:
            raise Problem("There's no text in that PDF. It may be a scan: add a Reducto key to read scans.")
        return text, by
    if low.endswith(".docx"):
        return _docx(data), "this computer"
    if low.endswith((".txt", ".md", ".markdown", ".csv", ".rst")) or b"\x00" not in data[:2000]:
        return data.decode("utf-8", errors="replace")[:MAX_CHARS], "this computer"
    raise Problem("That kind of file can't be read yet. Use a PDF, Word document or text file.")


def _pdf(data: bytes) -> tuple[str, str]:
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        raise Problem("Reading PDFs here needs the pypdf package: run `hermes plugins enable study-os-solo` and allow its packages, or add a Reducto key.") from None
    try:
        r = PdfReader(io.BytesIO(data))
        pages = [(p.extract_text() or "") for p in r.pages[:200]]
    except Exception:  # noqa: BLE001 - damaged and locked files fail in many ways
        raise Problem("That PDF couldn't be opened. It may be damaged or have a password.") from None
    text = "\n\n".join(re.sub(r"-\n(?=[a-z])", "", p).strip() for p in pages)
    return re.sub(r"(?<![.!?:\n])\n(?=[a-z(])", " ", text).strip()[:MAX_CHARS], "this computer"


def _docx(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            info = z.getinfo("word/document.xml")
            if info.file_size > 40_000_000:
                raise Problem("That document is too big.")
            xml = z.read(info)
    except (zipfile.BadZipFile, KeyError):
        raise Problem("That Word document couldn't be opened.") from None
    if b"<!DOCTYPE" in xml[:2000] or b"<!ENTITY" in xml:
        raise Problem("That Word document couldn't be opened.")
    w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    out = []
    for p in ElementTree.fromstring(xml).iter(f"{w}p"):
        t = "".join(x.text or "" for x in p.iter(f"{w}t")).strip()
        style = p.find(f"{w}pPr/{w}pStyle")
        if t:
            out.append(("## " if style is not None and str(style.get(f"{w}val", "")).startswith("Heading") else "") + t)
    return "\n\n".join(out)[:MAX_CHARS]


def photo(name: str, data: bytes) -> str:
    """Handwriting or a worksheet in a photo, read by Reducto."""
    kind = "image/png" if data[:8] == b"\x89PNG\r\n\x1a\n" else "image/jpeg" if data[:3] == b"\xff\xd8\xff" else "application/pdf" if data[:5] == b"%PDF-" else None
    if not kind:
        raise Problem("Use a PNG or JPEG photo, or a PDF scan.")
    if not services.status()["reducto"]:
        raise Problem("Reading handwriting needs a Reducto key in Settings, Plugins.")
    text = services.reducto(data, name, kind)
    if len(text.strip()) < 3:
        raise Problem("No writing was found in that photo. Try a sharper one, closer up.")
    return text.strip()[:MAX_CHARS]


def check(uid: str) -> dict:
    """Who wrote the source, by Pangram's reading of a good sample of it."""
    text = upload(uid)["text"]
    return check_text(text)


def check_text(text: str) -> dict:
    plain = re.sub(r"[#*_|>`]", "", text)
    start = min(400, len(plain) // 20)  # past a title page
    return services.pangram(re.sub(r"\s+", " ", plain[start : start + 7000]).strip())


def save_upload(name: str, data: bytes) -> dict:
    text, by = read(name, data)
    if len(text) < 200:
        raise Problem("There isn't enough text in that file to make a course.")
    uid = new_id()
    run("insert into uploads (id, name, text, read_by, created_at) values (?,?,?,?,?)", uid, name[:120], text, by, now())
    return {"id": uid, "name": name[:120], "characters": len(text), "read_by": by, "blocks": services.blocks_of(data)}


SAMPLES = {
    "ai-article": ("ai-article.pdf", "The Science of Candles.pdf"),
    "faraday": ("faraday-1861.pdf", "Faraday, 1861.pdf"),
    "essay-person": ("essay-person.txt", ""),
    "essay-ai": ("essay-ai.txt", ""),
    "handwriting": ("handwriting.png", "handwriting.png"),
}


def sample(key: str) -> dict:
    """One of the bundled samples, ready to use: a document becomes an upload, the others become text."""
    if key not in SAMPLES:
        raise Problem("Unknown sample.")
    from pathlib import Path

    file, name = SAMPLES[key]
    data = (Path(__file__).resolve().parent.parent / "samples" / file).read_bytes()
    if file.endswith(".pdf"):
        return {"upload": save_upload(name, data)}
    if file.endswith(".png"):
        return {"text": photo(name, data)}
    return {"text": data.decode("utf-8").strip()}


def upload(uid: str) -> dict:
    u = row("select * from uploads where id = ?", uid)
    if not u:
        raise Problem("That file isn't here any more. Add it again.")
    return u
