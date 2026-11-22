"""The agent's tools. Each takes (args) and returns a JSON string; a problem comes back as {"error": ...}."""

import json
from pathlib import Path

from .engine import courses, ingest, llm, quiz, services


def _tool(fn):
    def handler(args=None, **_):
        try:
            return json.dumps(fn(args or {}), ensure_ascii=False)
        except (courses.Problem, llm.ModelError, services.ServiceError) as err:
            return json.dumps({"error": str(err)})
        except Exception as err:  # noqa: BLE001 - a tool never raises into the agent
            return json.dumps({"error": f"Study OS had a problem: {type(err).__name__}"})

    return handler


def _section(args):
    c = courses.get(str(args.get("course_id", "")))
    n = int(args.get("section") or 1)
    if not 1 <= n <= len(c["list"]):
        raise courses.Problem(f"That course has {len(c['list'])} sections.")
    return c, c["list"][n - 1]


@_tool
def make_course(args):
    text, name = args.get("text"), None
    if args.get("file_path"):
        p = Path(str(args["file_path"])).expanduser()
        if not p.is_file():
            raise courses.Problem("There's no file there.")
        text, _ = ingest.read(p.name, p.read_bytes())
        name = p.name
    cid = courses.create(topic=args.get("topic"), material=text, name=name, how={"level": args["level"]} if args.get("level") else None)
    return {"course_id": cid, "message": "It's being written. Open Study OS in the sidebar, or call study_courses in a minute."}


@_tool
def list_courses(_args):
    return {"courses": [{k: c[k] for k in ("id", "title", "status", "sections", "written", "goals", "mastered", "due")} for c in courses.list_courses()], "streak": quiz.streak()["days"]}


@_tool
def lesson(args):
    c, s = _section(args)
    return {"course": c["title"], "section": s["title"], "goals": [g["label"] for g in s["goals"]], "lesson": s["body"] or "Not written yet.", "terms": s["terms"]}


@_tool
def question(args):
    q = quiz.next_question(course_id=args.get("course_id") or None, asked=args.get("asked") or [], due_only=bool(args.get("due_only")))
    if not q:
        return {"message": "Nothing left to ask here right now."}
    q["options"] = [f"{i + 1}. {o}" for i, o in enumerate(q["options"])] if q["options"] else None
    if q["has_hint"]:
        q["hint_if_they_miss"] = quiz.hint(q["id"])
    return q


@_tool
def answer(args):
    opt = args.get("option")
    return quiz.answer(str(args.get("question_id", "")), option=int(opt) - 1 if opt is not None else None, text=args.get("text"), tries=int(args.get("tries") or 1), hints=int(args.get("hints") or 0), give_up=bool(args.get("give_up")))


@_tool
def explain_back(args):
    _, s = _section(args)
    return quiz.explain_back(s["id"], str(args.get("text", "")), services.pangram if services.status()["pangram"] else None)
