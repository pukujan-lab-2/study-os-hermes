/* A live call with the candle: it hears everything, works out when it is being spoken to, answers aloud and works the
   slides. Chrome turns speech into words, Claude (in Study OS' server) decides, Modal speaks. Optional: the deck and
   the candle work the same without this file. */
(() => {
  'use strict'
  const H = window.__host
  if (!H) return
  const API = location.hostname === 'hackathon.design-bakery.com' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '3190' ? '' : 'https://hackathon.design-bakery.com'
  const css = document.createElement('style')
  css.textContent = `#callpill{position:fixed;left:22px;top:18px;z-index:55;display:none;align-items:center;gap:12px;background:#121212;color:#fff;border-radius:99px;padding:9px 18px;font:700 19px/1 Inter,sans-serif;letter-spacing:-.01em}#callpill.on{display:flex}#callpill i{width:13px;height:13px;border-radius:50%;background:#1a7748;scale:calc(1 + var(--v,0)*.9)}#callpill.think i{background:#ffc93c}#callpill.talk i{background:#f39ac3}#callpill.deaf i{background:#8f9cff}#callhint{position:absolute;left:1290px;top:560px;z-index:27;display:none;background:#fff;color:#121212;border:4px solid #121212;border-radius:20px;box-shadow:6px 6px 0 #121212;padding:10px 20px;font:700 27px/1.2 Inter,sans-serif;letter-spacing:-.02em;translate:-100% 0}`
  document.head.append(css)
  const pill = document.createElement('div'); pill.id = 'callpill'; pill.innerHTML = '<i></i><span>On call</span>'; document.body.append(pill)
  const label = t => { pill.lastChild.textContent = t }
  const mode = m => { for (const c of ['think', 'talk', 'deaf']) pill.classList.toggle(c, c === m); H.face('awake', m === 'think'); label(m === 'think' ? 'Thinking' : m === 'talk' ? 'Talking' : m === 'deaf' ? 'Waiting for the clip' : 'Listening') }
  const deck = () => S.map((s, k) => ({ n: k + 1, title: (s.querySelector('h1,h2')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 110), notes: (s.querySelector('aside')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 320) }))

  let on = false, rec = null, fails = 0, history = [], buf = '', bufAt = 0, seq = 0, voice = 0, audio = null, saying = '', said = { text: '', at: 0 }, ctx = null, ana = null, warm = 0, asked = 0
  const norm = t => String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const NAME = /\b(?:candle|kendall|candel)\b/i
  /** Its own words coming back through the microphone. */
  function echo(t) {
    const src = saying || (Date.now() - said.at < 2600 ? said.text : '')
    if (!src) return false
    const have = new Set(norm(src).split(' ')), w = norm(t).split(' ').filter(Boolean)
    return w.length > 0 && w.filter(x => have.has(x)).length / w.length >= 0.6
  }
  /** A clip with sound is playing in the room: only its own name gets through. */
  const loud = () => [...S[i].querySelectorAll('video[data-sound]')].some(v => !v.paused && !v.ended && !v.muted && v.currentTime > (+v.dataset.sound || 0) - 0.3)

  async function post(path, body, ms) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms)
    try { return await fetch(API + '/api/presenter/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: c.signal }) } finally { clearTimeout(t) }
  }

  /* ---- speaking ---------------------------------------------------------------------------------------------------- */
  function hush() { voice++; if (audio) { try { audio.onended = null; audio.stop() } catch (e) {} audio = null } if (window.speechSynthesis) speechSynthesis.cancel(); if (saying) said = { text: saying, at: Date.now() }; saying = ''; H.quiet(); if (on) mode(loud() ? 'deaf' : '') }
  async function speak(text) {
    const mine = ++voice
    saying = text
    const done = () => { if (saying !== text) return; said = { text, at: Date.now() }; saying = ''; audio = null; H.quiet(); if (on) mode(loud() ? 'deaf' : '') }
    try {
      const r = await post('say', { text }, 9000)
      if (mine !== voice || !on) { if (saying === text) saying = ''; return }
      if (!r.ok) throw 0
      const b = await ctx.decodeAudioData(await r.arrayBuffer())
      if (mine !== voice || !on) { if (saying === text) saying = ''; return }
      audio = ctx.createBufferSource(); audio.buffer = b; audio.connect(ana); audio.onended = done
      mode('talk'); H.say(H.esc(text.length > 64 ? text.slice(0, 61) + '…' : text), b.duration * 1000 + 300, true)
      audio.start()
    } catch (e) {
      if (mine !== voice || !on) return
      mode('talk'); H.say(H.esc(text.slice(0, 64)), 1200 + text.length * 55, true)
      if (!window.speechSynthesis) return setTimeout(done, 1200 + text.length * 55)
      const u = new SpeechSynthesisUtterance(text); u.onend = u.onerror = done; speechSynthesis.speak(u)
    }
  }

  /* ---- doing ------------------------------------------------------------------------------------------------------- */
  function feature(name) {
    const at = S.findIndex(s => s.dataset.key === 'features')
    const light = () => { const g = S[at].querySelector('.fgrid'); g.querySelectorAll('.pick').forEach(x => x.classList.remove('pick')); const f = g.querySelector(`[data-f="${CSS.escape(name)}"]`); if (f) { g.classList.add('has'); f.classList.add('pick'); H.cheer() } }
    const many = { reducto: 1, pangram: 1, hermes: 1, modal: 1 }[name]
    const go_ = () => { if (!many) return light(); const g = S[at].querySelector('.fgrid'); g.classList.add('has'); g.querySelectorAll('.fb').forEach(x => x.classList.toggle('pick', x.classList.contains(name))); H.cheer() }
    if (i === at) return go_()
    H.act({ cmd: 'go', n: at }); setTimeout(go_, 900)
  }
  function doIt(a) {
    if (a.do === 'go' && a.slide >= 1 && a.slide <= S.length) return a.slide - 1 === i ? null : H.act({ cmd: 'go', n: a.slide - 1 })
    if (['next', 'back', 'reveal', 'play', 'pause', 'again'].includes(a.do)) return H.act({ cmd: a.do })
    if (a.do === 'feature') return feature(a.name)
    if (a.do === 'sponsor') return S[i].dataset.key === 'features' ? feature(a.name) : (H.tap(a.name), H.cheer())
    if (a.do === 'dance') { H.hop(700); H.cheer(); return setTimeout(() => { H.hop(700); H.cheer() }, 1500) }
    if (a.do === 'hang_up') return setTimeout(() => stop('Bye'), saying ? 4200 : 600)
  }

  /* ---- hearing ----------------------------------------------------------------------------------------------------- */
  async function heard(text) {
    text = text.replace(/\s+/g, ' ').trim()
    if (!on || text.length < 2 || echo(text)) return
    if (loud() && !NAME.test(text)) return
    const p = H.parse(text.replace(NAME, ' '), true)
    const mine = ++seq
    // a plain order by name needs no thinking
    if (NAME.test(text) && ['next', 'back', 'reveal', 'pause', 'play', 'again'].includes(p.cmd) && text.split(' ').length <= 5) { hush(); history.push({ who: 'me', text }); H.say(`<i>“</i>${H.esc(text.slice(-34))}<i>”</i>`, 1500, false); return H.act(p) }
    mode('think'); asked = Date.now()
    let d = null
    try { const r = await post('hear', { text, slide: i + 1, speaking: !!saying, slides: deck(), history: history.slice(-12) }, 12000); d = r.ok ? await r.json() : null; if (r.status === 429) { H.say('I’ve talked enough today', 2400); } } catch (e) {}
    if (!on) return
    history.push({ who: 'me', text }); if (history.length > 40) history = history.slice(-30)
    if (!d || (mine !== seq && !d.to_me && !(d.actions || []).length)) return mine === seq ? mode('') : 0
    if (d.say && saying) hush()
    ;(d.actions || []).forEach((a, k) => setTimeout(() => on && doIt(a), k * 900))
    if (d.say) { history.push({ who: 'you', text: d.say }); speak(d.say) } else if (mine === seq) mode(loud() ? 'deaf' : '')
  }
  let flush = 0
  function take(text, final) {
    if (echo(text)) return
    // talking over it stops it
    if (saying && audio && norm(text).split(' ').length >= 3 && !loud()) hush()
    if (!final) return
    buf = `${buf} ${text}`.trim(); bufAt = Date.now()
    clearTimeout(flush)
    flush = setTimeout(() => { const t = buf; buf = ''; heard(t) }, NAME.test(buf) ? 260 : 480)
  }
  window.__call = { hear: t => heard(t), take, state: () => ({ on, saying, mode: pill.className, label: pill.textContent, seq, history }), start, stop }

  function open() {
    if (!on || rec) return
    try {
      rec = new H.SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'
      const mine = rec
      rec.onresult = e => { if (mine !== rec) return; fails = 0; for (let k = e.resultIndex; k < e.results.length; k++) take(e.results[k][0].transcript, e.results[k].isFinal) }
      rec.onspeechstart = () => { if (mine === rec && !saying && !loud()) label('Hearing you') }
      rec.onerror = e => { if (mine !== rec) return; if (e.error === 'asleep') return H.say('Waking my ears', 1800, false); if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) stop('Let me use the mic'); else if (e.error === 'network') fails += 2 }
      rec.onend = () => { if (mine !== rec) return; rec = null; if (!on) return; if (++fails > 8) return stop('The call needs Wi-Fi'); setTimeout(open, Math.min(1500, 120 * fails)) }
      rec.start()
    } catch (e) { rec = null; stop('No voice here') }
  }
  function start() {
    if (on) return
    if (!H.SR && !window.__calltest) return H.say('The call needs Chrome', 2800)
    on = true; fails = 0; history = []; seq++
    H.busyMic(true); H.face('ears', true); pill.classList.add('on'); mode('')
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume()
    if (!ana) { ana = ctx.createAnalyser(); ana.fftSize = 256; ana.connect(ctx.destination); const d = new Uint8Array(ana.frequencyBinCount); const meter = () => { ana.getByteTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v - 128)); pill.style.setProperty('--v', (m / 128).toFixed(2)); requestAnimationFrame(meter) }; meter() }
    const wake = () => fetch(API + '/api/presenter/wake').catch(() => {})
    wake(); warm = setInterval(wake, 45000)
    if (H.SR) open()
    speak('Hi, I’m here.')
  }
  function stop(why) {
    if (!on) return
    on = false; seq++; clearInterval(warm); clearTimeout(flush); hush()
    if (rec) { const r = rec; rec = null; try { r.abort() } catch (e) {} }
    H.busyMic(false); H.face('ears', false); H.face('awake', false); pill.classList.remove('on')
    if (why) H.say(H.esc(why), 2200)
  }
  // the voice sleeps when nobody uses it: wake it while the title is up
  if (location.protocol !== 'file:' || navigator.onLine) setTimeout(() => fetch(API + '/api/presenter/wake').catch(() => {}), 1500)
  addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return; if (e.key.toLowerCase() === 'c') { on ? stop('Call ended') : start() } if (e.key === 'Escape' && on) stop('Call ended') }, true)
  // the clip with sound: say so, and go quiet
  setInterval(() => { if (on && !saying && !pill.classList.contains('think')) mode(loud() ? 'deaf' : '') ; if (on && pill.classList.contains('think') && Date.now() - asked > 13000) mode('') }, 700)
})()
