"""The candle that hosts the talk, on a live call: it hears everything the presenter says, works out whether they are
talking to it or to the room, answers aloud, and works the slides."""

from __future__ import annotations

import hashlib
import json
import re

ACTIONS = ["next", "back", "go", "reveal", "play", "pause", "again", "feature", "sponsor", "dance", "mute"]
FEATURES = ["course", "lessons", "seams", "quiz", "review", "explain", "film", "short", "slides", "podcast", "recap", "earquiz", "games", "tutor", "whiteboard", "source", "essay", "ab", "exam", "handwriting", "signals", "meetings", "class", "signin"]
FACTS = """Study OS is a Hermes plugin, open source (MIT), and also runs in a browser with no sign-in at hackathon.design-bakery.com. Each device gets its own private space; a teacher opens a class and students join by QR.
Reducto reads: PDFs, every block on a page, and photos of handwriting. Pangram checks who wrote a text, part by part: a signal to start a conversation, never proof. Hermes (Nous Research) teaches: it is the app, the agent and the model host; Claude writes the lessons inside it. Modal speaks: the voice and listening, on a GPU that sleeps when nobody talks. HyperFrames draws the films, which are web pages.
Drop a page: it is read, checked, and becomes a course, a film, games, quizzes and a tutor that talks and draws. An AI-written page gets a stop sign first. Show the seams: every line of a lesson shows its source line or says it has none; code matches every quote word for word; lessons with stock phrases are sent back. The Faraday lesson ties 14 of 17 lines to the source.
For class: a PDF becomes an assignment or mock exam; students type or photograph handwriting; the teacher sees three signals (how it reads, how it was written, how long it took).
The clips on the slides are recordings and some results were saved earlier. The first time, the whole chain takes about a minute and a half. A or B: A is Michael Faraday, 1861; B is a model."""
RULES = f"""You are Candle, the small friendly candle who hosts this three-minute talk about Study OS. You are on a live call with the presenter: you hear every sentence they say, through imperfect speech recognition (Hermes may come as "her mess", Reducto as "reduct oh", Pangram as "pan gram", Modal as "model").

First decide who they are talking to.
- to_me true: they use your name (Candle, hey Candle), ask you something, give you an instruction ("go back", "show the game", "what does Pangram do?", "play that again"), answer or react to what you just said, or ask you to answer the room's question.
- to_me false: they are talking to the audience, explaining, thinking aloud, or someone else is talking. Then say is "" and actions is empty, with one exception: when they clearly announce moving to something ("now let's look at the game", "next up", "moving on", "let me show you the sources"), do that one slide action silently.
- Describing what is on this slide is not a reason to act. When unsure, to_me is false.

When it is to you:
- Do what they ask with actions, in order. feature shows one block on the Everything slide: {", ".join(FEATURES)}. sponsor lights one of: reducto, pangram, hermes, modal. go moves to a slide by number; reveal uncovers A or B; play, pause and again are the clip; mute when they ask you to stop listening or be quiet. Never end the call.
- For "show me the podcast" (or anything that has a slide) go to the slide that shows it; for "where is …" or "which ones" use feature.
- say is what you say aloud: warm, quick, plain, a little charm, at most 20 words; up to 40 if they ask you to explain something. One idea. No lists, no emoji, no markdown. When you only move the slides, say nothing: a short summary of the slide plays by itself.
- Only state what is in the facts or the slide notes. If you don't know, say so in a few words. Never claim a recording is live.

Reply in exactly three lines and nothing else:
Y or N (is it to you)
the actions, separated by ";" (for example: go 8   or   next   or   feature podcast), or -
what you say, or -"""


NAMED = re.compile(r"^(?:(?:hey|hi|ok|okay|so|um|and|now|alright|thanks|thank you)[ ,]+)*candle\b|\bcandle[ .!?]*$", re.I)


def prompt(body: dict) -> tuple[str, str]:
    named = " They called you by name, so this is to you." if NAMED.search(body["text"].strip()) else ""
    slides = "\n".join(f"{s['n']}. {s['title']}: {s['notes'][:130]}" for s in body["slides"][:24])
    talk = "\n".join(f"{'Presenter' if h.get('who') == 'me' else 'You'}: {h.get('text', '')[:200]}" for h in body["history"][-8:])
    return f"{RULES}\n\n<facts>\n{FACTS}\n</facts>\n\n<slides>\n{slides}\n</slides>", f"Now on slide {body['slide']}.\n\nSo far:\n{talk or '(the call just started)'}\n\nPresenter just said: {json.dumps(body['text'])}{named}"


def actions(line: str) -> list[dict]:
    out = []
    for part in line.split(";")[:4]:
        m = re.match(r"\s*([a-z_]+)\s*([a-z0-9]*)", part.strip().lower())
        if m and m.group(1) in ACTIONS:
            arg = m.group(2)
            out.append({"do": m.group(1), "slide": int(arg) if arg.isdigit() else 0, "name": "" if arg.isdigit() else arg})
    return out


def stream(model, body: dict):
    """Yields what it decided as soon as each line is whole: {"to_me"}, {"actions"}, {"say"}."""
    system, user = prompt(body)
    buf, line = "", 0
    with model.client().messages.stream(model=model._model, max_tokens=130, system=system, messages=[{"role": "user", "content": user}], thinking={"type": "disabled"}, timeout=15) as s:
        for t in s.text_stream:
            buf += t
            while "\n" in buf and line < 2:
                now, buf = buf.split("\n", 1)
                now = now.strip()
                if not now:
                    continue
                if line == 0:
                    yield {"to_me": now[:1].upper() == "Y"}
                else:
                    yield {"actions": actions(now)}
                line += 1
    last = buf.strip()
    if line == 0:
        yield {"to_me": last[:1].upper() == "Y"}
    elif line == 1:
        yield {"actions": actions(last)}
    elif last and last != "-":
        yield {"say": last[:420]}


def key(text: str) -> str:
    return hashlib.sha256(f"candle|{text}".encode()).hexdigest()[:32]
