"""A video as one HyperFrames composition (https://hyperframes.heygen.com): a page whose every frame is a function of
time. The same file plays live inside Hermes and renders to MP4 with `npx hyperframes render`. Flat colour blocks, ink
outlines and hard shadows, in the Study OS look. No network, no libraries."""

from __future__ import annotations

import base64
import hashlib
import html
import json
from functools import lru_cache
from pathlib import Path

SIZES = {"explainer": (1920, 1080), "short": (1080, 1920), "slides": (1920, 1080)}
INK = "#121212"
# block colour, its text, its accent, the card on it
BLOCKS = [("#2f3cdc", "#ffffff", "#ffc93c", "#8f9cff"), ("#ffc93c", INK, "#2f3cdc", "#f39ac3"), ("#f39ac3", INK, "#2f3cdc", "#ffc93c"), ("#faf8f3", INK, "#d7322a", "#8f9cff"), ("#1a7748", "#ffffff", "#ffc93c", "#f39ac3"), ("#f26b2e", INK, "#faf8f3", "#ffc93c"), ("#8f9cff", INK, "#d7322a", "#ffc93c")]


@lru_cache
def fonts() -> str:
    d = Path(__file__).resolve().parent.parent / "assets"
    def face(name: str, file: str, weight: str) -> str:
        return f"@font-face{{font-family:'{name}';src:url(data:font/woff2;base64,{base64.b64encode((d / file).read_bytes()).decode()}) format('woff2');font-weight:{weight}}}"
    try:
        return face("SO Inter", "inter.woff2", "100 900") + face("SO Mono", "space-mono.woff2", "400")
    except OSError:
        return ""


CSS = """
*{margin:0;padding:0;box-sizing:border-box}html,body{width:%(w)dpx;height:%(h)dpx;overflow:hidden;background:#faf8f3;color:#121212;font-family:'SO Inter',Inter,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
#root{position:relative;width:%(w)dpx;height:%(h)dpx;overflow:hidden}
.scene{position:absolute;inset:0;overflow:hidden;background:var(--bg);color:var(--ink)}
.in{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:%(pad)s}
.art{position:absolute;inset:0}.art>*{position:absolute;border:%(ln)dpx solid #121212}
.mark{position:absolute;left:%(mx)dpx;top:%(my)dpx;border:%(ln)dpx solid #121212;background:#fff;color:#121212;padding:.28em .6em;font-size:%(s)dpx;font-weight:800;letter-spacing:.05em;z-index:4}.mark b{font-weight:500;color:#2f3cdc}
.kick{font-family:'SO Mono',monospace;font-size:%(s)dpx;letter-spacing:.06em;text-transform:uppercase;margin-bottom:1em}
h1{font-size:%(xl)dpx;line-height:.9;letter-spacing:-.055em;font-weight:800;text-transform:uppercase;text-wrap:balance}h2{font-size:%(l)dpx;line-height:.94;letter-spacing:-.05em;font-weight:800;text-transform:uppercase;text-wrap:balance;margin-bottom:.6em}
.w{display:inline-block;white-space:pre}.w.hi{color:var(--ac)}.big{font-size:%(xxl)dpx;line-height:.86;letter-spacing:-.07em;font-weight:800;text-transform:uppercase;overflow-wrap:anywhere}.sub{font-size:%(m)dpx;line-height:1.25;margin-top:.8em;max-width:24em;font-weight:500}
.list{display:flex;flex-direction:column;gap:%(gap)dpx;align-items:flex-start}.item{display:flex;gap:%(gap)dpx;align-items:center;font-size:%(m)dpx;line-height:1.15;background:#fff;color:#121212;border:%(ln)dpx solid #121212;border-radius:%(r)dpx;box-shadow:%(sh)dpx %(sh)dpx 0 #121212;padding:.5em .9em .5em .6em;min-width:52%%}.item b{display:block;font-weight:750;letter-spacing:-.02em}.item small{display:block;font-size:.7em;margin-top:.15em;font-weight:450}
.n{flex:none;width:1.55em;height:1.55em;border-radius:50%%;display:grid;place-items:center;background:var(--cd);border:%(ln)dpx solid #121212;font-weight:800;color:#121212}.dot{flex:none;width:.85em;height:.85em;border-radius:50%%;background:var(--cd);border:%(ln)dpx solid #121212}
.cols{display:flex;flex-direction:%(dir)s;gap:%(gap2)dpx}.col{flex:1;border-radius:%(r)dpx;padding:1em;background:#fff;color:#121212;border:%(ln)dpx solid #121212;box-shadow:%(sh)dpx %(sh)dpx 0 #121212;font-size:%(m)dpx}.col:nth-child(2n){background:var(--cd)}.col b{display:block;font-size:1.15em;letter-spacing:-.03em;margin-bottom:.35em;font-weight:800}.col small{font-size:.78em;line-height:1.3;font-weight:500}
.ring{width:1.6em;height:1.6em;border-radius:50%%;border:%(ln2)dpx solid #121212;background:var(--ac);display:grid;place-items:center;font-weight:800;font-size:%(xl)dpx;margin-bottom:.35em;color:#121212;box-shadow:%(sh)dpx %(sh)dpx 0 #121212}
.cap{position:absolute;left:6%%;right:6%%;bottom:%(capb)dpx;text-align:center;z-index:50}.cap span{display:inline-block;background:#121212;color:#fff;border-radius:%(r)dpx;padding:.42em .8em;font-size:%(cap)dpx;font-weight:650;line-height:1.25;text-wrap:balance}.cap i{font-style:normal;opacity:.42}.cap i.on{opacity:1}
.bar{position:absolute;left:0;bottom:0;height:%(barh)dpx;background:#121212;width:100%%;transform-origin:0 50%%;z-index:60}
"""

