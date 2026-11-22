"""A video as one HyperFrames composition (https://hyperframes.heygen.com): a page whose every frame is a function of
time. The same file plays live inside Hermes and renders to MP4 with `npx hyperframes render`. No network, no libraries."""

from __future__ import annotations

import colorsys
import hashlib
import html
import json

SIZES = {"explainer": (1920, 1080), "short": (1080, 1920), "slides": (1920, 1080)}

CSS = """
*{margin:0;padding:0;box-sizing:border-box}html,body{width:%(w)dpx;height:%(h)dpx;overflow:hidden;background:%(bg)s;color:%(ink)s;font-family:Inter,"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
#root{position:relative;width:%(w)dpx;height:%(h)dpx;overflow:hidden}
.blob{position:absolute;border-radius:50%%;filter:blur(%(blur)dpx);opacity:.72}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:%(pad)s;will-change:opacity,transform}
.kick{font-size:%(s)dpx;letter-spacing:.14em;text-transform:uppercase;color:%(a)s;font-weight:700;margin-bottom:.9em}
h1{font-size:%(xl)dpx;line-height:1.0;letter-spacing:-.045em;font-weight:800;text-wrap:balance}h2{font-size:%(l)dpx;line-height:1.06;letter-spacing:-.035em;font-weight:800;text-wrap:balance;margin-bottom:.75em}
.w{display:inline-block;white-space:pre}.big{font-size:%(xxl)dpx;line-height:.95;letter-spacing:-.06em;font-weight:800;color:%(a)s}.sub{font-size:%(m)dpx;line-height:1.3;color:%(soft)s;margin-top:.8em;max-width:26em}
.list{display:flex;flex-direction:column;gap:%(gap)dpx}.item{display:flex;gap:%(gap)dpx;align-items:center;font-size:%(m)dpx;line-height:1.2}.item b{display:block;font-weight:700}.item span{display:block;color:%(soft)s;font-size:.78em;margin-top:.18em}
.item .n{flex:none;width:1.7em;height:1.7em;margin:0;border-radius:50%%;display:grid;place-items:center;background:%(a)s;color:%(bg)s;font-weight:800;font-size:1em}.item .dot{flex:none;width:.5em;height:.5em;margin:0;border-radius:50%%;background:%(a)s}
.cols{display:flex;flex-direction:%(dir)s;gap:%(gap)dpx}.col{flex:1;border-radius:%(gap)dpx;padding:1.1em;background:%(card)s;font-size:%(m)dpx}.col b{display:block;font-size:1.15em;letter-spacing:-.02em;margin-bottom:.4em;color:%(a)s}.col span{color:%(soft)s;font-size:.85em;line-height:1.35}
.ring{width:1.7em;height:1.7em;border-radius:50%%;border:.14em solid %(a)s;display:grid;place-items:center;color:%(a)s;font-weight:800;font-size:%(xl)dpx;margin-bottom:.4em}
.cap{position:absolute;left:8%%;right:8%%;bottom:%(capb)dpx;text-align:center;font-size:%(cap)dpx;font-weight:700;line-height:1.25;text-wrap:balance;z-index:5}.cap i{font-style:normal;opacity:.45}.cap i.on{opacity:1}
.bar{position:absolute;left:0;bottom:0;height:%(barh)dpx;background:%(a)s;width:100%%;transform-origin:0 50%%;z-index:6}
"""

