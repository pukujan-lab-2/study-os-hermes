/* The candle that hosts the talk. Optional: the deck works the same without this file. Uses the deck's own go(), next(), start(), S and i. */
(() => {
  'use strict'
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches
  const css = document.createElement('style')
  css.textContent = `
#stage{overflow:hidden}#pet{position:absolute;left:0;top:984px;width:0;height:0;z-index:26;--lx:0px;--ly:0px}
#petbody{position:absolute;left:-100px;bottom:-4px;width:200px;height:264px;cursor:pointer;background:none;border:0;padding:0;filter:drop-shadow(7px 5px 0 #121212);outline-offset:6px;transform-origin:50% 100%}
#petbody svg{display:block;width:200px;height:264px;overflow:visible}
#pet .bob{transform-origin:100px 250px;animation:pbob 2.6s ease-in-out infinite}@keyframes pbob{50%{transform:translateY(-5px) scale(1.015,.985)}}
#pet .flame{transform-origin:100px 92px;animation:pflame .9s ease-in-out infinite alternate;transition:scale .25s}@keyframes pflame{from{transform:rotate(-5deg) scaleY(.96)}to{transform:rotate(5deg) scaleY(1.06)}}
#pet .eye{translate:var(--lx) var(--ly);transform-origin:100px 158px;animation:pblink 4.6s infinite;transition:scale .2s}@keyframes pblink{0%,95%,100%{transform:scaleY(1)}97.5%{transform:scaleY(.08)}}
#pet .arm{fill:none;stroke:#121212;stroke-width:8;stroke-linecap:round;transition:rotate .3s cubic-bezier(.3,1.5,.5,1)}#pet .al{transform-origin:54px 178px}#pet .ar{transform-origin:146px 178px}
#pet .hand{fill:#fff;stroke:#121212;stroke-width:5}
#pet .phones,#pet .arcs,#pet .zz,#pet .lids,#pet .smile2,#pet .talk{visibility:hidden}
#pet.ears .phones{visibility:visible}
#pet.awake .flame{scale:1.25 1.5}#pet.awake .eye{scale:1.25}#pet.awake .arcs{visibility:visible}#pet .arcs path{fill:none;stroke:#121212;stroke-width:6;stroke-linecap:round;animation:parc 1s infinite}#pet .arcs path:nth-child(2n){animation-delay:.25s}@keyframes parc{0%,100%{opacity:.15}50%{opacity:1}}
#pet.right .ar{rotate:-62deg}#pet.left .al{rotate:62deg}#pet.up .ar{rotate:-118deg}#pet.down .ar{rotate:34deg}#pet.down .al{rotate:-34deg}
#pet.say .smile{visibility:hidden}#pet.say .talk{visibility:visible;transform-origin:100px 189px;animation:ptalk .24s infinite alternate}@keyframes ptalk{from{transform:scaleY(.35)}}
#pet.cheer .bob{animation:pcheer .42s cubic-bezier(.3,0,.4,1) 4 alternate}@keyframes pcheer{to{transform:translateY(-34px) scale(.96,1.05)}}#pet.cheer .al{rotate:104deg}#pet.cheer .ar{rotate:-104deg}#pet.cheer .smile{visibility:hidden}#pet.cheer .smile2{visibility:visible}
#pet.sleep .eye{visibility:hidden}#pet.sleep .lids,#pet.sleep .zz{visibility:visible}#pet.sleep .flame{scale:.5 .42}#pet.sleep .bob{animation-duration:4.6s}#pet .zz text{font:800 34px Inter,sans-serif;animation:pz 2.6s infinite}#pet .zz text:nth-child(2){animation-delay:.8s;font-size:26px}@keyframes pz{0%{opacity:0}35%,70%{opacity:1}100%{opacity:0}}
#pet.walk .bob{animation:pwalk .2s ease-in-out infinite alternate}@keyframes pwalk{from{transform:rotate(-4deg)}to{transform:rotate(4deg) translateY(-6px)}}#pet .leg{stroke:#121212;stroke-width:9;stroke-linecap:round}#pet.walk .l1{animation:pleg .2s infinite alternate}#pet.walk .l2{animation:pleg .2s infinite alternate-reverse}@keyframes pleg{to{transform:translateY(-9px)}}
#bubble{position:absolute;background:#fff;color:#121212;border:4px solid #121212;border-radius:20px;box-shadow:6px 6px 0 #121212;padding:9px 20px;font:700 27px/1.2 Inter,sans-serif;letter-spacing:-.02em;white-space:nowrap;max-width:430px;overflow:hidden;text-overflow:ellipsis;opacity:0;scale:.7;transition:opacity .15s,scale .22s cubic-bezier(.3,1.6,.5,1);pointer-events:none}
#bubble.on{opacity:1;scale:1}#bubble.top{left:0;bottom:var(--bh);translate:-50% 0}#bubble.right{left:var(--bw);bottom:24px}#bubble.left{right:var(--bw);bottom:24px}#bubble i{font-style:normal;color:#2f3cdc}
#autobar{position:absolute;left:0;bottom:100px;height:8px;width:100%;background:#d7322a;transform:scaleX(0);transform-origin:0 50%;z-index:24;visibility:hidden}#autobar.on{visibility:visible}
#helpbox{position:fixed;inset:0;display:none;place-items:center;background:rgba(18,18,18,.6);z-index:60}#helpbox.on{display:grid}#helpbox div{background:#fff;border:4px solid #121212;border-radius:26px;box-shadow:12px 12px 0 #ffc93c;padding:30px 38px;max-width:900px;max-height:90vh;overflow:auto;font:500 19px/1.5 Inter,sans-serif}#helpbox h3{font-size:34px;letter-spacing:-.04em;line-height:1;margin:0 0 14px;text-transform:uppercase}#helpbox b{display:inline-block;min-width:26px;text-align:center;border:2px solid #121212;border-radius:7px;padding:0 7px;margin-right:7px}#helpbox p{margin:6px 0}#helpbox p.q{color:#5c5b57;font-size:16px;margin-top:14px}
#pet.held .phones{visibility:visible}#pet.held .phones rect{fill:#d7322a}#pet.held #petbody{scale:1.06 .94}
#pet.tugL #petbody{rotate:-17deg;translate:-10px 0}#pet.tugL .al{rotate:78deg}#pet.tugL .ar{rotate:24deg}#pet.tugR #petbody{rotate:17deg;translate:10px 0}#pet.tugR .ar{rotate:-78deg}#pet.tugR .al{rotate:-24deg}#petbody{transition:rotate .16s,translate .16s,scale .16s}
#pet.slap .ar{rotate:-96deg;transition-duration:.09s}#pet.slap #petbody{rotate:9deg}
#pet.hold .al{rotate:108deg}#pet.hold .ar{rotate:-108deg}#pet.hold .bob{animation:pcheer 1.1s ease-in-out infinite alternate}
#pet.conduct .al{animation:pcl .9s ease-in-out infinite alternate}#pet.conduct .ar{animation:pcr .9s ease-in-out infinite alternate}@keyframes pcl{from{rotate:20deg}to{rotate:115deg}}@keyframes pcr{from{rotate:-115deg}to{rotate:-20deg}}
#pet.shrug .al{rotate:72deg}#pet.shrug .ar{rotate:-72deg}#pet.shrug #petbody{rotate:7deg}#pet.shrug .smile{scale:1 -1;transform-box:fill-box;transform-origin:center}
.cover{position:absolute;left:92px;right:0;top:0;height:72px;background:#f39ac3;border:4px solid #121212;border-radius:16px;display:grid;place-items:center;font:800 40px Inter,sans-serif;color:#121212;transition:translate .55s cubic-bezier(.5,-.2,.7,1),rotate .55s,opacity .2s .4s}.abtop{position:relative}.shown .cover{translate:0 620px;rotate:16deg;opacity:0}
.flash{position:absolute;width:190px;height:190px;border-radius:50%;background:#ffc93c;border:6px solid #121212;box-shadow:9px 9px 0 #121212;z-index:25;display:grid;place-items:center;pointer-events:none;animation:pflash .75s cubic-bezier(.2,1.3,.4,1) forwards}.flash svg{width:96px;height:96px}@keyframes pflash{0%{scale:.3;opacity:0}18%,62%{scale:1;opacity:1}100%{scale:1.15;opacity:0}}
@media(prefers-reduced-motion:reduce){#pet *,#pet{animation:none!important;transition:none!important}}`
  document.head.append(css)
  const pet = document.createElement('div')
  pet.id = 'pet'
  pet.innerHTML = `<button id="petbody" type="button" aria-label="Hold to talk"><svg viewBox="0 0 200 264" aria-hidden="true"><g class="bob">
<g class="leg"><path class="l1" d="M84 244v14"/><path class="l2" d="M116 244v14"/></g>
<g class="arm al"><path d="M54 178q-20 6 -24 24"/><circle class="hand" cx="29" cy="206" r="9"/></g>
<g class="flame"><path d="M100 22c6 20 27 30 27 52a27 27 0 0 1-54 0c0-13 8-18 13-27 2 8 6 10 9 10 3-9-1-21 5-35z" fill="#f26b2e" stroke="#121212" stroke-width="6" stroke-linejoin="round"/><path d="M100 60c3 9 12 13 12 23a12 12 0 0 1-24 0c0-8 8-12 12-23z" fill="#ffc93c"/></g>
<path d="M100 92v22" stroke="#121212" stroke-width="7" stroke-linecap="round"/>
<path d="M50 126a14 14 0 0 1 14-14h72a14 14 0 0 1 14 14v104H50z" fill="#fff" stroke="#121212" stroke-width="6"/>
<path d="M50 130v-4a14 14 0 0 1 14-14h72a14 14 0 0 1 14 14v20c0 9-13 9-13 0 0-7-11-7-11 0v10c0 10-15 10-15 0v-8c0-8-12-8-12 0v2c0 8-14 8-14 0v-4c0-7-10-7-10 0v12c0 9-13 9-13 0z" fill="#f39ac3" stroke="#121212" stroke-width="5" stroke-linejoin="round"/>
<g class="eye"><ellipse cx="82" cy="174" rx="7" ry="10" fill="#121212"/><ellipse cx="118" cy="174" rx="7" ry="10" fill="#121212"/><circle cx="84.500" cy="170" r="2.600" fill="#fff"/><circle cx="120.500" cy="170" r="2.600" fill="#fff"/></g>
<g class="lids" fill="none" stroke="#121212" stroke-width="5" stroke-linecap="round"><path d="M74 175q8 7 16 0M110 175q8 7 16 0"/></g>
<path class="smile" d="M90 192q10 9 20 0" fill="none" stroke="#121212" stroke-width="5" stroke-linecap="round"/><path class="smile2" d="M86 188h28c0 17-28 17-28 0z" fill="#d7322a" stroke="#121212" stroke-width="5" stroke-linejoin="round"/><ellipse class="talk" cx="100" cy="194" rx="9" ry="9" fill="#d7322a" stroke="#121212" stroke-width="5"/>
<path d="M30 226h140l-13 22H43z" fill="#2f3cdc" stroke="#121212" stroke-width="6" stroke-linejoin="round"/>
<g class="arm ar"><path d="M146 178q20 6 24 24"/><circle class="hand" cx="171" cy="206" r="9"/></g>
<g class="phones"><path d="M44 168c0-76 112-76 112 0" fill="none" stroke="#121212" stroke-width="9"/><rect x="33" y="156" width="20" height="36" rx="9" fill="#1a7748" stroke="#121212" stroke-width="5"/><rect x="147" y="156" width="20" height="36" rx="9" fill="#1a7748" stroke="#121212" stroke-width="5"/></g>
<g class="arcs"><path d="M20 152q-14 20 0 44"/><path d="M4 142q-22 30 0 64"/><path d="M180 152q14 20 0 44"/><path d="M196 142q22 30 0 64"/></g>
<g class="zz"><text x="150" y="96">z</text><text x="176" y="70">z</text></g></g></svg></button><div id="bubble" class="top" role="status"></div>`
  const bar = document.createElement('div'); bar.id = 'autobar'
  const help = document.createElement('div'); help.id = 'helpbox'
  help.innerHTML = `<div><h3>Mr Candle</h3><p><b>C</b> call Mr Candle. He only talks on a call, and you start muted.</p><p><b>V</b> hold to talk, or hold the button. <b>C</b> again opens the mic; it mutes itself while he or a clip is talking. End call hangs up.</p><p><b>P</b> on a call, he presents the whole thing. Hold V to stop him and ask; he carries on after.</p><p><b>→</b> next or reveal <b style="margin-left:14px">←</b> back <b style="margin-left:14px">R</b> replay <b style="margin-left:14px">F</b> full screen <b style="margin-left:14px">N</b> notes <b style="margin-left:14px">T</b> clock</p><p>Say: next, back, reveal, play again, pause, go on, show the game, show everything, what does Pangram do, which ones does Modal do, take it away, be quiet.</p><p style="font-size:17px">Nothing is listened to until you press P, C or V. Modal turns what the mic hears into words; Claude decides; Modal speaks.</p></div>`
  stage.append(bar, pet); document.body.append(help)
  const bubble = pet.querySelector('#bubble'), body = pet.querySelector('#petbody')

  /* ---- where it stands: x, size, which way it points, where its bubble goes -------------------------------------------- */
  const LEFT = { x: 300, k: 0.98, face: 'right', b: 'top' }
  const AT = {
    title: { x: 1500, k: 1.75, face: '', b: 'top' }, ab: { x: 960, k: 0.4, face: 'up', b: 'right' }, features: { x: 1790, k: 0.42, face: 'up', b: 'left' }, qr: { x: 1510, k: 0.66, face: 'up', b: 'left' },
    two: { x: 960, k: 0.95, face: 'up', b: 'right' }, what: { x: 960, k: 0.8, face: 'up', b: 'right' }, who: { x: 960, k: 0.5, face: 'up', b: 'right' }
  }
  const K = n => S[n].dataset.key, IX = k => S.findIndex(x => x.dataset.key === k), LASTN = S.length - 1
  const SPOT = S.map(x => AT[x.dataset.key] || LEFT)
  const NAP = { x: 960, k: 0.42, face: '', b: 'right' }
  const CELL = { reducto: 240, pangram: 720, hermes: 1200, modal: 1680 }
  const timers = new Set()
  const later = (f, ms) => { const t = setTimeout(() => { timers.delete(t); f() }, ms); timers.add(t); return t }
  const FACES = ['right', 'left', 'up', 'down']
  let spot = null, at = null, quick = false
  const X = { x: 300, k: 0.98, y: 0, vx: 0, vk: 0, vy: 0 }
  let last = performance.now()
  /* springs, so it leans into a run and squashes when it lands */
  function step(now) {
    const dt = Math.min(0.034, (now - last) / 1000); last = now
    if (at) {
      if (calm) { X.x = at.x; X.k = at.k; X.y = 0 } else {
        const s = quick ? 360 : 120, d = 2 * Math.sqrt(s) * 0.82
        for (const [q, v, to, m] of [['x', 'vx', at.x, 1], ['k', 'vk', at.k, 1.4], ['y', 'vy', 0, 2.4]]) { X[v] += ((to - X[q]) * s * m - X[v] * d * Math.sqrt(m)) * dt; X[q] += X[v] * dt }
      }
      const run = Math.min(1, Math.abs(X.vx) / 900), lean = Math.max(-15, Math.min(15, X.vx * 0.013)), st = Math.max(-0.12, Math.min(0.16, -X.vy * 0.0004))
      pet.style.transform = `translate(${X.x.toFixed(1)}px,${X.y.toFixed(1)}px) scale(${(X.k * (1 - st)).toFixed(3)},${(X.k * (1 + st)).toFixed(3)}) rotate(${lean.toFixed(1)}deg)`
      pet.classList.toggle('walk', run > 0.09)
    }
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
  const hop = v => { if (!calm) X.vy = -v }
  function look(px, py) { const dx = px - X.x, dy = py - (984 - 170 * X.k), d = Math.hypot(dx, dy) || 1; pet.style.setProperty('--lx', (dx / d * 7).toFixed(1) + 'px'); pet.style.setProperty('--ly', (dy / d * 5).toFixed(1) + 'px') }
  function stand(p, face, fast) {
    at = p; quick = !!fast
    pet.style.setProperty('--bh', '276px'); pet.style.setProperty('--bw', '112px')
    bubble.className = bubble.className.replace(/top|right|left/, p.b)
    bubble.style.zoom = p.k < 0.8 ? 0.8 / p.k : p.k > 1.2 ? 1 / p.k * 1.2 : 1
    FACES.forEach(f => pet.classList.remove(f))
    if (face) pet.classList.add(face)
    face === 'up' ? look(p.x, 300) : face === 'right' ? look(1210, 450) : face === 'down' ? look(p.x, 1060) : look(p.x - 300, 500)
  }
  const home = () => { if (spot) stand(spot, spot.face) }
  const DO = ['tugL', 'tugR', 'slap', 'hold', 'shrug', 'conduct', 'cheer']
  const pose = (c, ms) => { DO.forEach(x => pet.classList.remove(x)); if (!c) return; void pet.offsetWidth; pet.classList.add(c); if (ms) later(() => pet.classList.remove(c), ms) }
  function visit(n) {
    timers.forEach(clearTimeout); timers.clear(); clearTimeout(tapping)
    if (!pet.classList.contains('tugL') && !pet.classList.contains('tugR')) pose('')
    else later(() => pose(''), 420)
    const nap = n >= SPOT.length
    spot = nap ? NAP : SPOT[n]
    pet.classList.toggle('sleep', nap && !awakeUntil && !ptt)
    later(home, 260)
    if (!at) home()
    if (K(n) === 'qr') later(() => { pose('hold'); const q = S[n].querySelector('div[style*="width:560px"]'); if (q && !calm) q.animate([{ translate: '0 0' }, { translate: '0 -16px' }, { translate: '0 0' }], { duration: 1500, iterations: 2, easing: 'ease-in-out' }); later(() => pose(''), 5000) }, 900)
    const v = S[n].querySelector('video[data-sound]')
    if (v) { v.onended = () => pose(''); later(() => { if (!v.paused) pose('conduct') }, (+v.dataset.sound || 4.2) * 1000) }
    const lit = litNow()
    if (SPOT[n] === LEFT && lit.length === 1) later(() => tap(lit[0]), 1500)
  }
  const litNow = () => [...document.querySelectorAll('#strip .on')].map(d => d.dataset.s)
  /** Runs to the sponsor that is working, jumps on its cell, and goes back. */
  let tapping = null
  function tap(name) {
    if (!CELL[name] || SPOT[i] !== LEFT || !at) return
    clearTimeout(tapping)
    const keep = pet.classList.contains('conduct')
    stand({ x: CELL[name], k: 0.4, face: 'down', b: name === 'modal' ? 'left' : 'right' }, 'down')
    later(() => { hop(420); const c = document.querySelector(`#strip [data-s=${name}]`); if (c && !calm) later(() => c.animate([{ translate: '0 0' }, { translate: '0 14px' }, { translate: '0 0' }], { duration: 320 }), 190) }, 620)
    tapping = setTimeout(() => { home(); if (keep) pose('conduct') }, 2500)
  }
  function cheer() { pose('cheer', 1800) }
  const ICON = { play: 'M8 5v14l11-7z', pause: 'M7 5h4v14H7zM13 5h4v14h-4z', again: 'M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z' }
  function flash(k) { const v = S[i].querySelector('video'); if (!v) return; const f = document.createElement('div'); f.className = 'flash'; f.style.left = '1115px'; f.style.top = '362px'; f.innerHTML = `<svg viewBox="0 0 24 24"><path d="${ICON[k]}" fill="#121212"/></svg>`; stage.append(f); setTimeout(() => f.remove(), 800); if (!calm) v.animate([{ translate: '0 0' }, { translate: '10px 0' }, { translate: '0 0' }], { duration: 260 }) }
  /** Pulls or pushes the slide over: the change happens at the tug. */
  let busy = 0
  function shove(n) {
    n = Math.max(0, Math.min(S.length - 1, n))
    if (n === i) return
    const old = S[i], on_ = n > i, mine = ++busy
    pose(on_ ? 'tugL' : 'tugR')
    stand({ ...at, x: at.x + (on_ ? 46 : -46) }, '', true)
    setTimeout(() => {
      if (mine !== busy) return
      stand({ ...at, x: at.x + (on_ ? -120 : 120) }, '', true)
      go(n)
      if (calm) return
      const o = { duration: 430, easing: 'cubic-bezier(.3,0,.1,1)' }, a = on_ ? '100%' : '-100%', z = on_ ? '-100%' : '100%'
      S[n].animate([{ transform: `translateX(${a})`, opacity: 1, visibility: 'visible' }, { transform: 'none', opacity: 1, visibility: 'visible' }], o)
      old.animate([{ transform: 'none', opacity: 1, visibility: 'visible' }, { transform: `translateX(${z})`, opacity: 1, visibility: 'visible' }], o)
    }, calm ? 0 : 230)
  }
  function press(k, f) {
    if (!S[i].querySelector('video')) return f()
    stand({ ...at, x: at.k > 0.8 ? 458 : at.x }, '', true); look(1210, 450)
    setTimeout(() => { pose('slap', 420); setTimeout(() => { f(); flash(k) }, 90) }, calm ? 0 : 250)
    later(home, 1500)
  }
  function uncover() {
    if (!S[i].hasAttribute('data-step')) { shove(IX('ab')); return setTimeout(uncover, 750) }
    hop(520); pose('hold', 420)
    setTimeout(() => S[i].classList.add('shown'), calm ? 0 : 260)
  }
  document.querySelectorAll('.abtop').forEach(t => { const c = document.createElement('span'); c.className = 'cover'; c.textContent = '?'; t.append(c) })
  let hush = 0
  function say(html, ms = 2200, talk = true) { bubble.innerHTML = html; bubble.classList.add('on'); pet.classList.toggle('say', talk); clearTimeout(hush); hush = setTimeout(() => { bubble.classList.remove('on'); pet.classList.remove('say') }, ms) }
  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

  /* ---- follows the deck: the slide, the reveal and the sponsor strip ----------------------------------------------------- */
  let seen = -1, lit0 = ''
  new MutationObserver(() => {
    if (i !== seen) { seen = i; visit(i); lit0 = [...document.querySelectorAll('#strip .on')].map(d => d.dataset.s).join() ; return }
  }).observe(stage, { subtree: true, attributes: true, attributeFilter: ['class'] })
  S.forEach(s => new MutationObserver(() => { if (S[i] === s && s.classList.contains('shown') && !s._cheered) { s._cheered = true; cheer() } if (!s.classList.contains('shown')) s._cheered = false }).observe(s, { attributes: true, attributeFilter: ['class'] }))
  new MutationObserver(() => {
    const now = [...document.querySelectorAll('#strip .on')].map(d => d.dataset.s).join()
    if (now === lit0) return
    lit0 = now
    if (i === seen && now && !now.includes(',') && S[i].dataset.cues) tap(now)
  }).observe(document.getElementById('strip'), { subtree: true, attributes: true, attributeFilter: ['class'] })

  /* ---- what was said: pure, no model ------------------------------------------------------------------------------------- */
  // "Study OS" alone is not a wake word: the talk itself says it.
  const WAKE = /\b(?:hey|hay|hi|he|okay|ok|o k)[\s,]+(?:study(?:ing|\s*o\.?\s*s\.?)?|studies|steady|studio|stuffy|candle|candles|kendall|kendal|camel|handle)\b/i
  const NUM = { one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, ate: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18 }
  const GOES = [
    [/\b(game|games)\b|with your hands/, 'play'], [/\b(seam|seams|seems|scene|scenes|source|sources|label|lesson facts)\b/, 'seams'], [/\b(tutor|draw|draws|drawing|modal|model speaks|voice)\b/, 'tutor'],
    [/\b(student and teacher|teacher and student|who uses|both sides|student side|teacher side)\b/, 'who'], [/\b(exam|exams)\b/, 'exam'], [/\b(handwriting|by hand|photo)\b/, 'hand'], [/\b(signal|signals)\b/, 'signals'], [/\b(meeting|meetings|calendar)\b/, 'meet'],
    [/\b(a|eight) (?:or|and|are|versus) (?:b|be|bee)\b|\ba ?\/ ?b\b/, 'ab'], [/\b(sponsor|sponsors|who does what|what does what)\b/, 'what'], [/\b(feature|features|everything)\b/, 'features'], [/\b(qr|q r|cue are|code|scan|the end|last slide|try it)\b/, 'qr'],
    [/\b(one page|showcase|real one|film|course)\b/, 'show'], [/\b(nobody|stop sign|fake)\b/, 'stop'], [/\b(quiz|quizzes)\b/, 'quiz'], [/\b(podcast|short|watch|listen)\b/, 'watch'], [/\b(two kinds|slop)\b/, 'two'], [/\b(start|beginning|title|first slide)\b/, 'title']
  ].map(([re, k]) => [re, IX(k)]).filter(x => x[1] >= 0)
  /** {wake, rest, cmd, n}. rest is what came after the wake words; cmd is null when nothing fits. */
  function parse(text, awake) {
    const t = ' ' + String(text || '').toLowerCase().replace(/[.!?]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
    const w = t.match(WAKE)
    const rest = (w ? t.slice(w.index + w[0].length) : t).trim()
    const out = { wake: !!w, rest, cmd: null, n: null }
    if (!w && !awake) return out
    const num = rest.match(/\b(?:slide|page|number)\s+(\d{1,2}|[a-z]+)\b/)
    if (num && (NUM[num[1]] || +num[1])) return { ...out, cmd: 'go', n: (+num[1] || NUM[num[1]]) - 1 }
    if (/\b(go to sleep|stop listening|voice off|be quiet)\b/.test(rest)) return { ...out, cmd: 'sleep' }
    if (/\b(auto ?pilot|run the show|take over|you drive)\b/.test(rest)) return { ...out, cmd: 'auto' }
    if (/\bfull ?screen\b/.test(rest)) return { ...out, cmd: 'full' }
    if (/\b(reveal|answer|which one|who wrote it|uncover)\b/.test(rest)) return { ...out, cmd: 'reveal' }
    const g = GOES.find(([re]) => re.test(rest))
    if (g) return { ...out, cmd: 'go', n: g[1] }
    if (/\bshow us\b/.test(rest)) return { ...out, cmd: 'reveal' }
    if (/\b(back|previous)\b/.test(rest)) return { ...out, cmd: 'back' }
    if (/\b(pause|hold|wait|freeze|stop)\b/.test(rest)) return { ...out, cmd: 'pause' }
    if (/\b(again|replay|rewind)\b/.test(rest)) return { ...out, cmd: 'again' }
    if (/\b(play|resume)\b/.test(rest)) return { ...out, cmd: 'play' }
    if (/\b(next|go on|continue|forward|move on|keep going|skip|onwards?)\b/.test(rest)) return { ...out, cmd: 'next' }
    return out
  }
  const clips = () => [...S[i].querySelectorAll('video')]
  function act(p) {
    stopAuto(true)
    const v = clips()
    if (p.cmd === 'next') { if (S[i].hasAttribute('data-step') && !S[i].classList.contains('shown')) uncover(); else shove(i + 1) }
    else if (p.cmd === 'back') shove(i - 1)
    else if (p.cmd === 'go') { if (p.n === i) press('again', () => start(S[i])); else shove(p.n) }
    else if (p.cmd === 'reveal') uncover()
    else if (p.cmd === 'pause') press('pause', () => v.forEach(x => x.pause()))
    else if (p.cmd === 'play') press('play', () => v.forEach(x => { if (x.ended) x.currentTime = 0; x.play().catch(() => {}) }))
    else if (p.cmd === 'again') press('again', () => { S[i].classList.remove('shown'); start(S[i]) })
    else if (p.cmd === 'full') document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen().catch(() => say('Press F')) : say('Press F')
    else if (p.cmd === 'auto') startAuto()
    else if (p.cmd === 'sleep') listen(false)
  }
  function shrug() { pose('shrug', 1300); say('Hm?', 1300) }
  /* awake for a few seconds after the wake words; only then does anything count */
  let awakeUntil = 0, sleepy = 0, held = 0
  function wakeUp(ms = 4200) { awakeUntil = Date.now() + ms; pet.classList.add('awake'); pet.classList.remove('sleep'); clearTimeout(sleepy); sleepy = setTimeout(nod, ms) }
  function nod() { awakeUntil = 0; pet.classList.remove('awake'); if (spot === NAP) pet.classList.add('sleep') }
  /** Takes one utterance. final: the words are settled. Returns what it made of it. */
  function hear(text, final = true) {
    const awake = Date.now() < awakeUntil
    const p = parse(text, awake)
    clearTimeout(held)
    if (p.wake && !awake) wakeUp()
    if (!p.wake && !awake) return p
    if (p.rest) say(`<i>“</i>${esc(p.rest.slice(-34))}<i>”</i>`, 2200, false)
    else if (p.wake) say('Yes?', 3800)
    if (!p.cmd) { if (final && p.rest) shrug(); return p }
    const run = () => { nod(); act(p); skip = !final }
    if (final) run(); else held = setTimeout(run, 650) // words still settling: "slide one" may become "slide eleven"
    return p
  }
  window.__parse = parse
  window.__hear = text => hear(text, true)

  let inCall = false
  /* ---- the microphone ------------------------------------------------------------------------------------------------------ */
  const SR = window.StudyEars || window.SpeechRecognition || window.webkitSpeechRecognition
  let rec = null, on = false, fails = 0, skip = false
  /* push to talk: hold V (or the candle), say it, let go. No wake words. */
  let ptt = false, words = '', sent = true, pttAt = 0, pttStop = 0, from = 0, count = 0
  function down() {
    if (ptt || inCall) return
    ptt = true; words = ''; sent = false; from = count; pttAt = Date.now()
    nod(); pet.classList.add('held', 'awake'); pet.classList.remove('sleep')
    clearTimeout(pttStop); pttStop = setTimeout(up, 12000)
    if (!SR) return say('Voice needs Chrome', 2600)
    say('Listening', 12000, false)
    if (window.StudyEars) StudyEars.hold = true
    if (!rec) open()
  }
  function up() {
    if (!ptt) return
    ptt = false; clearTimeout(pttStop)
    pet.classList.remove('held', 'awake'); bubble.classList.remove('on')
    if (spot === NAP) pet.classList.add('sleep')
    if (!SR) { sent = true; return }
    if (window.StudyEars) { StudyEars.hold = false; say('Hm', 1600, false) }
    if (!on && rec) { try { rec.stop() } catch (e) {} }
    const ok = parse(words, true).cmd
    setTimeout(() => settle(false), ok ? 260 : 900) // late words still count
    setTimeout(() => settle(true), window.StudyEars ? 6000 : 1500)
  }
  function settle(last) {
    if (sent || ptt) return
    const p = parse(words, true)
    if (!p.cmd && !last) return
    sent = true
    if (p.rest) say(`<i>“</i>${esc(p.rest.slice(-34))}<i>”</i>`, 1800, false)
    if (p.cmd) act(p); else if (p.rest) shrug(); else if (Date.now() - pttAt > 700) say('Didn’t hear', 1400)
  }
  window.__talk = t => { words = t; sent = false; settle(true) }
  function listen(want) {
    if (want === on) return
    on = want
    pet.classList.toggle('ears', on)
    if (!on) { nod(); if (rec) { const r = rec; rec = null; try { r.abort() } catch (e) {} } return say('Voice off', 1500) }
    if (!SR) { on = false; pet.classList.remove('ears'); return say('Voice needs Chrome', 2600) }
    fails = 0
    say('Say “hey study”', 2800)
    if (!rec) open()
  }
  function open() {
    if ((!on && !ptt) || rec) return
    try {
      rec = new SR(); count = 0; from = 0
      rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1
      const mine = rec
      rec.onresult = e => {
        if (mine !== rec) return
        fails = 0; count = e.results.length
        if (ptt || !sent) { const mineNow = [...e.results].slice(from); words = mineNow.map(r => r[0].transcript).join(' '); if (ptt) say(`<i>“</i>${esc(words.trim().slice(-34))}<i>”</i>`, 12000, false); else if (window.StudyEars) settle(true); else if (mineNow.every(r => r.isFinal)) settle(false); return }
        if (!on) return
        for (let k = e.resultIndex; k < e.results.length; k++) {
          const r = e.results[k], t = r[0].transcript
          if (skip) { if (r.isFinal) skip = false; continue } // the utterance already obeyed
          hear(t, r.isFinal)
        }
      }
      rec.onerror = e => {
        if (mine !== rec) return
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(e.error)) { on = false; rec = null; ptt = false; sent = true; pet.classList.remove('ears', 'held', 'awake'); say(e.error === 'audio-capture' ? 'No microphone here' : 'Microphone not allowed', 3000) }
        else if (e.error === 'network') fails += 2
      }
      rec.onend = () => {
        if (mine !== rec) return
        rec = null; skip = false
        if (!on && !ptt) return settle(true)
        if (++fails > 6) { on = false; ptt = false; sent = true; pet.classList.remove('ears', 'held', 'awake'); return say('Voice needs Wi-Fi', 3000) }
        setTimeout(open, Math.min(2000, 150 * fails))
      }
      rec.start()
    } catch (e) { on = false; ptt = false; sent = true; rec = null; pet.classList.remove('ears', 'held', 'awake'); say('No voice here', 2600) }
  }
  body.addEventListener('click', e => { e.stopPropagation(); body.blur() })
  body.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (window.__call) return window.__call.tap(); try { body.setPointerCapture(e.pointerId) } catch (x) {} down() })
  for (const t of ['pointerup', 'pointercancel']) body.addEventListener(t, e => { e.stopPropagation(); up() })
  addEventListener('keyup', e => { if (e.key.toLowerCase() === 'v') up() })
  addEventListener('blur', up)
  help.addEventListener('click', e => { e.stopPropagation(); help.classList.remove('on') })

  /* ---- autopilot: the whole show -------------------------------------------------------------------------------------- */
  const SECS = { two: 5, ab: 15, stop: 7, show: 25, seams: 13, quiz: 6, play: 10, tutor: 18, watch: 6, who: 8, exam: 6, hand: 6, signals: 7, meet: 5, what: 4, features: 7, qr: 7 }, REVEAL = 7
  window.__SECS = SECS
  const PLAN = Object.fromEntries(S.map((x, k) => [k, SECS[x.dataset.key] || 0]).filter(x => x[1]))
  const TOTAL = Object.values(PLAN).reduce((a, b) => a + b, 0)
  const fast = window.__speed || 1
  let auto = 0, t0 = 0, frame = 0
  function startAuto() {
    stopAuto(true)
    auto = 1; bar.classList.add('on'); t0 = performance.now()
    if (i === 0 || i >= LASTN) shove(1)
    const sofar = () => Object.keys(PLAN).filter(n => +n < i).reduce((a, n) => a + PLAN[n], 0)
    let here = i, since = performance.now(), told = false, was = i
    say('I’ve got this', 1800)
    const tick = () => {
      if (!auto) return
      if (here === -1) { if (i === was) { frame = requestAnimationFrame(tick); return } } if (i !== here) { here = i; was = i; since = performance.now() }
      const s = (performance.now() - since) / 1000 * fast
      bar.style.transform = `scaleX(${Math.min(1, (sofar() + Math.min(s, PLAN[here])) / TOTAL)})`
      if (K(Math.max(0, here)) === 'ab' && here > 0 && s > REVEAL && !told) { told = true; uncover() }
      const v = clips()[0], playing = fast === 1 && v && !v.ended && !v.paused && v.duration - v.currentTime < 4
      if (s >= PLAN[here] && !playing) { if (here >= LASTN) return stopAuto(true); here = -1; shove(i + 1) }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }
  function stopAuto(quiet) { if (!auto) return; auto = 0; cancelAnimationFrame(frame); bar.classList.remove('on'); if (quiet !== true) say('Over to you', 1200) }
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || ['Shift', 'Meta', 'Control', 'Alt'].includes(e.key)) return
    const k = e.key.toLowerCase(), was = auto
    if (e.repeat && k !== 'v') return
    if (was) stopAuto()
    if (k === 'a' && !was && !window.__call) startAuto()
    else if (k === 'v') { if (!e.repeat && !window.__call) down() }
    else if (k === 'l') { if (!window.__call) listen(!on) }
    else if (k === 'h') help.classList.toggle('on')
    else if (k === 'escape') help.classList.remove('on')
  }, true)
  addEventListener('click', e => { if (auto && !pet.contains(e.target)) stopAuto() }, true)
  window.__host = {
    act, parse, pose, cheer, shrug, tap, hop, SR, esc,
    say: (html, ms, talk) => say(html, ms, talk),
    quiet: () => { bubble.classList.remove('on'); pet.classList.remove('say') },
    face: (c, v) => pet.classList.toggle(c, v),
    /** A call takes the microphone; hold-to-talk and hands-free step aside. */
    shove, uncover, home, conduct: v => (v ? pose('conduct') : pose('')),
    busyMic: v => { if (v) { if (on) listen(false); if (rec) { const r = rec; rec = null; try { r.abort() } catch (x) {} } } inCall = v }
  }
  window.__pet = { state: () => ({ i, on, awake: Date.now() < awakeUntil, auto: !!auto, total: TOTAL, cls: pet.className, bubble: bubble.classList.contains('on') ? bubble.textContent : '' }) }
  seen = i; spot = SPOT[i] || NAP; X.x = spot.x; X.k = spot.k; visit(i)
})()
