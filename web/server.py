"""Study OS on the web, with no sign-in. Every device gets its own private space (a database in its own folder, known
by a long random cookie). A class is a teacher's device plus a code: student devices that join it do the class's work
in the class's database, under an identity the server gives them. Spaces are deleted after a few quiet days."""

from __future__ import annotations

import hashlib
import importlib
import io
import os
import re
import secrets
import shutil
import sqlite3
import sys
import threading
import time
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlsplit

import anyio.to_thread
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT), str(ROOT / "dashboard")]
api = importlib.import_module("plugin_api")
E = {n: importlib.import_module(f"{api.NAME}.{n}") for n in ("place", "llm", "services", "store", "courses")}
Place, here = E["place"].Place, E["place"].here
DATA = Path(os.environ.get("WEB_DATA", "/data"))
SEED = Path(os.environ.get("WEB_SEED", ROOT / "web" / "seed"))
SITE = Path(os.environ.get("WEB_SITE", "/site"))
PUBLIC = os.environ.get("WEB_ORIGIN", "http://localhost:3190")
KEEP_DAYS = 3
MAX_BODY = 8_000_000
# what one device, and everyone together, may use in a day
EACH = {"model": 90, "reducto": 8, "pangram": 40, "voice": 90}
ALL = {"model": int(os.environ.get("WEB_MAX_MODEL", 1500)), "reducto": 150, "pangram": 900, "voice": 1200}
WORDS = {"model": "today's writing", "reducto": "today's page reading", "pangram": "today's checks", "voice": "today's voice"}
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
lock = threading.Lock()


# ---- devices and classes ---------------------------------------------------------------------------------------

def meta() -> sqlite3.Connection:
    c = sqlite3.connect(DATA / "web.db", timeout=20)
    c.row_factory = sqlite3.Row
    return c


def setup() -> None:
    (DATA / "devices").mkdir(parents=True, exist_ok=True)
    (DATA / "voice").mkdir(exist_ok=True)
    with meta() as c:
        c.executescript("""
        pragma journal_mode = wal;
        create table if not exists devices (id text primary key, made real not null, seen real not null, room text);
        create table if not exists rooms (code text primary key, owner text not null unique, made real not null);
        create table if not exists used (day text not null, who text not null, kind text not null, n integer not null default 0, primary key (day, who, kind));
        """)
    for f in (SEED / "voice").glob("*.wav"):
        if not (DATA / "voice" / f.name).exists():
            shutil.copyfile(f, DATA / "voice" / f.name)


def space(device: str) -> Path:
    d = DATA / "devices" / device
    if not (d / "data.db").exists():
        with lock:
            if not (d / "data.db").exists():
                d.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(SEED / "data.db", d / "new.db")
                if (SEED / "class").is_dir():
                    shutil.copytree(SEED / "class", d / "class", dirs_exist_ok=True)
                os.replace(d / "new.db", d / "data.db")
    return d


def token_id(cookie: str | None) -> str | None:
    """The cookie is a secret; the folder name is its hash, so a listing of folders lets nobody in."""
    return hashlib.sha256(cookie.encode()).hexdigest()[:32] if cookie and re.fullmatch(r"[A-Za-z0-9_-]{40,60}", cookie) else None


def student_id(device: str) -> str:
    return hashlib.sha256(f"student:{device}".encode()).hexdigest()[:16]


def spender(device: str):
    def spend(kind: str) -> None:
        day = time.strftime("%Y-%m-%d")
        with lock, meta() as c:
            mine = c.execute("select n from used where day = ? and who = ? and kind = ?", (day, device, kind)).fetchone()
            every = c.execute("select n from used where day = ? and who = '' and kind = ?", (day, kind)).fetchone()
            over = "You've used " if mine and mine[0] >= EACH[kind] else "Everyone together has used " if every and every[0] >= ALL[kind] else ""
            if over:
                err = E["llm"].ModelError if kind == "model" else E["services"].ServiceError
                raise err(f"{over}{WORDS[kind]} on this free demo. Everything already made still works. Install the plugin to go on.")
            for who in (device, ""):
                c.execute("insert into used (day, who, kind, n) values (?, ?, ?, 1) on conflict(day, who, kind) do update set n = n + 1", (day, who, kind))
    return spend


def sweep() -> None:
    while True:
        old = time.time() - KEEP_DAYS * 86400
        try:
            with meta() as c:
                gone = [r["id"] for r in c.execute("select id from devices where seen < ?", (old,))]
                c.executemany("delete from rooms where owner = ?", [(g,) for g in gone])
                c.executemany("delete from devices where id = ?", [(g,) for g in gone])
                c.execute("delete from used where day < ?", (time.strftime("%Y-%m-%d", time.localtime(old)),))
            for g in gone:
                if re.fullmatch(r"[0-9a-f]{32}", g):
                    shutil.rmtree(DATA / "devices" / g, ignore_errors=True)
        except sqlite3.Error:
            pass
        time.sleep(1800)