# Every frame from the time alone: entrances, exits, drifting colour, captions, progress. It answers to the same calls as
# a paused GSAP timeline, which is what HyperFrames drives.
JS = """
(function(){
var F=window.__film,D=F.duration,root=document.getElementById('root'),now=0;
var ease=function(p){p=p<0?0:p>1?1:p;return 1-Math.pow(1-p,4)};
var scenes=[].map.call(root.querySelectorAll('.scene'),function(el){return{el:el,s:+el.dataset.start,d:+el.dataset.duration,parts:[].map.call(el.querySelectorAll('[data-in]'),function(x){return{el:x,at:+x.dataset.in,k:x.dataset.k||'up'}})}});
var caps=[].map.call(root.querySelectorAll('.cap'),function(el){return{el:el,s:+el.dataset.start,d:+el.dataset.duration,w:[].slice.call(el.children)}});
var blobs=[].slice.call(root.querySelectorAll('.blob')),bar=root.querySelector('.bar');
function draw(t){now=t=Math.max(0,Math.min(D,t));
 blobs.forEach(function(b,i){var q=t*.23+i*2.1;b.style.transform='translate('+(Math.sin(q)*F.w*.07)+'px,'+(Math.cos(q*1.3)*F.h*.06)+'px) scale('+(1+.12*Math.sin(q*.8))+')'});
 scenes.forEach(function(c,i){var l=t-c.s,on=l>=0&&(l<c.d||(i===scenes.length-1&&t>=D));c.el.style.visibility=on?'visible':'hidden';if(!on)return;
  var out=i===scenes.length-1?0:ease((l-(c.d-.38))/.38);c.el.style.opacity=1-out;c.el.style.transform='translateY('+(-out*F.h*.03)+'px) scale('+(1+.012*l/c.d)+')';
  c.parts.forEach(function(p){var e=ease((l-p.at)/.7);p.el.style.opacity=e;p.el.style.transform=p.k==='pop'?'scale('+(.6+.4*e)+')':p.k==='side'?'translateX('+((1-e)*-F.w*.045)+'px)':'translateY('+((1-e)*F.h*.035)+'px)'})});
 caps.forEach(function(c){var l=t-c.s,on=l>=0&&l<c.d;c.el.style.visibility=on?'visible':'hidden';if(on){var n=Math.floor(l/c.d*c.w.length+.6);c.w.forEach(function(w,i){w.className=i<=n?'on':''})}});
 if(bar)bar.style.transform='scaleX('+(t/D)+')';}
var tl={seek:function(t){if(typeof t==='number')draw(t);return tl},time:function(t){if(t===undefined)return now;draw(t);return tl},totalTime:function(t){if(t===undefined)return now;draw(t);return tl},progress:function(p){if(p===undefined)return now/D;draw(p*D);return tl},
 duration:function(){return D},totalDuration:function(){return D},pause:function(t){if(typeof t==='number')draw(t);return tl},play:function(){return tl},paused:function(){return true},kill:function(){return tl},timeScale:function(){return 1},add:function(){return tl},getChildren:function(){return[]},isActive:function(){return false},render:function(t){draw(t);return tl}};
window.__timelines=window.__timelines||{};window.__timelines.main=tl;draw(0);
window.addEventListener('message',function(e){if(e.data&&typeof e.data.t==='number')draw(e.data.t)});
if(window.parent!==window)window.parent.postMessage({film:'ready'},'*');
})();
"""


def palette(seed: str) -> dict:
    hue = int(hashlib.sha256(seed.encode()).hexdigest()[:4], 16) / 65535 * 0.42 + 0.5  # blues to roses
    def rgb(h, light, s):
        r, g, b = colorsys.hls_to_rgb(h % 1, light, s)
        return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))
    return {"bg": rgb(hue, 0.085, 0.55), "ink": "#fbfaf7", "soft": rgb(hue, 0.78, 0.25), "a": rgb(hue + 0.46, 0.74, 0.85), "b1": rgb(hue, 0.42, 0.7), "b2": rgb(hue + 0.1, 0.4, 0.65), "card": "rgba(255,255,255,.07)"}


def _words(text: str, at: float, step: float = 0.06) -> str:
    return " ".join(f'<span class="w" data-in="{at + i * step:.2f}">{html.escape(w)}</span>' for i, w in enumerate(text.split()))