# Every frame from the time alone: block wipes, entrances, drifting shapes, captions, progress. It answers to the same
# calls as a paused GSAP timeline, which is what HyperFrames drives.
JS = """
(function(){
var F=window.__film,D=F.duration,root=document.getElementById('root'),now=0;
var ease=function(p){p=p<0?0:p>1?1:p;return 1-Math.pow(1-p,4)},back=function(p){p=p<0?0:p>1?1:p;var q=p-1;return 1+2.2*q*q*q+1.2*q*q};
var scenes=[].map.call(root.querySelectorAll('.scene'),function(el,i){return{el:el,i:i,s:+el.dataset.start,d:+el.dataset.duration,parts:[].map.call(el.querySelectorAll('[data-in]'),function(x){return{el:x,at:+x.dataset.in,k:x.dataset.k||'up'}}),art:[].map.call(el.querySelectorAll('.art>*'),function(x){return{el:x,p:+x.dataset.p,v:+x.dataset.v}})}});
var caps=[].map.call(root.querySelectorAll('.cap'),function(el){return{el:el,s:+el.dataset.start,d:+el.dataset.duration,w:[].slice.call(el.querySelectorAll('i'))}});
var bar=root.querySelector('.bar');
function draw(t){now=t=Math.max(0,Math.min(D,t));
 scenes.forEach(function(c){var l=t-c.s,last=c.i===scenes.length-1,on=l>=0&&(l<c.d+.5||last);c.el.style.visibility=on?'visible':'hidden';if(!on)return;
  var e=c.i?ease(l/.5):1,v=(1-e)*100;c.el.style.clipPath=e>=1?'none':c.i%3===0?'inset(0 0 '+v+'% 0)':c.i%3===1?'inset(0 0 0 '+v+'%)':'circle('+(e*125)+'% at 12% 88%)';
  c.art.forEach(function(a){var q=t*a.v+a.p*6.28,g=back(l/.8-a.p*.25);a.el.style.transform='translate('+(Math.sin(q)*F.w*.014)+'px,'+(Math.cos(q*1.2)*F.h*.018)+'px) rotate('+(q*9*(a.p>.5?1:-1))+'deg) scale('+g+')'});
  c.parts.forEach(function(p){var x=l-p.at,f=ease(x/.55);p.el.style.opacity=x>0?1:0;p.el.style.transform=p.k==='pop'?'scale('+Math.max(0,back(x/.6))+') rotate('+((1-f)*-5)+'deg)':p.k==='side'?'translateX('+((1-f)*-F.w*.09)+'px) rotate('+((1-f)*-3)+'deg)':'translateY('+((1-f)*F.h*.07)+'px)'})});
 caps.forEach(function(c){var l=t-c.s,on=l>=0&&l<c.d;c.el.style.visibility=on?'visible':'hidden';if(on){var n=Math.floor(l/c.d*c.w.length+.6);c.w.forEach(function(w,i){w.className=i<=n?'on':''})}});
 if(bar)bar.style.transform='scaleX('+(t/D)+')';}
var tl={seek:function(t){if(typeof t==='number')draw(t);return tl},time:function(t){if(t===undefined)return now;draw(t);return tl},totalTime:function(t){if(t===undefined)return now;draw(t);return tl},progress:function(p){if(p===undefined)return now/D;draw(p*D);return tl},
 duration:function(){return D},totalDuration:function(){return D},pause:function(t){if(typeof t==='number')draw(t);return tl},play:function(){return tl},paused:function(){return true},kill:function(){return tl},timeScale:function(){return 1},add:function(){return tl},getChildren:function(){return[]},isActive:function(){return false},render:function(t){draw(t);return tl}};
window.__timelines=window.__timelines||{};window.__timelines.main=tl;draw(0);
window.addEventListener('message',function(e){if(e.data&&typeof e.data.t==='number')draw(e.data.t)});
if(window.parent!==window)window.parent.postMessage({film:'ready'},'*');
})();
"""


