"""Study OS Solo's routes for Hermes Desktop, at /api/plugins/study-os-solo. They only touch this computer's SQLite file,
the model Hermes is set to, and the optional services in engine/services.py."""

import importlib.util
import sys
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

ROOT = Path(__file__).resolve().parent.parent
NAME = "study_os_solo_engine"


def _engine():
    if NAME not in sys.modules:
        spec = importlib.util.spec_from_file_location(NAME, ROOT / "engine" / "__init__.py", submodule_search_locations=[str(ROOT / "engine")])
        mod = importlib.util.module_from_spec(spec)
        sys.modules[NAME] = mod
        spec.loader.exec_module(mod)
    return {n: importlib.import_module(f"{NAME}.{n}") for n in ("courses", "ingest", "llm", "quiz", "services", "store", "prompts", "media", "tutor", "voice", "essay")}


_m = _engine()
courses, ingest, llm, quiz, services, store, prompts, media, tutor, voice, essay = _m.values()
router = APIRouter()


async def call(fn, *a, **k):
    """Runs the engine off the event loop; a problem for the learner becomes a 400 with its words."""
    try:
        return await run_in_threadpool(fn, *a, **k)
    except (courses.Problem, llm.ModelError, services.ServiceError) as err:
        raise HTTPException(400, str(err)) from None


class NewCourse(BaseModel):
    topic: str | None = Field(None, max_length=300)
    text: str | None = Field(None, max_length=200_000)
    upload_id: str | None = Field(None, max_length=40)
    how: dict = {}


class Next(BaseModel):
    course_id: str | None = None
    section_id: str | None = None
    asked: list[str] = Field([], max_length=500)
    due_only: bool = False


class Answer(BaseModel):
    question_id: str
    option: int | None = None
    text: str | None = Field(None, max_length=400)
    tries: int = 1
    hints: int = 0
    give_up: bool = False


class Text(BaseModel):
    text: str = Field(max_length=8000)


class Change(BaseModel):
    action: str
    how: dict = {}
    version_id: str | None = None


class Prefs(BaseModel):
    level: int | None = None
    story: str | None = None
    compare_to: str | None = Field(None, max_length=40)
    want: list[str] | None = Field(None, max_length=20)


@router.get("/home")
async def home():
    def work():
        cs = courses.list_courses()
        return {
            "courses": cs, "due": sum(c["due"] for c in cs), "streak": quiz.streak(), "prefs": store.get_prefs(), "services": services.status(),
            "levels": [{"value": k, "label": v} for k, v in prompts.LEVELS.items()], "stories": [{"value": k, "label": v} for k, v in prompts.STORIES.items()],
        }

    return await call(work)


@router.post("/courses")
async def make(body: NewCourse):
    def work():
        u = ingest.upload(body.upload_id) if body.upload_id else None
        cid = courses.create(topic=body.topic, material=u["text"] if u else body.text, name=u["name"] if u else None, how=body.how)
        return {"id": cid}

    return await call(work)


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    data = await file.read(ingest.MAX_BYTES + 1)
    return await call(ingest.save_upload, file.filename or "file", data)


@router.get("/courses/{course_id}")
async def course(course_id: str, section: str | None = None):
    def work():
        courses.opened(course_id, section)
        return courses.get(course_id)

    return await call(work)


@router.post("/courses/{course_id}/retry")
async def retry(course_id: str):
    await call(courses.retry, course_id)
    return {"ok": True}


@router.delete("/courses/{course_id}")
async def remove(course_id: str):
    return {"ok": await call(courses.delete, course_id)}


@router.get("/sections/{section_id}/wordings")
async def wordings(section_id: str):
    return await call(courses.wordings, section_id)


@router.post("/sections/{section_id}/wordings")
async def change(section_id: str, body: Change):
    def work():
        if body.action == "preview":
            courses.preview(section_id, body.how)
        elif body.action == "use":
            courses.use_version(section_id)
        elif body.action == "discard":
            courses.discard(section_id)
        elif body.action == "restore" and body.version_id:
            courses.use_version(section_id, body.version_id)
        else:
            raise courses.Problem("Unknown change.")
        return courses.wordings(section_id)

    return await call(work)


@router.post("/sections/{section_id}/explain-back")
async def explain(section_id: str, body: Text):
    return await call(quiz.explain_back, section_id, body.text, services.pangram if services.status()["pangram"] else None)


@router.post("/quiz/next")
async def next_question(body: Next):
    return {"question": await call(quiz.next_question, **body.model_dump())}


@router.get("/quiz/hint/{question_id}")
async def hint(question_id: str):
    return {"hint": await call(quiz.hint, question_id)}


@router.post("/quiz/answer")
async def answer(body: Answer):
    return await call(quiz.answer, body.question_id, **body.model_dump(exclude={"question_id"}))


@router.get("/progress")
async def progress():
    return await call(quiz.progress)


class Speak(BaseModel):
    text: str = Field(max_length=8000)
    who: str = "a"


class Make(BaseModel):
    kind: str
    render: bool = False


class Turn(BaseModel):
    text: str = Field("", max_length=2000)
    history: list[dict] = Field([], max_length=60)


class Draft(BaseModel):
    text: str = Field(max_length=24_000)
    task: str = Field("", max_length=800)


@router.post("/speak")
async def speak(body: Speak):
    return await call(voice.speak, body.text, body.who)


@router.get("/sections/{section_id}/media")
async def media_list(section_id: str):
    return {"media": await call(media.listing, section_id), "can": media.export_ready()}


@router.post("/sections/{section_id}/media")
async def media_make(section_id: str, body: Make):
    await call(media.make, section_id, body.kind)
    return {"ok": True}


@router.get("/sections/{section_id}/film/{kind}")
async def film(section_id: str, kind: str):
    return await call(media.film_html, section_id, kind)


@router.post("/sections/{section_id}/export")
async def export(section_id: str, body: Make):
    return await call(media.export, section_id, body.kind, body.render)


@router.get("/sections/{section_id}/ear-quiz")
async def ear_quiz(section_id: str):
    return await call(media.ear_quiz, section_id)


@router.post("/sections/{section_id}/talk")
async def talk(section_id: str, body: Turn):
    return await call(tutor.turn, section_id, body.text, body.history)


@router.post("/hear")
async def hear(file: UploadFile = File(...)):
    return {"text": await call(voice.hear, await file.read(20_000_000))}


@router.post("/essay")
async def essay_check(body: Draft):
    return await call(essay.check, body.text, body.task)


@router.post("/essay/ab")
async def essay_ab(body: Draft):
    return await call(essay.ab, body.text, body.task)


@router.post("/prefs")
async def prefs(body: Prefs):
    def work():
        ch = {k: v for k, v in body.model_dump().items() if v is not None}
        if ch.get("level", 10) not in prompts.LEVELS or ch.get("story", "plain") not in prompts.STORIES:
            raise courses.Problem("Unknown setting.")
        if "want" in ch:
            ch["want"] = [w.strip()[:40] for w in ch["want"] if w.strip()]
        return store.set_prefs(ch)

    return await call(work)