def _scene(s: dict, first: bool) -> str:
    kind, head, items = s["kind"], s["heading"], s["items"]
    e = html.escape
    if kind == "title":
        return f'<div class="kick" data-in="0.05">{e(s.get("kicker") or "")}</div><h1>{_words(head, 0.15)}</h1>' + (f'<p class="sub" data-in="0.75">{e(items[0]["label"])}</p>' if items else "")
    if kind == "big":
        return f'<div class="big" data-in="0.1" data-k="pop">{e(head)}</div>' + "".join(f'<p class="sub" data-in="{0.55 + i * 0.3:.2f}">{e(x["label"])}</p>' for i, x in enumerate(items[:2]))
    if kind == "question":
        return f'<div class="ring" data-in="0.05" data-k="pop">?</div><h1>{_words(head, 0.25)}</h1>'
    if kind == "compare":
        cols = "".join(f'<div class="col" data-in="{0.5 + i * 0.35:.2f}" data-k="pop"><b>{e(x["label"])}</b><span>{e(x["note"])}</span></div>' for i, x in enumerate(items[:3]))
        return f'<h2>{_words(head, 0.1)}</h2><div class="cols">{cols}</div>'
    step = max(0.45, min(1.6, (s["duration"] - 2.0) / max(1, len(items))))
    mark = (lambda i: f'<span class="n">{i + 1}</span>') if kind == "steps" else (lambda i: '<span class="dot"></span>')
    rows = "".join(f'<div class="item" data-in="{0.6 + i * step:.2f}" data-k="side">{mark(i)}<div><b>{e(x["label"])}</b>{"<span>" + e(x["note"]) + "</span>" if x["note"] else ""}</div></div>' for i, x in enumerate(items[:5]))
    return f'<h2>{_words(head, 0.1)}</h2><div class="list">{rows}</div>'


def build(film: dict, *, audio: bool = False) -> str:
    """The composition. With `audio`, it plays voice/<n>.wav beside it (for rendering); the page plays them itself."""
    w, h = SIZES[film["format"]]
    tall = h > w
    p = palette(film["seed"])
    u = w / 1080 if tall else h / 1080
    v = {
        "w": w, "h": h, **p, "blur": int(150 * u), "pad": f"{int(150 * u)}px {int(84 * u)}px {int(430 * u)}px" if tall else f"{int(70 * u)}px {int(150 * u)}px {int(170 * u)}px", "s": int((30 if tall else 28) * u), "m": int((52 if tall else 56) * u),
        "l": int((88 if tall else 98) * u), "xl": int((112 if tall else 138) * u), "xxl": int((190 if tall else 250) * u), "gap": int((34 if tall else 30) * u), "dir": "column" if tall else "row", "capb": int((250 if tall else 64) * u), "cap": int((52 if tall else 38) * u), "barh": int(10 * u),
    }
    t, scenes, caps, sounds = 0.0, [], [], []
    for i, s in enumerate(film["scenes"]):
        d = s["duration"]
        scenes.append(f'<section class="scene clip" id="s{i}" data-start="{t:.2f}" data-duration="{d:.2f}" data-track-index="1" data-hf-allow-overflow>{_scene(s, i == 0)}</section>')
        if film["format"] != "slides":
            words = s["say"].split()
            n = 9 if tall else 12
            chunks = [words[k : k + n] for k in range(0, len(words), n)]
            at, total = t + 0.1, max(1, len(words))
            for c in chunks:
                cd = max(0.4, (s["spoken"] or d) * len(c) / total)
                caps.append(f'<div class="cap clip" data-start="{at:.2f}" data-duration="{cd:.2f}" data-track-index="2">{" ".join(f"<i>{html.escape(x)}</i>" for x in c)}</div>')
                at += cd
        if audio and s.get("sound"):
            sounds.append(f'<audio id="a{i}" class="clip" src="{s["sound"]}" data-start="{t + 0.1:.2f}" data-duration="{s["spoken"]:.2f}" data-track-index="3" data-volume="1"></audio>')
        t += d
    blobs = "".join(f'<div class="blob" style="width:{int(w * k)}px;height:{int(w * k)}px;left:{x}%;top:{y}%;background:{c}"></div>' for k, x, y, c in ((0.5, -10, -18, p["b1"]), (0.42, 62, 48, p["b2"]), (0.26, 40, -8, p["b1"])))
    meta = json.dumps({"duration": round(t, 2), "w": w, "h": h})
    return (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width={w}, height={h}"><title>{html.escape(film["title"])}</title><style>{CSS % v}</style></head><body>'
        f'<div id="root" data-composition-id="main" data-start="0" data-duration="{t:.2f}" data-width="{w}" data-height="{h}">{blobs}{"".join(scenes)}{"".join(caps)}{"".join(sounds)}<div class="bar"></div></div>'
        f"<script>window.__film={meta};</script><script>{JS}</script></body></html>"
    )