def _words(text: str, at: float, step: float = 0.06, hi: bool = True) -> str:
    ws = text.split()
    last = max(1, len(ws) - max(1, len(ws) // 3))
    return " ".join(f'<span class="w{" hi" if hi and len(ws) > 1 and i >= last else ""}" data-in="{at + i * step:.2f}">{html.escape(w)}</span>' for i, w in enumerate(ws))


def _scene(s: dict) -> str:
    kind, head, items = s["kind"], s["heading"], s["items"]
    e = html.escape
    if kind == "title":
        kick = f'<div class="kick" data-in="0.1">{e(s.get("kicker") or "")}</div>' if s.get("kicker") else ""
        return f'{kick}<h1>{_words(head, 0.2)}</h1>' + (f'<p class="sub" data-in="0.8">{e(items[0]["label"])}</p>' if items else "")
    if kind == "big":
        return f'<div class="big" data-in="0.15" data-k="pop">{e(head)}</div>' + "".join(f'<p class="sub" data-in="{0.6 + i * 0.3:.2f}">{e(x["label"])}</p>' for i, x in enumerate(items[:2]))
    if kind == "question":
        long = len(head) > 46
        return f'<div><div class="ring" data-in="0.15" data-k="pop"{" style=zoom:.55" if long else ""}>?</div></div><h1{" style=zoom:.86" if long else ""}>{_words(head, 0.35)}</h1>'
    if kind == "compare":
        cols = "".join(f'<div class="col" data-in="{0.55 + i * 0.35:.2f}" data-k="pop"><b>{e(x["label"])}</b><small>{e(x["note"])}</small></div>' for i, x in enumerate(items[:3]))
        return f'<h2>{_words(head, 0.15)}</h2><div class="cols">{cols}</div>'
    step = max(0.45, min(1.6, (s["duration"] - 2.2) / max(1, len(items))))
    mark = (lambda i: f'<span class="n">{i + 1}</span>') if kind == "steps" else (lambda i: '<span class="dot"></span>')
    rows = "".join(f'<div class="item" data-in="{0.7 + i * step:.2f}" data-k="side">{mark(i)}<div><b>{e(x["label"])}</b>{"<small>" + e(x["note"]) + "</small>" if x["note"] else ""}</div></div>' for i, x in enumerate(items[:5]))
    return f'<h2>{_words(head, 0.15)}</h2><div class="list">{rows}</div>'


def _art(n: int, w: int, h: int, u: float, accent: str, card: str) -> str:
    """Flat shapes at the edge of a scene, placed from the seed."""
    size = int(min(w, h) * 0.36)
    spots = [(w - size * 0.72, -size * 0.3), (w - size * 0.9, h - size * 0.62), (w * 0.62, -size * 0.5)] if w > h else [(w - size * 0.62, -size * 0.2), (w - size * 0.5, h * 0.67), (-size * 0.5, h * 0.72)]
    x1, y1 = spots[n % 3]
    x2, y2 = spots[(n + 1) % 3]
    b = int(size * 0.55)
    kinds = [f"border-radius:50%;background:{accent}", f"background:{card};border-radius:{int(size * .12)}px", f"border-radius:50% 50% 0 0;background:{accent}", f"border-radius:50%;background:transparent;border-width:{int(size * .14)}px;border-color:{card}"]
    return (
        f'<div class="art"><div data-p="{(n * 37 % 100) / 100}" data-v="0.35" style="left:{x1:.0f}px;top:{y1:.0f}px;width:{size}px;height:{size}px;{kinds[n % 4]}"></div>'
        f'<div data-p="{(n * 61 % 100) / 100}" data-v="0.5" style="left:{x2:.0f}px;top:{y2 + (0 if h > w else size * .2):.0f}px;width:{b}px;height:{b}px;{kinds[(n + 1) % 4].replace(str(int(size * .14)), str(int(b * .16)))}"></div></div>'
    )


def build(film: dict, *, audio: bool = False) -> str:
    """The composition. With `audio`, it plays voice/<n>.wav beside it (for rendering); the page plays them itself."""
    w, h = SIZES[film["format"]]
    tall = h > w
    u = w / 1080 if tall else h / 1080
    seed = int(hashlib.sha256(film["seed"].encode()).hexdigest()[:6], 16)
    slides = film["format"] == "slides"
    v = {
        "w": w, "h": h, "pad": f"{int(190 * u)}px {int(80 * u)}px {int(430 * u)}px" if tall else f"{int(110 * u)}px {int(440 * u)}px {int((90 if slides else 180) * u)}px {int(130 * u)}px", "s": int((30 if tall else 27) * u), "m": int((47 if tall else 46) * u),
        "l": int((96 if tall else 100) * u), "xl": int((122 if tall else 142) * u), "xxl": int((200 if tall else 250) * u), "gap": int((26 if tall else 22) * u), "gap2": int(40 * u), "dir": "column" if tall else "row", "capb": int((230 if tall else 56) * u), "cap": int((50 if tall else 37) * u), "barh": int(12 * u),
        "ln": max(3, int(4 * u)), "ln2": int(7 * u), "r": int(26 * u), "sh": int(9 * u), "mx": int((70 if tall else 60) * u), "my": int((90 if tall else 48) * u),
    }
    t, scenes, caps, sounds = 0.0, [], [], []
    for i, s in enumerate(film["scenes"]):
        d = s["duration"]
        bg, ink, ac, cd = BLOCKS[(seed + i * 3) % len(BLOCKS)]
        scenes.append(f'<section class="scene clip" id="s{i}" data-start="{t:.2f}" data-duration="{d:.2f}" data-track-index="1" data-hf-allow-overflow style="--bg:{bg};--ink:{ink};--ac:{ac};--cd:{cd};z-index:{i + 1}">{_art(seed + i * 5, w, h, u, ac, cd)}<div class="mark">STUDY <b>os</b></div><div class="in">{_scene(s)}</div></section>')
        if not slides:
            words = s["say"].split()
            n = 8 if tall else 11
            chunks = [words[k : k + n] for k in range(0, len(words), n)]
            at, total = t + 0.1, max(1, len(words))
            for c in chunks:
                cdur = max(0.4, (s["spoken"] or d) * len(c) / total)
                caps.append(f'<div class="cap clip" data-start="{at:.2f}" data-duration="{cdur:.2f}" data-track-index="2"><span>{" ".join(f"<i>{html.escape(x)}</i>" for x in c)}</span></div>')
                at += cdur
        if audio and s.get("sound"):
            sounds.append(f'<audio id="a{i}" class="clip" src="{s["sound"]}" data-start="{t + 0.1:.2f}" data-duration="{s["spoken"]:.2f}" data-track-index="3" data-volume="1"></audio>')
        t += d
    meta = json.dumps({"duration": round(t, 2), "w": w, "h": h})
    return (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width={w}, height={h}"><title>{html.escape(film["title"])}</title><style>{fonts()}{CSS % v}</style></head><body>'
        f'<div id="root" data-composition-id="main" data-start="0" data-duration="{t:.2f}" data-width="{w}" data-height="{h}">{"".join(scenes)}{"".join(caps)}{"".join(sounds)}<div class="bar"></div></div>'
        f"<script>window.__film={meta};</script><script>{JS}</script></body></html>"
    )
