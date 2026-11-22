"""A small game where the learner works the idea with their hands. One self-contained page, run in a frame that can't reach
the app, the network or anything on this computer."""

from __future__ import annotations

import re

from . import llm, prompts
from .courses import Problem

RULES = f"""You make one small, beautiful, playable game that teaches one idea by letting the learner work the real mechanism with their hands.
The mechanism is the toy: dragging, pouring, aiming, growing, balancing, timing. Never a quiz, never matching words, never clicking labels.

Reply with one complete HTML document and nothing else. Hard rules:
- Self-contained: inline CSS and JS only. No external files, fonts, images, network, storage, alerts, audio, eval or workers.
- One full-window <canvas> drawn with requestAnimationFrame and delta time, resized to window.innerWidth/innerHeight with devicePixelRatio (cap 2). Works at 900x560 and at 360x520. Pointer events (mouse and touch), and it must be obvious what to grab.
- Look: warm paper background #faf8f3, ink #121212 outlines 3px, flat pop colours #2f3cdc #ffc93c #f39ac3 #8f9cff #f26b2e #1a7748. Chunky rounded shapes with hard offset shadows, like printed stickers. Everything moves: easing, squash and stretch, particles, trails, a little screen shake on big moments. Smooth at 60 fps (under 400 particles).
- Scenery that shows the real thing (a flame, a cell, a planet), drawn with paths and gradients, not boxes with words. Text on screen under 12 words at a time, 18px or bigger, system-ui bold.
- A live readout of the one quantity that matters (a gauge, a fill, a glow), changing as they play.
- Opens straight into play with a 1-line goal at the top and an animated hint (a pulsing ring or a ghost hand) on what to drag. No menu, no start button.
- Three levels, each a bit harder and each showing one more part of the idea. Winning a level: a burst of confetti, one short line on what just happened, then the next level starts by itself after 2 seconds. After level 3: a big finish and a "Play again" button. It must be winnable in under 90 seconds and impossible to get stuck; if they fail, reset gently and say why in a few words.
- The science must be right and the win must need using it.
- When a level is won call parent.postMessage({{game:"level",level:n}},"*"); when all are won parent.postMessage({{game:"won"}},"*").
- Under 420 lines. No emoji.
{prompts.HOUSE}"""

GUARD = "<script>window.onerror=function(m,s,l){parent.postMessage({game:'error',text:String(m)+' line '+l},'*')};window.addEventListener('unhandledrejection',function(e){parent.postMessage({game:'error',text:String(e.reason)},'*')});</script><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:\">"


def clean(html: str) -> str:
    m = re.search(r"<!doctype html.*</html>|<html.*</html>", html, flags=re.S | re.I)
    html = (m.group(0) if m else html).strip()
    if "<canvas" not in html.lower() and "createElement('canvas')" not in html and 'createElement("canvas")' not in html:
        raise Problem("The game came back without a picture. Try again.")
    if "requestAnimationFrame" not in html or not html.rstrip().lower().endswith("</html>"):
        raise Problem("The game came back unfinished. Try again.")
    if len(html) > 120_000:
        raise Problem("The game came back too big. Try again.")
    if re.search(r"<head[^>]*>", html, flags=re.I):
        return re.sub(r"(<head[^>]*>)", lambda h: h.group(1) + GUARD, html, count=1, flags=re.I)
    return re.sub(r"(<html[^>]*>)", lambda h: h.group(1) + "<head>" + GUARD + "</head>", html, count=1, flags=re.I)


def make(s: dict, goals: list[str]) -> dict:
    ask = f"{prompts.learner({'level': s['level'], 'story': 'plain', 'compare_to': ''})}\n\n<lesson course=\"{s['course']}\" title=\"{s['title']}\">\n{s['body'][:5000]}\n</lesson>\nGoals:\n" + "\n".join(f"- {g}" for g in goals)
    html = clean(llm.text(RULES, ask, max_tokens=14000, purpose="game", wait=420))
    t = re.search(r"<title>([^<]{2,80})</title>", html, flags=re.I)
    return {"title": (t.group(1).strip() if t else s["title"]), "html": html}


def fix(html: str, error: str) -> str:
    bare = html.replace(GUARD, "")
    return clean(llm.text(RULES, f"This game stops with an error: {error[:200]}\nReturn the whole corrected document.\n\n{bare}", max_tokens=14000, purpose="game", wait=420))