def room_of(device: str) -> dict:
    """{owner, code, joined}: the class this device works in."""
    with meta() as c:
        d = c.execute("select room from devices where id = ?", (device,)).fetchone()
        if d and d["room"]:
            r = c.execute("select * from rooms where code = ?", (d["room"],)).fetchone()
            if r and r["owner"] != device:
                return {"owner": r["owner"], "code": r["code"], "joined": True}
        r = c.execute("select code from rooms where owner = ?", (device,)).fetchone()
        return {"owner": device, "code": r["code"] if r else None, "joined": False}


# ---- each request in its place ------------------------------------------------------------------------------------

CLASS = re.compile(r"^/api/plugins/study-os-solo/(teach|class|meetings)(/|$)")
made_by: dict[str, list[float]] = {}


class Spaces:
    """Finds whose device is asking, and sets where the engine works for this request."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] != "http" or not path.startswith(("/api/", "/app")):
            return await self.app(scope, receive, send)
        head = {k.decode().lower(): v.decode("latin1") for k, v in scope["headers"]}
        jar = SimpleCookie()
        try:
            jar.load(head.get("cookie", ""))
        except Exception:  # noqa: BLE001
            pass
        raw = jar["so_device"].value if "so_device" in jar else None
        device = token_id(raw)
        writing = scope["method"] not in ("GET", "HEAD")
        if writing:
            origin = head.get("origin")
            if origin and urlsplit(origin).netloc != head.get("host"):
                return await JSONResponse({"detail": "That came from another site."}, 403)(scope, receive, send)
            if int(head.get("content-length") or 0) > MAX_BODY:
                return await JSONResponse({"detail": "That is over 8 MB."}, 413)(scope, receive, send)
        fresh = None
        if not device:
            if path.startswith("/api/"):
                return await JSONResponse({"detail": "Open the app page first."}, 401)(scope, receive, send)
            ip = head.get("cf-connecting-ip") or (scope.get("client") or ["?"])[0]
            t = time.time()
            made_by[ip] = [x for x in made_by.get(ip, []) if t - x < 3600]
            if len(made_by[ip]) >= 120:
                return await PlainTextResponse("Too many new devices from here. Try again in an hour.", 429)(scope, receive, send)
            made_by[ip].append(t)
            fresh = secrets.token_urlsafe(32)
            device = token_id(fresh)
        self.seen(device)
        mark = None
        if path.startswith("/api/"):
            try:
                mark = here.set(await anyio.to_thread.run_sync(self.place, device, path))
            except PermissionError as err:
                return await JSONResponse({"detail": str(err)}, 403)(scope, receive, send)
            scope["device"] = device
        else:
            scope["device"] = device

        async def out(m):
            if m["type"] == "http.response.start":
                h = list(m.get("headers", []))
                if fresh:
                    safe = "; Secure" if PUBLIC.startswith("https") else ""
                    h.append((b"set-cookie", f"so_device={fresh}; Path=/; Max-Age={KEEP_DAYS * 86400 * 4}; HttpOnly; SameSite=Lax{safe}".encode()))
                h += [(b"cache-control", b"no-store")] if path.startswith("/api/") else []
                m = {**m, "headers": h}
            await send(m)

        try:
            await self.app(scope, receive, out)
        finally:
            if mark:
                here.reset(mark)

    @staticmethod
    def seen(device: str) -> None:
        t = time.time()
        with meta() as c:
            c.execute("insert into devices (id, made, seen) values (?, ?, ?) on conflict(id) do update set seen = excluded.seen", (device, t, t))

    @staticmethod
    def place(device: str, path: str) -> Place:
        mine = space(device)
        room = room_of(device)
        if room["joined"] and path.startswith("/api/plugins/study-os-solo/teach"):
            raise PermissionError("You joined a class as a student. Leave it to run your own.")
        if room["joined"] and re.search(r"/meetings/[^/]+/booked$", path):
            raise PermissionError("Only the teacher books.")
        own = Place(db=mine / "data.db", data=mine, shared=DATA / "voice", spend=spender(device))
        mark = here.set(own)
        try:
            p = E["store"].get_prefs()
        finally:
            here.reset(mark)
        own.me = {"id": student_id(device) if p.get("student_name") else "", "name": str(p.get("student_name") or "")[:60], "email": str(p.get("student_email") or "")[:120], "teacher": str(p.get("teacher_email") or "")[:120]}
        own.teacher = not room["joined"]
        if CLASS.match(path) and room["joined"]:
            theirs = space(room["owner"])
            own.db, own.data = theirs / "data.db", theirs
        return own


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.on_event("startup")
async def start():
    setup()
    anyio.to_thread.current_default_thread_limiter().total_tokens = 200
    threading.Thread(target=sweep, daemon=True).start()


@app.middleware("http")
async def headers(request, call_next):
    r = await call_next(request)
    r.headers.setdefault("x-content-type-options", "nosniff")
    r.headers.setdefault("referrer-policy", "no-referrer")
    if request.url.path == "/app/static/frame.html":
        r.headers["content-security-policy"] = "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-ancestors 'self'"
    elif request.url.path.startswith("/app"):
        r.headers["content-security-policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; frame-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        r.headers["cache-control"] = "no-store"
    return r


app.add_middleware(Spaces)


# what the web version won't take from a page
@app.post("/api/plugins/study-os-solo/prefs")
async def prefs(body: api.Prefs):
    body.class_folder = None
    body.student_id = None
    return await api.prefs(body)


app.include_router(api.router, prefix="/api/plugins/study-os-solo")


@app.get("/api/space")
def space_info(request: Request):
    d = request.scope["device"]
    r = room_of(d)
    name = here.get().me["name"]
    n = 0
    if not r["joined"]:
        n = len(E["store"].rows("select 1 from students"))
    return {"device": student_id(d)[:6].upper(), "code": r["code"], "joined": r["joined"], "name": name, "students": n, "link": f"{PUBLIC}/app?class={r['code']}" if r["code"] else None}


@app.post("/api/space/open")
def open_class(request: Request):
    d = request.scope["device"]
    with lock, meta() as c:
        c.execute("update devices set room = null where id = ?", (d,))
        r = c.execute("select code from rooms where owner = ?", (d,)).fetchone()
        code = r["code"] if r else "".join(secrets.choice(ALPHABET) for _ in range(6))
        if not r:
            c.execute("insert into rooms (code, owner, made) values (?, ?, ?)", (code, d, time.time()))
    return space_info(request)


tries: dict[str, list[float]] = {}


@app.post("/api/space/join/{code}")
def join(code: str, request: Request):
    d = request.scope["device"]
    t = time.time()
    tries[d] = [x for x in tries.get(d, []) if t - x < 600]
    if len(tries[d]) > 15:
        return JSONResponse({"detail": "Too many tries. Wait a few minutes."}, 429)
    tries[d].append(t)
    code = re.sub(r"[^A-Z0-9]", "", code.upper())[:6]
    with meta() as c:
        r = c.execute("select owner from rooms where code = ?", (code,)).fetchone()
        if not r:
            return JSONResponse({"detail": "No class has that code."}, 404)
        if r["owner"] == d:
            return JSONResponse({"detail": "That's your own class. Open the link on another device."}, 400)
        c.execute("update devices set room = ? where id = ?", (code, d))
    return {"ok": True}


@app.post("/api/space/leave")
def leave(request: Request):
    with meta() as c:
        c.execute("update devices set room = null where id = ?", (request.scope["device"],))
    return {"ok": True}


@app.post("/api/space/forget")
def forget(request: Request):
    """Deletes everything this device has here."""
    d = request.scope["device"]
    with meta() as c:
        c.execute("delete from rooms where owner = ?", (d,))
        c.execute("delete from devices where id = ?", (d,))
    shutil.rmtree(DATA / "devices" / d, ignore_errors=True)
    r = JSONResponse({"ok": True})
    r.delete_cookie("so_device", path="/")
    return r


@app.get("/app/qr.svg")
def qr(request: Request):
    import segno

    code = room_of(request.scope["device"])["code"]
    b = io.BytesIO()
    segno.make(f"{PUBLIC}/app?class={code}" if code else f"{PUBLIC}/app", error="m").save(b, kind="svg", border=1, scale=8, dark="#121212", light="#ffffff")
    return Response(b.getvalue(), media_type="image/svg+xml")


@app.api_route("/app", methods=["GET", "HEAD"])
def page():
    return FileResponse(ROOT / "web" / "static" / "index.html")


@app.get("/healthz")
def health():
    return {"ok": True}


app.mount("/app/static", StaticFiles(directory=ROOT / "web" / "static"), name="static")
if SITE.is_dir():
    app.mount("/", StaticFiles(directory=SITE, html=True), name="site")

from web.model import Claude  # noqa: E402

E["llm"].use(Claude())
