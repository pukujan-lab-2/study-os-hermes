/* Mr Candle, live: he presents the talk in his own voice, and you can stop him, steer him and ask him things. What he
   says about each slide is recorded ahead (Modal's voice), so it is instant; answers are live: Modal hears, Claude
   thinks, Modal speaks. The deck works the same without this file. */
(() => {
  'use strict'
  const H = window.__host
  if (!H) return
  const here = location.hostname === 'hackathon.design-bakery.com' || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '3190')
  const API = (here ? '' : 'https://hackathon.design-bakery.com') + '/api/presenter/'
  /* ---- what he says: [when, line]; when is the clip's time, or seconds on the slide ------------------------------------ */
  const TALK = {
    title: [[0.2, 'Hi, I’m Mr Candle. This is Study OS: one real page in, a lesson you can trust out.']],
    two: [[0.2, 'Slop gets in twice. In what you study, and in what you hand in.']],
    show: [[0.3, 'Here’s a real page, from 1861. Reducto reads every block.'], [4.8, 'Pangram says who wrote it: a person.'], [8.4, 'Claude, in Hermes, makes a course and a film. Listen.']],
    ab: [[0.3, 'Your turn. Two lines about a candle. Which one did AI write? Hands up.'], [9.2, 'A is Michael Faraday. B is a model. Pangram hears how it’s written, and says how sure it is.', 'reveal']],
    stop: [[0.3, 'And when nobody wrote it, it stops you, before you learn from it.']],
    seams: [[0.3, 'Our lessons are written by AI, so we label them. Blue lines have a source. Red dots don’t, and say so.']],
    quiz: [[0.2, 'Quizzes tell you why you slipped.']],
    play: [[0.3, 'This isn’t a quiz. You move the heat, and the particles are the lesson.'], [5.2, 'Shake them loose: liquid.'], [11.8, 'Faster still: gas. And it’s always wax.']],
    tutor: [[0, 'Stuck? Ask out loud.', 'first']],
    watch: [[0.2, 'The same lesson, to watch or to listen to.']],
    who: [[0.2, 'Two people use it. Students learn, and hand in. Teachers set it, check it, and send it back.']],
    exam: [[0.2, 'A reading becomes an exam in seconds.']],
    hand: [[0.2, 'Write it on paper. Reducto reads your handwriting.']],
    signals: [[0.2, 'Three signals, to start a conversation. Never proof.']],
    meet: [[0.2, 'Then book time together.']],
    what: [[0.2, 'Reducto reads. Pangram checks. Hermes teaches. Modal speaks.']],
    features: [[0.2, 'Twenty-four things, one plugin.']],
    qr: [[0.2, 'Scan it, and play on your phone. No Hermes, no sign-in. Thank you!']]
  }
  const WAIT = { show: 25, tutor: 18.4, stop: 6.6, seams: 11, play: 16.5 } // stay until the clip has shown it
  const EXTRA = ['I’m here.', 'Sure.', 'Go ahead.', 'Okay, quiet.', 'Let’s go.', 'Good question.']

  /* ---- on screen ---------------------------------------------------------------------------------------------------- */
  const css = document.createElement('style')
  css.textContent = `#dock{position:fixed;right:20px;top:16px;z-index:56;display:flex;gap:8px;align-items:center;opacity:0;transition:opacity .25s;font:700 17px/1 Inter,sans-serif;letter-spacing:-.015em}#dock.see,#dock:focus-within{opacity:1}#dock button{appearance:none;font:inherit;letter-spacing:inherit;height:46px;min-width:46px;padding:0 16px;border:3px solid #121212;border-radius:99px;background:#fff;color:#121212;box-shadow:3px 3px 0 #121212;cursor:pointer;display:inline-flex;align-items:center;gap:9px}#dock button:hover{translate:-1px -1px;box-shadow:4px 4px 0 #121212}#dock button:active{translate:3px 3px;box-shadow:none}#dock svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}#dock .go{background:#ffc93c}#dock .hold{background:#8f9cff;touch-action:none;user-select:none}#dock .hold.on{background:#1a7748;color:#fff;translate:3px 3px;box-shadow:none}#dock .mic.live{background:#1a7748;color:#fff}#dock .end{background:#121212;color:#fff}#dock [hidden]{display:none}#callpill{position:fixed;left:22px;top:18px;z-index:55;display:none;align-items:center;gap:12px;background:#121212;color:#fff;border-radius:99px;padding:10px 19px;font:700 19px/1 Inter,sans-serif;letter-spacing:-.01em;max-width:46vw}#callpill.on{display:flex}#callpill span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#callpill i{flex:none;width:13px;height:13px;border-radius:50%;background:#1a7748;scale:calc(1 + var(--v,0)*1.6)}#callpill.think i{background:#ffc93c}#callpill.talk i{background:#f39ac3}#callpill.mute i{background:#d7322a}`
  document.head.append(css)
  const I = { l: 'M15 5l-7 7 7 7', r: 'M9 5l7 7-7 7', play: 'M8 5v14l11-7z', pause: 'M8 5v14M16 5v14', mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4', off: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M4 4l16 16', end: 'M6 6l12 12M18 6L6 18' }
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${I[k]}"/></svg>`
  const dock = document.createElement('div'); dock.id = 'dock'
  dock.innerHTML = `<button type="button" data-b="back" aria-label="Back">${svg('l')}</button><button type="button" data-b="next" aria-label="Next">${svg('r')}</button><button type="button" class="go" data-b="show" hidden></button><button type="button" class="hold" data-b="hold" hidden>${svg('mic')}Hold to talk</button><button type="button" class="mic" data-b="mic"></button><button type="button" class="end" data-b="end" hidden>${svg('end')}End call</button>`
  const pill = document.createElement('div'); pill.id = 'callpill'; pill.innerHTML = '<i></i><span></span>'
  document.body.append(dock, pill)
  const B = k => dock.querySelector(`[data-b=${k}]`)
  let hide = 0
  const see = () => { dock.classList.add('see'); clearTimeout(hide); hide = setTimeout(() => dock.classList.remove('see'), 3200) }
  addEventListener('pointermove', see); see()

  let on = false, muted = false, holding = false, rec = null, thinking = 0, hear = '', history = [], ctx = null, ana = null, warm = 0
  let show = false // he is presenting
  function paint() {
    pill.classList.toggle('on', on)
    const auto = !holding && !muted && on && (saying || loud())
    if (window.StudyEars) StudyEars.muted = muted || Boolean(auto) // it never hears itself, or the clip
    const st = thinking ? 'think' : saying ? 'talk' : (muted || auto) && !holding ? 'mute' : ''
    for (const c of ['think', 'talk', 'mute']) pill.classList.toggle(c, c === st)
    pill.lastChild.textContent = thinking && hear ? `“${hear.slice(-52)}”` : st === 'think' ? 'Thinking' : st === 'talk' ? 'Talking' : st === 'mute' ? (muted ? 'Hold V to talk' : 'Muted while the clip talks') : holding ? 'Listening to you' : stuck || 'Listening'
    B('show').innerHTML = show && !held ? `${svg('pause')}Pause` : show ? `${svg('play')}Go on` : `${svg('play')}Mr Candle presents`
    B('mic').innerHTML = !on ? `${svg('mic')}Call Mr Candle` : muted ? `${svg('off')}Open mic` : `${svg('mic')}Mic is open`
    B('mic').classList.toggle('live', on && !muted)
    B('hold').classList.toggle('on', holding)
    for (const k of ['end', 'show', 'hold']) B(k).hidden = !on
    H.face('awake', !!thinking)
  }
  let stuck = ''

  /* ---- his voice ------------------------------------------------------------------------------------------------------ */
  const clips = new Map()
  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)(); ana = ctx.createAnalyser(); ana.fftSize = 256; ana.connect(ctx.destination)
      const d = new Uint8Array(ana.frequencyBinCount)
      const meter = () => { ana.getByteTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v - 128)); const mic = window.StudyEars ? Math.min(0.6, StudyEars.level * 5) : 0; pill.style.setProperty('--v', (saying ? m / 128 : muted ? 0 : mic).toFixed(2)); requestAnimationFrame(meter) }
      meter()
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  function clip(text) {
    if (!clips.has(text)) clips.set(text, fetch(API + 'say', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) }).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then(b => audio().decodeAudioData(b)).catch(() => { clips.delete(text); return null }))
    return clips.get(text)
  }
  let saying = '', src = null, said = [], voice = 0
  function hush() { voice++; if (src) { src.onended = null; try { src.stop() } catch (e) {} src = null } if (window.speechSynthesis) speechSynthesis.cancel(); if (saying) said.push({ text: saying, at: Date.now() }); saying = ''; if (window.StudyEars) StudyEars.talking = false; H.quiet(); paint() }
  /** Says a line and resolves when it ends (true) or was cut (false). */
  function say(text, buf) {
    hush()
    const mine = voice
    return new Promise(async done => {
      const end = ok => { if (mine === voice) { said.push({ text, at: Date.now() }); said = said.slice(-6); saying = ''; src = null; if (window.StudyEars) StudyEars.talking = false; H.quiet(); paint() } done(ok && mine === voice) }
      const b = buf || await clip(text)
      if (mine !== voice) return done(false)
      saying = text; if (window.StudyEars) StudyEars.talking = true; paint()
      if (b) {
        src = audio().createBufferSource(); src.buffer = b; src.connect(ana); src.onended = () => end(true)
        H.say(H.esc(text.length > 58 ? text.slice(0, 56) + '…' : text), b.duration * 1000 + 250, true); src.start()
      } else {
        H.say(H.esc(text.slice(0, 58)), 900 + text.length * 60, true)
        const u = window.speechSynthesis && new SpeechSynthesisUtterance(text)
        if (u) { u.onend = u.onerror = () => end(true); speechSynthesis.speak(u) }
        setTimeout(() => end(true), u ? 1500 + text.length * 90 : 900 + text.length * 60)
      }
      const cut = () => { if (mine !== voice) return done(false); if (saying === text) setTimeout(cut, 120) }
      cut()
    })
  }
  const wait = ms => new Promise(r => setTimeout(r, ms))

  /* ---- presenting: tell a slide, stop, carry on -------------------------------------------------------------------------- */
  let tell = 0, held = false, spot = { key: '', line: 0 }
  const key = () => S[i].dataset.key
  const video = () => S[i].querySelector('video')
  const hold = v => { held = v; const c = video(); if (c && v) c.pause(); else if (c && !c.ended && c.currentTime > 0) c.play().catch(() => {}); paint() }
  /** Tells the slide we're on, in step with its clip. Resolves true when it is all told. */
  async function narrate(from = 0) {
    const mine = ++tell, k = key(), lines = TALK[k] || [], c = video(), t0 = performance.now()
    let idle = 0
    if (spot.key !== k) spot = { key: k, line: 0 }
    const now = () => (c && c.duration ? c.currentTime - (+S[i].dataset.from || 0) : (performance.now() - t0 - idle) / 1000 + (from ? 99 : 0))
    const alive = () => mine === tell && key() === k
    spot = { key: k, line: from }
    if (lines[0] && lines[0][2] === 'first' && from === 0 && c) { c.pause(); c.currentTime = 0 }
    for (let n = from; n < lines.length; n++) {
      const [t, text, extra] = lines[n]
      clip(text)
      while (alive() && (held || (now() < t && !(c && c.ended)))) { if (held) idle += 60; await wait(60) }
      if (!alive()) return false
      spot.line = n
      if (extra === 'reveal' && !S[i].classList.contains('shown')) { H.uncover(); await wait(500) }
      const ok = await say(text)
      if (!alive()) return false
      if (!ok && !show) return false
      if (!ok) { while (alive() && held) await wait(80); if (!alive()) return false; n--; continue } // stopped mid-line: say it again
      if (extra === 'first' && c) c.play().catch(() => {})
    }
    spot.line = lines.length
    return alive()
  }
  async function present() {
    if (show) return
    if (!on) return H.say('Call me first: C', 1800, false)
    show = true; held = false; audio(); preload(); paint()
    if (i >= S.length - 1) { H.shove(0); await wait(900) }
    const c = video(); if (c) { c.currentTime = +S[i].dataset.from || 0; c.play().catch(() => {}) }
    while (show) {
      const k = key(), t0 = performance.now(); let paused = 0
      const done = await narrate(spot.key === k ? spot.line : 0)
      if (!show) return
      if (!done) { while (show && key() === k && (held || saying || thinking)) await wait(100); if (!show) return; if (key() !== k) await wait(250); continue }
      const v = video(), need = WAIT[k] || 0
      while (show && key() === k && (held || (v && need && !v.ended && v.currentTime < need) || (!need && (performance.now() - t0 - paused) < 3600))) { if (held) paused += 80; await wait(80) }
      if (!show) return
      if (key() !== k) continue
      await wait(k === 'qr' ? 0 : 420)
      if (i >= S.length - 1) { show = false; paint(); return }
      if (show && !held && key() === k) { H.shove(i + 1); await wait(750) }
    }
  }
  function stopShow() { show = false; tell++; hush(); held = false; paint() }
  const toggleShow = () => { if (!show) return present(); if (!on) return stopShow(); hold(!held); if (held) hush() }
  function preload() { for (const k of S.slice(i).map(s => s.dataset.key).concat(Object.keys(TALK))) for (const l of TALK[k] || []) clip(l[1]); EXTRA.forEach(clip) }

  /* ---- doing ----------------------------------------------------------------------------------------------------------- */
  const IX = k => S.findIndex(s => s.dataset.key === k)
  function feature(name) {
    const at = IX('features'), many = ['reducto', 'pangram', 'hermes', 'modal'].includes(name)
    const light = () => { const g = S[at].querySelector('.fgrid'), all = [...g.querySelectorAll('.fb')], on_ = all.filter(x => (many ? x.classList.contains(name) : x.dataset.f === name)); all.forEach(x => x.classList.toggle('pick', on_.includes(x))); g.classList.toggle('has', on_.length > 0); if (on_.length) H.cheer() }
    if (i === at) return light()
    H.shove(at); setTimeout(light, 900)
  }
  /** Moves; tells the new slide shortly when it got somewhere. */
  function move(f, talk = true) { const k = i; tell++; hush(); f(); const t = Date.now(); const look = () => { if (i !== k) { if (talk && on && !show) setTimeout(() => on && narrate(0), 350) } else if (Date.now() - t < 1500) setTimeout(look, 80) }; look() }
  function doIt(a, silent) {
    const v = video()
    if (a.do === 'go') return a.slide >= 1 && a.slide <= S.length && a.slide - 1 !== i ? move(() => H.shove(a.slide - 1), !silent) : a.slide - 1 === i ? doIt({ do: 'again' }, silent) : null
    if (a.do === 'next') return S[i].hasAttribute('data-step') && !S[i].classList.contains('shown') ? H.uncover() : move(() => H.shove(i + 1), !silent)
    if (a.do === 'back') return move(() => H.shove(i - 1), !silent)
    if (a.do === 'reveal') return key() === 'ab' ? H.uncover() : move(() => H.shove(IX('ab')), !silent)
    if (a.do === 'play') return held ? hold(false) : v && v.play().catch(() => {})
    if (a.do === 'pause') return show ? (hold(true), hush()) : v && v.pause()
    if (a.do === 'again') { tell++; hush(); spot = { key: '', line: 0 }; S[i].classList.remove('shown'); start(S[i]); return !silent && on && !show && narrate(0) }
    if (a.do === 'feature' || (a.do === 'sponsor' && key() === 'features')) return feature(a.name)
    if (a.do === 'sponsor') { H.tap(a.name); return H.cheer() }
    if (a.do === 'dance') { H.hop(700); H.cheer(); return setTimeout(() => { H.hop(700); H.cheer() }, 1500) }
    if (a.do === 'mute') return setTimeout(() => setMute(true), 900)
  }

  /* ---- understanding: plain orders at once, the rest by Claude --------------------------------------------------------- */
  const norm = t => String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const CALLED = /^(?:(?:hey|hi|hello|ok|okay|so|um|uh|and|now|alright|yo|thanks|thank you)[ ,.]+)*(?:(?:mr|mister|miss)\.? )?(?:candle|candles|kendall|kendal|candel|candy|handle)\b[ ,.!?]*/i
  const LAST = /,\s*(?:(?:mr|mister)\.? )?(?:candle|kendall|candel)[ .!?]*$/i
  const loud = () => [...S[i].querySelectorAll('video[data-sound]')].some(v => !v.paused && !v.ended && !v.muted && v.currentTime > (+v.dataset.sound || 0) - 0.3)
  function echo(t) {
    const w = norm(t).split(' ').filter(Boolean)
    const pool = [saying, ...said.filter(x => Date.now() - x.at < 4500).map(x => x.text)].filter(Boolean)
    return pool.some(p => { const have = new Set(norm(p).split(' ')); return w.filter(x => have.has(x)).length / w.length >= 0.62 })
  }
  const LEAD = '(?:(?:ok|okay|alright|all right|so|now|and|then|please|can you|could you|would you|will you|let us|lets|let s|i want to|we can|just|yeah|yes|um|uh|cool|great|perfect|good|thanks|thank you) )*'
  const RULES = [
    [new RegExp(`^${LEAD}(?:go (?:to (?:the )?)?next|next|move on|keep going to the next)(?: one| slide| page)?(?: please)?$`), 'next'],
    [new RegExp(`^${LEAD}(?:go back|back|previous|go to the previous)(?: one| a slide| one slide| slide)?(?: please)?$`), 'back'],
    [new RegExp(`^${LEAD}(?:reveal|show(?: us| them| me)? the answer|reveal it|reveal the answer|uncover(?: it| them)?)$`), 'reveal'],
    [new RegExp(`^${LEAD}(?:play (?:it|that|this) again|play again|replay(?: it| that)?|again|one more time|say (?:it|that) again)$`), 'again'],
    [new RegExp(`^${LEAD}(?:pause|stop|stop it|hold on|wait|wait a (?:second|sec|minute)|one second|hang on|stop there|pause (?:it|that|there))$`), 'pause'],
    [new RegExp(`^${LEAD}(?:go on|continue|carry on|keep going|resume|play|play it|go ahead|unpause)$`), 'resume'],
    [new RegExp(`^${LEAD}(?:take it away|you present|present it|start the (?:show|presentation|talk)|start presenting|do the presentation|run the show|you can start|begin|start|present)$`), 'show'],
    [new RegExp(`^${LEAD}(?:be quiet|quiet|mute|mute yourself|shush|stop listening|go to sleep)$`), 'mute']
  ]
  const GOTO = new RegExp(`^${LEAD}(?:go to|show(?: me| us| them)?|take (?:me|us) to|open|jump to|bring up|switch to|look at|see|pull up|let me show you)(?: the| that| your| my| our)? (.{2,34})$`)
  /** An order plain enough to obey without thinking: {do, slide} or null. */
  function order(text, named) {
    const t = norm(text.replace(CALLED, '').replace(LAST, ''))
    if (!t) return null
    for (const [re, d] of RULES) if (re.test(t)) return { do: d }
    const g = GOTO.exec(t) || (named && t.split(' ').length <= 5 && !/^(what|why|how|who|when|is|are|do|does|did|tell|explain|which|where)\b/.test(t) ? [0, t] : null)
    if (g && !/^(what|how|why|who)\b/.test(g[1]) && !/\b(which|where|how|why)\b/.test(t)) { const p = H.parse(g[1], true); if (p.cmd === 'go') return { do: 'go', slide: p.n + 1, silent: /let me show you|look at/.test(t) && !named } }
    return null
  }
  function obey(o) {
    if (o.do === 'show') { if (show) hold(false); else present(); return }
    if (o.do === 'resume') { if (show) return hold(false); return doIt({ do: 'play' }) }
    if (o.do === 'mute') return setMute(true)
    if (o.do === 'pause') { if (show) { hold(true); hush() } else { tell++; hush(); doIt(o) } return }
    if (show && held) held = false
    doIt(o, o.silent)
    paint()
  }
  const deck = () => S.map((s, k) => ({ n: k + 1, title: (s.querySelector('h1,h2')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100), notes: (s.querySelector('aside')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 150) }))

  /** One sentence, from sound (or words, for tests). Works ahead; nothing counts until it is confirmed. */
  const turns = new Map()
  let direct = false
  function begin(id, blob, words) {
    const t = { id, ok: false, dead: false, direct, events: [], ac: new AbortController() }
    turns.set(id, t)
    setTimeout(() => t.ac.abort(), 15000)
    const push = e => { if (t.dead) return; t.events.push(e); if (t.ok) handle(t) }
    const ask = JSON.stringify({ text: words || '', slide: i + 1, slides: deck(), history: [...history.slice(-7), ...(direct ? [{ who: 'me', text: '(I am holding the talk button now: what I say next is to you, Candle. Always answer Y.)' }] : [])] }), head = new TextEncoder().encode(ask), len = new Uint8Array(4)
    new DataView(len.buffer).setUint32(0, head.length)
    ;(async () => {
      try {
        const r = await fetch(API + 'turn', { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Blob(blob ? [len, head, blob] : [len, head]), signal: t.ac.signal })
        if (!r.ok) return push({ error: r.status === 429 ? 'enough' : 'lost' })
        if (words) push({ heard: words })
        const rd = r.body.getReader(), dec = new TextDecoder(); let buf = ''
        for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let k; while ((k = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, k); buf = buf.slice(k + 1); if (l) push(JSON.parse(l)) } }
        push({ end: true })
      } catch (e) { push({ error: 'lost' }) }
    })()
    return t
  }
  function cancel(id) { const t = turns.get(id); if (t) { t.dead = true; t.ac.abort(); turns.delete(id) } }
  function confirm(id) { const t = turns.get(id); if (!t || t.dead) return; t.ok = true; handle(t) }
  function drop(t) { t.dead = true; t.ac.abort(); turns.delete(t.id); if (thinking === t.id) { thinking = 0; hear = ''; paint() } }
  async function handle(t) {
    while (t.events.length && !t.dead) {
      const e = t.events.shift()
      if (e.error) { stuck = e.error === 'asleep' ? 'Waking my ears' : e.error === 'enough' ? 'Talked enough today' : ''; if (stuck) setTimeout(() => { stuck = ''; paint() }, 4000); if (t.was && show) hold(false); return drop(t) }
      if (e.heard !== undefined) {
        const text = e.heard.trim(), named = CALLED.test(text) || LAST.test(text)
        t.text = text; t.named = named
        if (norm(text).length < 2 || echo(text) || (loud() && !CALLED.test(text) && !t.direct)) { if (t.was && show) hold(false); return drop(t) }
        const o = order(text, named || t.direct)
        if (o && !(loud() && !named && !t.direct)) { history.push({ who: 'me', text }); H.say(`<i>“</i>${H.esc(text.slice(-34))}<i>”</i>`, 1300, false); drop(t); return obey(o) }
        thinking = t.id; hear = named ? text : ''; paint()
        if (named) { t.was = t.was || (show && !held); if (t.was) hold(true); else tell++; if (saying) hush() } // called by name: stop and listen
      }
      if (e.to_me !== undefined) { t.mine = e.to_me; if (e.to_me) { hear = t.text; paint(); if (!t.named) { t.was = t.was || (show && !held); if (t.was) hold(true); else tell++; if (saying) hush() } } }
      if (e.actions) { const q = /\?\s*$/.test(t.text) && !/\b(show|go|take|open)\b/i.test(t.text); for (const a of e.actions) { if (q && show && ['go', 'feature', 'next', 'back', 'sponsor'].includes(a.do)) continue; if (t.was) { held = false } doIt(a, !t.mine); await wait(250) } }
      if (e.say) { t.say = e.say; t.moved = (t.acted = t.acted || false) }
      if (e.audio !== undefined && t.say) { thinking = 0; hear = ''; tell++; history.push({ who: 'me', text: t.text }, { who: 'you', text: t.say }); let b = null; if (e.audio) { try { b = await audio().decodeAudioData(Uint8Array.from(atob(e.audio), c => c.charCodeAt(0)).buffer) } catch (x) {} } const ok = await say(t.say, b); t.said = true; if (t.was && show) { if (ok) await wait(350); hold(false) } }
      if (e.end) { if (t.text && !t.say) history.push({ who: 'me', text: t.text }); if (!t.said && t.was && show && !t.say) hold(false); return drop(t) }
    }
  }

  /* ---- the call ---------------------------------------------------------------------------------------------------------- */
  function listen() {
    if (!on || rec || !window.StudyEars) return
    rec = new StudyEars()
    const mine = rec
    rec.onsegment = (id, blob) => begin(id, blob); rec.oncancel = cancel; rec.onconfirm = confirm
    rec.onerror = e => { if (mine !== rec) return; if (['not-allowed', 'audio-capture'].includes(e.error)) { stuck = 'No microphone'; H.say('Let me use the mic', 2600); paint() } }
    rec.onend = () => { if (mine !== rec) return; rec = null; if (on && stuck !== 'No microphone') setTimeout(listen, 1200) }
    rec.start()
  }
  function call() {
    if (on) return
    on = true; stuck = ''; history = []; audio(); H.busyMic(true); H.face('ears', true); setMute(true, true); preload()
    const wake = () => fetch(API + 'wake').catch(() => {})
    wake(); warm = setInterval(wake, 40000)
    if (!window.StudyEars) stuck = 'No microphone here'
    listen(); paint()
    say('I’m here.')
  }
  function setMute(v, quiet) { muted = v; if (window.StudyEars) StudyEars.muted = v; if (v && thinking) { const t = turns.get(thinking); if (t) drop(t) } H.face('ears', on && !v); if (!quiet) H.say(v ? 'Muted' : 'Listening', 1200, false); paint() }
  function end() { if (!on) return; stopShow(); on = false; clearInterval(warm); for (const t of [...turns.values()]) drop(t); if (rec) { const r = rec; rec = null; r.abort() } H.busyMic(false); H.face('ears', false); holding = false; if (window.StudyEars) { StudyEars.hold = false; StudyEars.muted = false } muted = false; stuck = ''; H.say('Call ended', 1500, false); paint() }
  const mic = () => (on ? setMute(!muted) : call())
  function down() { if (!on) return H.say('Call me first: C', 1800, false); if (holding) return; holding = true; if (window.StudyEars) StudyEars.hold = true; if (show && !held) { hold(true); heldByTalk = true } if (saying) hush(); paint() }
  let heldByTalk = false
  function up() { if (!holding) return; holding = false; if (window.StudyEars) StudyEars.hold = false; const n = turns.size; direct = true; if (rec) rec.release(); direct = false; if (heldByTalk) { heldByTalk = false; const t = [...turns.values()].pop(); if (t && turns.size > n) t.was = true; else hold(false) } paint() }
  window.__call = { tap: mic, words: t => { const id = ++StudyEars.ids; begin(id, null, t); confirm(id) }, order, state: () => ({ on, muted, show, held, saying, thinking, key: key(), label: pill.textContent, history }), present, call, end, toggleShow, TALK, EXTRA }

  B('hold').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { B('hold').setPointerCapture(e.pointerId) } catch (x) {} down() })
  for (const t of ['pointerup', 'pointercancel']) B('hold').addEventListener(t, e => { e.stopPropagation(); up() })
  dock.addEventListener('click', e => {
    e.stopPropagation()
    const b = e.target.closest('button'); if (!b) return
    b.blur(); see()
    const k = b.dataset.b
    if (k === 'back') { tell++; hush(); if (show) held = false; go(i - 1) } else if (k === 'next') { tell++; hush(); if (show) held = false; next() } else if (k === 'show') toggleShow(); else if (k === 'mic') mic(); else if (k === 'end') end()
    paint()
  })
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key.toLowerCase()
    if (k === 'v' && !e.repeat) return down()
    if (e.repeat) return
    if (k === 'c') mic()
    else if (k === 'p' || k === 'a') toggleShow()
    else if (['arrowright', 'arrowleft', 'arrowdown', 'arrowup', 'pagedown', 'pageup', ' ', 'enter'].includes(k)) { tell++; hush(); if (show && held) held = false } // you took the slide: he starts on the new one
  }, true)
  addEventListener('keyup', e => { if (e.key.toLowerCase() === 'v') up() })
  addEventListener('blur', up)
  setTimeout(() => fetch(API + 'wake').catch(() => {}), 1200)
  setInterval(paint, 900)
  paint()
})()
