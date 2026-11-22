"""What the Hermes agent sees."""


def _tool(name, description, properties, required=()):
    return {"name": name, "description": description, "parameters": {"type": "object", "properties": properties, "required": list(required)}}


_S, _I = {"type": "string"}, {"type": "integer"}

MAKE_COURSE = _tool(
    "study_make_course",
    "Make a short course the learner keeps on this computer, from a topic, pasted text, or a local file (PDF, Word, text). It is written in the background; the first lesson is usually ready in a minute or two.",
    {
        "topic": {**_S, "description": "What to learn, e.g. 'how vaccines work'."},
        "text": {**_S, "description": "Material to teach from, pasted in full."},
        "file_path": {**_S, "description": "Absolute path of a file the user asked to learn from."},
        "level": {**_I, "description": "Reading level: 6 to 12 for school grades, 13 undergraduate, 16 graduate."},
    },
)
COURSES = _tool("study_courses", "List the learner's courses with progress, what is due for review, and their streak.", {})
LESSON = _tool("study_lesson", "Read one section of a course, to teach or discuss it.", {"course_id": _S, "section": {**_I, "description": "1 for the first section."}}, ["course_id"])
QUESTION = _tool(
    "study_question",
    "Get the next quiz question, picked for what the learner knows least or is about to forget. Ask it in your own message and wait for their answer; never answer it yourself.",
    {"course_id": {**_S, "description": "Leave out to review every course."}, "due_only": {"type": "boolean", "description": "Only what is due for review."}, "asked": {"type": "array", "items": _S, "description": "Ids already asked in this chat."}},
)
ANSWER = _tool(
    "study_answer",
    "Mark the learner's answer and update their mastery. Pass option (1 to 4) for a choice question, or text for a fill-in. If it comes back not final, give the hint and let them try once more with tries 2.",
    {"question_id": _S, "option": _I, "text": _S, "tries": _I, "hints": _I, "give_up": {"type": "boolean"}},
    ["question_id"],
)
EXPLAIN_BACK = _tool("study_explain_back", "Grade the learner's own explanation of a section and update their mastery. Pass their words exactly.", {"course_id": _S, "section": _I, "text": _S}, ["course_id", "section", "text"])
