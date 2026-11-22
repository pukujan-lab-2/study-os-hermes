"""A small game where the learner works the idea with their hands. The model writes the game; toolkit.js gives every one
the same stage, light, particles, dragging and celebration. It runs in a frame that can't reach the app, the network or
anything on this computer."""

from __future__ import annotations

import re
from pathlib import Path

from . import llm, prompts
from .courses import Problem

RULES = f"""You make one small, beautiful, playable game that teaches one idea by letting the learner work the real mechanism with their hands.
The mechanism is the toy: dragging, pouring, aiming, growing, balancing, timing. Never a quiz, never matching words, never clicking labels.

A toolkit G is already loaded. Reply with only JavaScript that uses it: no HTML, no imports, no comments longer than a few words.
Stage: the world is G.W wide and G.H high (about 900x560, or tall on phones when G.tall); place things relative to G.W and G.H. c = G.c is the 2D canvas context. G.t seconds, G.dt, G.level (1 to 3), G.pointer {{x,y,down,vx,vy}}.
Scene: G.room(topColor,bottomColor,floorColor) or G.night(floorColor) first in draw, filling the screen. G.glow(x,y,r,color,alpha). G.flame(x,y,size,heat 0..1). G.box(x,y,w,h,radius,fill), G.ball(x,y,r,fill), G.sticker(path=>{{path.moveTo..}},fill,{{box:[x,y,w,h]}}) draw outlined stickers with a hard shadow. G.grad(x,y,x2,y2,colorA,colorB). G.text(s,x,y,size,color,align), G.label(s,x,y). Colours: G.colors.blue yellow pink sky orange green ink paper.
Motion: G.puff(x,y,{{n,kind,color,size,speed,angle,spread,gravity,life,around}}) and G.stream(x,y,ratePerSecond,sameOptions); kinds 'spark' 'smoke' 'bubble' 'drop' 'star' 'dot'. G.shake(n). G.ease(p) G.lerp(a,b,p) G.clamp(v,a,b) G.rand(a,b) G.dist(x,y,x2,y2).
Dragging: const b = G.drag('id', startX, startY, radius, b=>{{ clamp b.x b.y }}) every frame; read b.x b.y b.held. G.place('id',x,y). Draw it inside G.squashed(b, ()=>{{...}}).
Play: G.goal(text) (under 8 words), G.gauge(value0to1,label,color,[lo,hi] target zone), G.hint(x,y,toX,toY) once per level, G.toast(text), G.win(text under 7 words), G.fail(text), G.playing(). G.lesson(text under 12 words) for the end screen.
Structure: let state; G.onLevel = n => {{ set up state for level n, call G.goal and G.hint }}; G.run(dt => {{ update }}, c => {{ draw }});

Make it wonderful:
- A full scene that shows the real thing (a candle in a dark room, a cell in water, a planet in space), built from paths, gradients and glow. Dark scenes with light look best when something burns, shines or flows. Nothing floating on an empty page.
- 40 to 120 moving things at once (molecules, drops, sparks, cells) that obey the idea: show the invisible part that makes it work, and let the learner see it change as they drag.
- Constant life: wobble, drift, steam, glow that follows the state. Immediate, juicy response to every drag.
- Three levels that add one new part of the idea each. Each is winnable in 10 to 25 seconds by doing the right physical thing, and needs the idea. Hold a state for about 2 seconds to win, shown in the gauge. Failing resets gently.
- The science must be right. Under 170 lines. No emoji.
{prompts.HOUSE}"""

GUARD = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:\"><script>window.onerror=function(m,s,l){parent.postMessage({game:'error',text:String(m)+' line '+l},'*')};</script>"
_BAD = re.compile(r"\b(fetch|XMLHttpRequest|WebSocket|importScripts|eval|localStorage|sessionStorage|indexedDB|document\.cookie)\b|https?://", re.I)


def clean(js: str) -> str:
    m = re.search(r"```(?:javascript|js)?\s*\n(.*?)\n```", js, flags=re.S)
    js = (m.group(1) if m else js).strip()
    if "G.run(" not in js or "G.win(" not in js or js.count("{") != js.count("}"):
        raise Problem("The game came back unfinished. Try again.")
    if len(js) > 60_000 or _BAD.search(js) or "</script" in js.lower():
        raise Problem("The game came back in a shape that can't run here. Try again.")
    return js


def page(js: str) -> str:
    kit = (Path(__file__).parent / "toolkit.js").read_text(encoding="utf-8")
    return f"<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">{GUARD}</head><body><script>{kit}</script><script>{js}</script></body></html>"


def make(s: dict, goals: list[str]) -> dict:
    ask = f"{prompts.learner({'level': s['level'], 'story': 'plain', 'compare_to': ''})}\n\n<lesson course=\"{s['course']}\" title=\"{s['title']}\">\n{s['body'][:5000]}\n</lesson>\nGoals:\n" + "\n".join(f"- {g}" for g in goals)
    for attempt in range(2):
        try:
            return {"title": s["title"], "js": clean(llm.text(RULES, ask, max_tokens=12000, purpose="game", wait=420))}
        except Problem:
            if attempt:
                raise
    raise Problem("The game came back unfinished. Try again.")


def fix(js: str, error: str) -> str:
    return clean(llm.text(RULES, f"This game stops with an error: {error[:200]}\nReturn the whole corrected JavaScript.\n\n{js}", max_tokens=12000, purpose="game", wait=420))
