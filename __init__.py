"""Study OS Solo for Hermes: the agent's tools. The Desktop page is desktop/plugin.js, its routes are dashboard/plugin_api.py."""

from pathlib import Path

from . import study_schemas as schemas
from . import study_tools as tools
from .engine import llm

TOOLSET = "study-os-solo"


def register(ctx):
    llm.use(ctx.llm)
    try:
        ctx.register_auxiliary_task(llm.TASK, display_name="Study OS", description="Lessons, quizzes, drawings and tutoring", defaults={"reasoning_effort": "low"})
    except Exception:  # noqa: BLE001 - an older Hermes: the main model's own settings are used
        pass
    for name, schema, handler in (
        ("study_make_course", schemas.MAKE_COURSE, tools.make_course),
        ("study_courses", schemas.COURSES, tools.list_courses),
        ("study_lesson", schemas.LESSON, tools.lesson),
        ("study_question", schemas.QUESTION, tools.question),
        ("study_answer", schemas.ANSWER, tools.answer),
        ("study_explain_back", schemas.EXPLAIN_BACK, tools.explain_back),
    ):
        ctx.register_tool(name=name, toolset=TOOLSET, schema=schema, handler=handler)
    ctx.register_skill("study", Path(__file__).parent / "skills" / "study" / "SKILL.md")
