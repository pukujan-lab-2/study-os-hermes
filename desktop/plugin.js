/**
 * Study OS Solo, the Desktop page: courses, lessons, quizzes, review, explaining back, and what you know.
 * It only talks to this plugin's own routes (dashboard/plugin_api.py). Plain ESM, loaded uncompiled: no JSX.
 */
import { PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA, SandboxedFrame, host, haptic, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const ID = 'study-os-solo'
const ROUTE = '/study-os-solo'

/* ---- small helpers ------------------------------------------------------------------------------------ */

const cls = (...x) => x.filter(Boolean).join(' ')
/** h('div.card', {…}, kids) */
function h(tag, props, ...kids) {
  if (props === null || typeof props !== 'object' || Array.isArray(props) || props.$$typeof) {
    if (props !== null && props !== undefined) kids.unshift(props)
    props = {}
  }
  if (typeof tag === 'string' && tag.includes('.')) {
    const [t, ...c] = tag.split('.')
    tag = t || 'div'
    props = { ...props, className: cls(...c, props.className) }
  }
  return createElement(tag, props, ...kids.flat(Infinity))
}
const pct = x => Math.round((x || 0) * 100)
const msg = err => {
  const t = String((err && err.message) || err || '')
  const m = t.match(/"detail"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  return (m ? m[1].replace(/\\"/g, '"') : t).slice(0, 260) || 'That didn’t work. Try again.'
}
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const PATHS = {
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 21H20v-3',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  flame: 'M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.6 1 2.3 2 2.6C10.500 8 11 5.500 12 3z',
  redo: 'M4 12a8 8 0 1 0 2.5-5.800M4 4v4.500h4.500',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4.500v5M8 14.500v5',
  sound: 'M5 10v4h3l4 3.500v-11L8 10zM15.500 9a4 4 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11',
  stop: 'M7 7h10v10H7z',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  map: 'M6 6h.01M18 7h.01M12 12h.01M7 18h.01M17 17h.01M6 6l6 6 6-5M12 12l-5 6M12 12l5 5',
  trash: 'M5 7h14M10 7V4.500h4V7M7 7l1 13h8l1-13',
  chat: 'M4 5h16v11H9l-5 4z',
  bulb: 'M9.500 18h5M10 21h4M12 3a6 6 0 0 0-3.500 10.900c.6.500 1 1.200 1 2.100h5c0-.9.4-1.600 1-2.100A6 6 0 0 0 12 3z',
  play: 'M8 5.500v13l10.500-6.500z',
  pause: 'M8 5v14M16 5v14',
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.500 11a6.500 6.500 0 0 0 13 0M12 17.500V21',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  phone: 'M8 3h8a1.500 1.500 0 0 1 1.500 1.500v15A1.500 1.500 0 0 1 16 21H8a1.500 1.500 0 0 1-1.500-1.500v-15A1.500 1.500 0 0 1 8 3zM11 18h2',
  slides: 'M3.500 5h17v11h-17zM12 16v4M8.500 20h7',
  full: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  mail: 'M3.500 6h17v12h-17zM3.500 7l8.500 6 8.500-6',
  cam: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7z',
  look: 'M12 3a9 9 0 1 0 0 18c1.500 0 2-1 1.500-2.200-.6-1.400.3-2.800 2-2.800H18a3 3 0 0 0 3-3c0-5-4-10-9-10zM7.500 12h.01M9.500 7.500h.01M15 7.500h.01',
  pen: 'M4 20l1-4.500L16.500 4l3.500 3.500L8.500 19zM14.500 6l3.500 3.500',
  spin: 'M12 3a9 9 0 1 0 9 9'
}
const Icon = ({ n, size = 18, className }) =>
  h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: cls(n === 'spin' && 'so-spin', className) }, h('path', { d: PATHS[n] }))

const Btn = ({ kind = 'quiet', icon, children, className, ...p }) => h('button', { type: 'button', className: cls('so-btn', kind === 'main' ? 'so-primary' : `so-${kind}`, className), ...p }, icon && h(Icon, { n: icon, size: 16 }), children)
const IconBtn = ({ icon, label, ...p }) => h('button', { type: 'button', className: 'so-iconbtn', 'aria-label': label, title: label, ...p }, h(Icon, { n: icon }))
const Ring = ({ value, size = 64, children }) => {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  return h('div.so-ring', { style: { width: size, height: size } },
    h('svg', { width: size, height: size, 'aria-hidden': true },
      h('circle', { cx: size / 2, cy: size / 2, r, className: 'so-ring-bg' }),
      h('circle', { cx: size / 2, cy: size / 2, r, className: 'so-ring-fg', strokeDasharray: c, strokeDashoffset: c * (1 - Math.min(1, value || 0)), transform: `rotate(-90 ${size / 2} ${size / 2})` })),
    h('div.so-ring-in', children))
}
const Bar = ({ value }) => h('div.so-bar', { role: 'progressbar', 'aria-valuenow': pct(value), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: `${pct(value)}%` } }))
/** How far along something is: time against what it usually takes, or what is surely done; it never sits still or runs out. */
function Progress({ p, slim }) {
  const [, tick] = useState(0)
  const base = useRef({ at: 0, top: 0, p: null })
  if (base.current.p !== p) { // only fresh news from the server moves the clock
    const begun = performance.now() - p.seconds * 1000
    const far = begun - base.current.at
    if (!base.current.p || Math.abs(far) > 2500) base.current = { at: begun, top: far > 4000 ? 0 : base.current.top, p }
    else base.current.p = p
  }
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 300); return () => clearInterval(t) }, [])
  const s = (performance.now() - base.current.at) / 1000
  base.current.top = Math.min(0.985, Math.max(base.current.top, p.share || 0, 0.92 * (1 - Math.exp(-1.7 * s / p.typical)), 0.04))
  return h('div', { className: cls('so-prog', slim && 'slim') },
    h('div.so-progline', { role: 'progressbar', 'aria-valuenow': pct(base.current.top), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': p.stage || 'Making it' }, h('i', { style: { width: `${(base.current.top * 100).toFixed(1)}%` } })),
    h('div.so-progtext', h('b', s > p.typical * 1.7 + 8 ? `${p.stage || 'Making it'}, a little longer than usual` : p.stage || 'Making it'), h('span', s < 90 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`)))
}
const kicks = new Set()
const kick = () => kicks.forEach(f => f())
const Note = ({ children, bad }) => h('div', { className: cls('so-note', bad && 'so-note-bad'), role: bad ? 'alert' : undefined }, children)

/** A book cover from the title: wood type, letter tiles or a shape, printed in colour blocks. */
const BLOCKS = [['#2f3cdc', '#ffffff'], ['#ffc93c', '#121212'], ['#f39ac3', '#121212'], ['#8f9cff', '#121212'], ['#f26b2e', '#121212'], ['#1a7748', '#ffffff']]
function coverLines(title) {
  const out = []
  for (const w of String(title).toUpperCase().replace(/[^\p{L}\p{N}&'’ -]/gu, ' ').split(/\s+/).filter(Boolean)) {
    const last = out[out.length - 1]
    if (last && (last.length <= 3 || w.length <= 3) && `${last} ${w}`.length <= 11) out[out.length - 1] = `${last} ${w}`
    else out.push(w)
  }
  while (out.length > 4) { let k = 0; for (let i = 1; i < out.length - 1; i++) if (out[i].length + out[i + 1].length < out[k].length + out[k + 1].length) k = i; out.splice(k, 2, `${out[k]} ${out[k + 1]}`) }
  return out.length ? out : ['COURSE']
}
function Cover({ course, big }) {
  const n = hash(course.id)
  const lines = coverLines(course.title)
  const c = i => BLOCKS[(n + i) % 6]
  const fit = (t, x, y, w, ht, fill, key) => h('text', { key, x, y, fill, fontSize: ht * 1.3, textLength: t.length > 1 ? w : undefined, lengthAdjust: 'spacingAndGlyphs' }, t)
  let art
  const kind = n % 3
  if (kind === 0) {
    const bh = 150 / lines.length
    art = lines.flatMap((t, i) => [h('rect', { key: `r${i}`, y: i * bh, width: 120, height: bh + 0.5, fill: c(i)[0] }), fit(t, 8, i * bh + bh * 0.5 + Math.min(bh * 0.62, 40) * 0.47, 104, Math.min(bh * 0.62, 40), c(i)[1], `t${i}`)])
  } else if (kind === 1) {
    const initials = lines.join(' ').split(' ').filter(w => w.length > 2).concat(lines.join(' ').split(' ')).slice(0, 4).map(w => w[0])
    art = [h('rect', { key: 'b', width: 120, height: 150, fill: c(0)[0] }), ...initials.flatMap((ch, i) => [h('rect', { key: `t${i}`, x: 8 + (i % 2) * 53, y: 8 + Math.floor(i / 2) * 43, width: 51, height: 41, rx: 3, fill: c(i + 1)[0] }), h('text', { key: `l${i}`, x: 33.5 + (i % 2) * 53, y: 41 + Math.floor(i / 2) * 43, textAnchor: 'middle', fontSize: 37, fill: c(i + 1)[1] }, ch)]), ...lines.slice(0, 3).map((t, i, all) => fit(t, 8, 112 + i * (38 / all.length) + (all.length === 1 ? 12 : 0), 104, Math.min(26, 34 / all.length) * 0.78, c(0)[1], `n${i}`))]
  } else {
    const [bg, ink] = c(0)
    art = [h('rect', { key: 'b', width: 120, height: 150, fill: bg }), ...[38, 29, 20, 11].map((r, i) => h('circle', { key: i, cx: 60, cy: 50, r, fill: i % 2 ? c(2)[0] : c(1)[0], stroke: '#121212', strokeWidth: 1.4 })), ...lines.slice(0, 3).map((t, i, all) => fit(t, 8, 112 + i * (38 / all.length) + (all.length === 1 ? 12 : 0), 104, Math.min(26, 34 / all.length) * 0.78, ink, `n${i}`))]
  }
  return h('svg', { className: cls('so-cover', big && 'so-cover-big'), viewBox: '0 0 120 150', preserveAspectRatio: 'none', 'aria-hidden': true }, art)
}

/* ---- lesson text: a small, safe Markdown (no HTML is ever inserted) -------------------------------------- */

function inline(text, key = 'i') {
  const out = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_(?![a-zA-Z0-9])|\[([^\]]+)\]\([^)]*\)/g
  let at = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > at) out.push(text.slice(at, m.index))
    const k = `${key}${m.index}`
    if (m[1]) out.push(h('strong', { key: k }, inline(m[1], k)))
    else if (m[2]) out.push(h('code', { key: k }, m[2]))
    else if (m[3] || m[4]) out.push(h('em', { key: k }, inline(m[3] || m[4], k)))
    else out.push(m[5])
    at = re.lastIndex
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}
const bare = t => String(t || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()
/** One line of a lesson with its seam showing: tied to the source, or the model's own words. */
function Seam({ tag, line, children }) {
  const [open, setOpen] = useState(false)
  const el = { className: cls('so-seam', line.quote ? 'tied' : 'own'), tabIndex: 0, role: 'button', 'aria-expanded': open, onClick: () => setOpen(!open), onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open) } } }
  return h(tag, el, children, open && h('span.so-quote', line.quote ? [h('b', { key: 1 }, 'Source'), h('span', { key: 2 }, `“${line.quote}”`)] : [h('b', { key: 1 }, 'No source line'), h('span', { key: 2 }, line.sourced ? 'The model added this to explain it.' : 'From what the model knows.')]))
}
function Markdown({ text, seams }) {
  const lineOf = t => seams && seams.lines.find(x => x.text === bare(t))
  const tie = (tag, key, t) => { const l = lineOf(t); return l ? h(Seam, { key, tag, line: { ...l, sourced: !!seams.source_name } }, inline(t)) : h(tag, { key }, inline(t)) }
  const lines = String(text || '').split('\n')
  const out = []
  let i = 0
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
  while (i < lines.length) {
    const l = lines[i]
    if (!l.trim()) { i++; continue }
    const head = l.match(/^(#{1,6})\s+(.*)/)
    if (head) { out.push(h('h3', { key: i }, inline(head[2]))); i++; continue }
    if (/^\s*```/.test(l)) {
      const code = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++])
      out.push(h('pre', { key: i }, h('code', code.join('\n'))))
      i++
      continue
    }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(l)) { out.push(h('hr', { key: i })); i++; continue }
    if (/^\s*>/.test(l)) {
      const q = []
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''))
      const t = q.join(' ').trim()
      out.push(/^\*\*Compare it to/i.test(t)
        ? h('details.so-compare', { key: i, open: true }, h('summary', 'A comparison, if it helps', h('span.so-hide', 'Show or hide')), h('p', inline(t)))
        : h('blockquote', { key: i }, inline(t)))
      continue
    }
    if (l.includes('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const top = cells(l)
      i += 2
      const body = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) body.push(cells(lines[i++]))
      out.push(h('div.so-scroll', { key: i }, h('table', h('thead', h('tr', top.map((c, k) => h('th', { key: k }, inline(c))))), h('tbody', body.map((r, k) => h('tr', { key: k }, r.map((c, j) => h('td', { key: j }, inline(c)))))))))
      continue
    }
    const li = /^\s*(?:[-*+]|\d+[.)])\s+/
    if (li.test(l)) {
      const ordered = /^\s*\d/.test(l)
      const items = []
      while (i < lines.length && (li.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (li.test(lines[i])) items.push(lines[i].replace(li, ''))
        else items[items.length - 1] += ` ${lines[i].trim()}`
        i++
      }
      out.push(h(ordered ? 'ol' : 'ul', { key: i }, items.map((t, k) => tie('li', k, t))))
      continue
    }
    const p = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*>|\s*```)/.test(lines[i]) && !li.test(lines[i])) p.push(lines[i++])
    out.push(tie('p', i, p.join(' ')))
  }
  return h('div', { className: cls('so-prose', seams && 'seams') }, out)
}
const plainText = md => String(md || '').replace(/^\s*>.*$/gm, '').replace(/[#*_`|>]/g, '').replace(/\n{2,}/g, '. ').replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim()

function Visual({ v }) {
  const items = v.items
  const body = v.kind === 'compare'
    ? h('div.so-vcompare', items.map((x, i) => h('div.so-vcard', { key: i, style: { '--i': i } }, h('b', x.label), h('ul', x.points.map((p, k) => h('li', { key: k }, p))))))
    : h('div', { className: `so-v${v.kind}` }, items.map((x, i) => h('div.so-vstep', { key: i, style: { '--i': i } }, h('span.so-vdot', v.kind === 'parts' ? '' : i + 1), h('div', h('b', x.label), x.points.map((p, k) => h('span', { key: k }, p))))), v.kind === 'cycle' && h('div.so-vloop', h(Icon, { n: 'redo', size: 16 }), 'and round again'))
  return h('figure.so-visual', v.title && h('figcaption', v.title), body)
}

/* ---- quiz and review --------------------------------------------------------------------------------------- */

function Quiz({ ctx, scope, title, onClose, onChange }) {
  const [asked, setAsked] = useState([])
  const [q, setQ] = useState(undefined)
  const [error, setError] = useState(null)
  const [picked, setPicked] = useState(null)
  const [text, setText] = useState('')
  const [tries, setTries] = useState(1)
  const [hint, setHint] = useState(null)
  const [res, setRes] = useState(null)
  const [missed, setMissed] = useState([])
  const [busy, setBusy] = useState(false)
  const [score, setScore] = useState({ right: 0, done: 0 })
  const load = useCallback(async ids => {
    setQ(undefined); setRes(null); setPicked(null); setText(''); setTries(1); setHint(null); setMissed([]); setError(null)
    try { setQ((await ctx.rest('/quiz/next', { method: 'POST', body: { ...scope, asked: ids } })).question) } catch (err) { setError(msg(err)) }
  }, [ctx, JSON.stringify(scope)])
  useEffect(() => { load([]) }, [load])
  const send = async body => {
    setBusy(true)
    try {
      const r = await ctx.rest('/quiz/answer', { method: 'POST', body: { question_id: q.id, tries, hints: hint ? 1 : 0, ...body } })
      setRes(r)
      haptic(r.correct ? 'success' : 'tap')
      if (r.final) { setScore(s => ({ right: s.right + (r.correct ? 1 : 0), done: s.done + 1 })); onChange && onChange() }
      else { setTries(t => t + 1); if (body.option !== undefined) setMissed(m => [...m, body.option]); setPicked(null) }
    } catch (err) { setError(msg(err)) }
    setBusy(false)
  }
  const next = () => { const ids = [...asked, q.id]; setAsked(ids); load(ids) }
  const final = res && res.final
  return h('div.so-quiz',
    h('div.so-quiztop', h(IconBtn, { icon: 'back', label: 'Leave the quiz', onClick: onClose }), h('div.so-grow', h('b', title)), h('span.so-dim', `${score.right} of ${score.done} right`)),
    error && h(Note, { bad: true }, error),
    q === undefined && !error && h('div.so-skel'),
    q === null && h('div.so-done.so-in', h(Ring, { value: score.done ? score.right / score.done : 1, size: 120 }, h('b', score.done ? `${score.right}/${score.done}` : h(Icon, { n: 'check', size: 34 }))), h('h2', score.done ? 'That’s all for now' : 'Nothing to ask here right now'), h('p.so-dim', 'What you missed comes back soon. What you know waits longer each time.'), h(Btn, { kind: 'main', onClick: onClose }, 'Done')),
    q && h('div.so-card.so-q.so-in', { key: q.id },
      h('div.so-qmeta', h('span.so-tag', q.difficulty), h('span.so-dim', q.goal)),
      h('h2', q.prompt),
      q.options
        ? h('div.so-opts', { role: 'group', 'aria-label': 'Options' }, q.options.map((o, i) => h('button', {
            key: i, type: 'button', disabled: busy || final || missed.includes(i),
            className: cls('so-opt', picked === i && 'on', missed.includes(i) && 'miss', final && i === res.answer_index && 'right', final && picked === i && !res.correct && 'miss'),
            onClick: () => { setPicked(i); send({ option: i }) }
          }, h('span.so-optn', 'ABCDEF'[i]), h('span', o), final && i === res.answer_index && h(Icon, { n: 'check', size: 18 }))))
        : h('form.so-row', { onSubmit: e => { e.preventDefault(); if (text.trim() && !final) send({ text }) } }, h('input.so-input', { value: text, autoFocus: true, disabled: busy || final, placeholder: 'Fill in the blank', 'aria-label': 'Your answer', onChange: e => setText(e.target.value) }), h(Btn, { kind: 'main', type: 'submit', disabled: busy || final || !text.trim() }, 'Check')),
      hint && h(Note, h(Icon, { n: 'bulb', size: 16 }), h('span', hint)),
      res && !final && h(Note, { bad: true }, h('span', h('b', 'Not that one. '), res.why, ' One more try.')),
      final && h('div', { className: cls('so-result', res.correct ? 'good' : 'bad'), 'aria-live': 'polite' },
        h('div.so-row', h(Icon, { n: res.correct ? 'check' : 'x', size: 20 }), h('b', res.correct ? (tries > 1 ? 'Got it on the second try' : 'Right') : `It was: ${res.answer}`), h('span.so-grow'), h('span', res.mastery_after > res.mastery_before ? `${pct(res.mastery_before)}% to ${pct(res.mastery_after)}%` : `${pct(res.mastery_after)}% known`)),
        h(Bar, { value: res.mastery_after }),
        (res.why || res.explanation) && h('p', res.why && !res.correct ? `${res.why} ` : '', res.explanation),
        res.mastered && h('p.so-dim', 'You know this one now. It comes back later to check it stuck.')),
      h('div.so-row.so-end',
        !final && q.has_hint && !hint && h(Btn, { icon: 'bulb', onClick: async () => setHint((await ctx.rest(`/quiz/hint/${q.id}`)).hint) }, 'Hint'),
        !final && h(Btn, { disabled: busy, onClick: () => send({ give_up: true }) }, 'Show me'),
        final && h(Btn, { kind: 'main', autoFocus: true, onClick: next }, 'Next question'))))
}

/* ---- explain it back ----------------------------------------------------------------------------------------- */

function ExplainBack({ ctx, section, checks, onChange }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [r, setR] = useState(null)
  const [error, setError] = useState(null)
  const go = async () => {
    setBusy(true); setError(null)
    try { setR(await ctx.rest(`/sections/${section.id}/explain-back`, { method: 'POST', body: { text }, timeoutMs: 240000 })); onChange() } catch (err) { setError(msg(err)) }
    setBusy(false)
  }
  return h('section.so-card',
    h('h2', 'Explain it back'),
    h('p.so-dim', 'Close your eyes to the text above and say it in your own words, as if to a friend.', checks ? ' Pangram also says how it reads. That’s a signal, not a judgement.' : ''),
    h('textarea.so-input', { rows: 5, value: text, maxLength: 6000, placeholder: 'It works like this…', 'aria-label': 'Your explanation', onChange: e => setText(e.target.value) }),
    h('div.so-row.so-end', h('span.so-dim', `${text.trim() ? text.trim().split(/\s+/).length : 0} words`), h('span.so-grow'), h(Btn, { kind: 'main', disabled: busy || text.trim().split(/\s+/).length < 8, onClick: go }, busy ? [h(Icon, { key: 1, n: 'spin', size: 16 }), 'Reading it'] : 'See how I did')),
    error && h(Note, { bad: true }, error),
    r && h('div.so-feedback.so-in', { 'aria-live': 'polite' },
      h(Ring, { value: r.score, size: 88 }, h('b', `${pct(r.score)}%`)),
      h('div.so-grow',
        r.got.length > 0 && h('div', h('div.so-label', 'You got'), h('ul', r.got.map((x, i) => h('li', { key: i }, x)))),
        r.missing.length > 0 && h('div', h('div.so-label', 'Still missing'), h('ul', r.missing.map((x, i) => h('li', { key: i }, x)))),
        h('p', h('b', 'Try next: '), r.next_question),
        r.authorship && h('p.so-dim', `Reads as: ${r.authorship.label} (${pct(r.authorship.human)}% human-written, by Pangram)`),
        r.authorship_note && h('p.so-dim', `The authorship check didn’t run: ${r.authorship_note}`))))
}

/* ---- change how it's explained ---------------------------------------------------------------------------------- */

const ASKS = ['Simpler words', 'Everyday examples only', 'Slower, step by step', 'Shorter', 'More detail']
function How({ how, set, meta }) {
  return h('div.so-how',
    h('label', h('span.so-label', 'Level'), h('select.so-input', { value: how.level, onChange: e => set({ ...how, level: Number(e.target.value) }) }, meta.levels.map(l => h('option', { key: l.value, value: l.value }, l.label)))),
    h('label', h('span.so-label', 'Style'), h('select.so-input', { value: how.story || 'plain', onChange: e => set({ ...how, story: e.target.value }) }, meta.stories.map(l => h('option', { key: l.value, value: l.value }, l.label)))),
    h('label', h('span.so-label', 'Compare it to something I know well (optional)'), h('input.so-input', { value: how.compare_to || '', maxLength: 40, placeholder: 'cooking, soccer, my job', onChange: e => set({ ...how, compare_to: e.target.value }) })))
}
function Rewording({ ctx, section, meta, onClose, onChange }) {
  const url = `/sections/${section.id}/wordings`
  const { data, refetch } = useQuery({ queryKey: [ID, 'wordings', section.id], queryFn: () => ctx.rest(url), refetchInterval: q => (q.state.data && q.state.data.writing ? 2500 : false) })
  const [how, setHow] = useState({ ...section.how, ask: '' })
  const [view, setView] = useState('new')
  const [again, setAgain] = useState(false)
  const [error, setError] = useState(null)
  const act = async (body, then) => {
    setError(null)
    try { await ctx.rest(url, { method: 'POST', body }); then && then(); await refetch() } catch (err) { setError(msg(err)) }
  }
  const d = data && data.draft
  const describe = x => [(meta.levels.find(l => l.value === x.level) || {}).label, (meta.stories.find(l => l.value === (x.story || 'plain')) || {}).label, x.compare_to ? `compared to ${x.compare_to}` : 'no comparison', x.ask && `“${x.ask}”`].filter(Boolean).join(' · ')
  return h('section.so-card.so-in',
    h('div.so-row', h('h2.so-grow', 'Change how it’s explained'), h(IconBtn, { icon: 'x', label: 'Close', onClick: onClose })),
    h('p.so-dim', 'Your progress and quiz stay the same.'),
    error && h(Note, { bad: true }, error),
    data && data.error && !data.writing && h(Note, { bad: true }, data.error),
    data && data.writing && h('div.so-makingbox', h(Progress, { p: data.progress || JUSTBEGUN }), h('p.so-dim', 'You can keep reading.')),
    data && !data.writing && d && !again && h('div',
      h('div.so-row', h('div.so-seg', ['new', 'now'].map(k => h('button', { key: k, type: 'button', 'aria-pressed': view === k, onClick: () => setView(k) }, k === 'new' ? 'New' : 'Now'))), h('span.so-dim', describe(view === 'new' ? d.how : section.how))),
      h('div.so-preview', h(Markdown, { text: view === 'new' ? d.body : section.body })),
      h('div.so-row.so-end', h(Btn, { onClick: () => act({ action: 'discard' }) }, 'Keep it as it is'), h(Btn, { onClick: () => setAgain(true) }, 'Try again'), h(Btn, { kind: 'main', icon: 'check', onClick: () => act({ action: 'use' }, () => { onChange(); onClose() }) }, 'Use this'))),
    data && !data.writing && (!d || again) && h('div',
      h('div.so-label', 'What should change?'),
      h('div.so-chips', ASKS.map(a => h('button', { key: a, type: 'button', 'aria-pressed': how.ask.includes(a), onClick: () => setHow({ ...how, ask: how.ask.includes(a) ? how.ask.replace(a, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',') : [how.ask, a].filter(Boolean).join(', ') }) }, a))),
      h('input.so-input', { value: how.ask, maxLength: 240, placeholder: 'Or say it yourself: what was confusing?', 'aria-label': 'What should change', onChange: e => setHow({ ...how, ask: e.target.value }) }),
      h(How, { how, set: setHow, meta }),
      data.earlier.length > 0 && h('div', h('div.so-label', 'Earlier wordings'), data.earlier.map(v => h('div.so-row.so-earlier', { key: v.id }, h('span.so-grow', describe(v.how)), h(Btn, { icon: 'redo', onClick: () => act({ action: 'restore', version_id: v.id }, onChange) }, 'Use this one')))),
      h('div.so-row.so-end', again && h(Btn, { onClick: () => setAgain(false) }, 'Back to the preview'), h(Btn, { kind: 'main', onClick: () => { setAgain(false); setView('new'); act({ action: 'preview', how }) } }, 'Preview'))))
}

/* ---- sound: one thing speaks at a time ------------------------------------------------------------------------ */

const heard = new Map()
function fetchVoice(ctx, text, who) {
  const key = `${who}|${text}`
  if (!heard.has(key)) {
    if (heard.size > 60) heard.delete(heard.keys().next().value)
    const p = ctx.rest('/speak', { method: 'POST', body: { text, who }, timeoutMs: 200000 }).catch(() => { heard.delete(key); return { local: true } })
    heard.set(key, p)
  }
  return heard.get(key)
}
/** say(text, who) speaks one line and resolves when it ends (true) or was stopped (false). */
function useSpeaker(ctx) {
  const now = useRef(null)
  const rate = useRef(1)
  const level = useRef(0)
  const stop = useCallback(() => {
    const n = now.current
    now.current = null
    if (n) { if (n.audio) n.audio.pause(); if (window.speechSynthesis) window.speechSynthesis.cancel(); n.done(false) }
  }, [])
  useEffect(() => stop, [stop])
  const say = useCallback(async (text, who = 'a', onStart) => {
    stop()
    const me = { done: () => {} }
    now.current = me
    const r = await fetchVoice(ctx, text, who)
    if (now.current !== me) return false
    return new Promise(resolve => {
      me.done = ok => { if (now.current === me) now.current = null; resolve(ok) }
      if (r && r.audio) {
        const a = new Audio(`data:${r.mime};base64,${r.audio}`)
        a.playbackRate = rate.current
        me.audio = a
        a.onplaying = () => onStart && onStart(a)
        a.onended = () => me.done(true)
        a.onerror = () => me.done(true)
        a.play().catch(() => me.done(true))
      } else if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text)
        u.rate = rate.current
        u.pitch = who === 'b' ? 0.82 : 1.05
        u.onstart = () => onStart && onStart(null)
        u.onend = u.onerror = () => me.done(true)
        window.speechSynthesis.speak(u)
      } else me.done(true)
    })
  }, [ctx, stop])
  const setRate = x => { rate.current = x; if (now.current && now.current.audio) now.current.audio.playbackRate = x }
  return { say, stop, setRate, rate, level, now }
}

/* ---- listen ----------------------------------------------------------------------------------------------------- */

function TurnPlayer({ ctx, title, turns, labels }) {
  const sp = useSpeaker(ctx)
  const [at, setAt] = useState(0)
  const [on, setOn] = useState(false)
  const [rate, setRate] = useState(1)
  const run = useRef(0)
  const list = useRef(null)
  const halt = () => { run.current++; sp.stop(); setOn(false) }
  useEffect(() => () => { run.current++ }, [])
  const play = async from => {
    const mine = ++run.current
    setOn(true)
    for (let i = from; i < turns.length; i++) {
      setAt(i)
      const el = list.current && list.current.children[i]
      if (el) el.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' })
      if (turns[i + 1]) fetchVoice(ctx, turns[i + 1].text, turns[i + 1].who)
      const ok = await sp.say(turns[i].text, turns[i].who)
      if (mine !== run.current || !ok) return
      if (turns[i].pause) await new Promise(r => setTimeout(r, turns[i].pause))
      if (mine !== run.current) return
    }
    setOn(false); setAt(0)
  }
  const speeds = [1, 1.2, 1.5, 0.85]
  return h('div.so-player.so-in',
    h('div.so-row',
      h('button.so-playbig', { type: 'button', 'aria-label': on ? 'Pause' : 'Play', onClick: () => (on ? halt() : play(at)) }, h(Icon, { n: on ? 'pause' : 'play', size: 24 })),
      h('div.so-grow', h('b', title), h('div.so-wave', { 'aria-hidden': true, className: cls('so-wave', on && 'on') }, Array.from({ length: 28 }, (_, i) => h('i', { key: i, style: { '--i': i } })))),
      h(IconBtn, { icon: 'back', label: 'Back one line', disabled: at === 0, onClick: () => { halt(); play(Math.max(0, at - 1)) } }),
      h(IconBtn, { icon: 'next', label: 'Next line', disabled: at >= turns.length - 1, onClick: () => { halt(); play(at + 1) } }),
      h(Btn, { 'aria-label': 'Speed', onClick: () => { const n = speeds[(speeds.indexOf(rate) + 1) % speeds.length]; setRate(n); sp.setRate(n) } }, `${rate}x`)),
    h('div.so-turns', { ref: list }, turns.map((t, i) => h('button', { key: i, type: 'button', className: cls(i === at && 'on', t.who === 'b' && 'b', t.hide && i > at && 'hide'), onClick: () => { halt(); play(i) } }, h('span.so-who', (labels || { a: 'Host', b: 'Curious one' })[t.who]), t.hide && i > at ? 'Think first' : t.text))))
}

const LISTEN = [
  ['podcast', 'Podcast', 'Two hosts talk it through', 'mic'],
  ['recap', 'One-minute recap', 'The idea, an example, the line to keep', 'bolt'],
  ['ear', 'Quiz in your ear', 'Hear a question, think, hear the answer', 'bulb'],
  ['read', 'Read to me', 'The lesson, word for word', 'sound']
]
function useMedia(ctx, sid) {
  return useQuery({ queryKey: [ID, 'media', sid], queryFn: () => ctx.rest(`/sections/${sid}/media`), refetchInterval: q => (q.state.data && q.state.data.media.some(m => m.status === 'making' || m.export.status === 'rendering') ? 2500 : false) })
}
const JUSTBEGUN = { seconds: 0, typical: 25, stage: '', share: 0 }
/** Coming back to a tab lands on what is being made there. */
function useOngoing(data, kinds, want, setKind) {
  const once = useRef(!!want)
  useEffect(() => { if (!data || once.current) return; once.current = true; const m = data.media.find(x => kinds.includes(x.kind) && x.status === 'making'); if (m) setKind(m.kind) }, [!!data])
}
function Making({ m, what, onMake }) {
  if (m && m.status === 'making') return h('div.so-makingbox', h('h3', `Making ${what}`), h(Progress, { p: m.progress || JUSTBEGUN }), h('p.so-dim', 'Keep reading, or leave. It carries on, and tells you when it’s ready.'))
  return h('div.so-makebox',
    m && m.error && h(Note, { bad: true }, m.error),
    h(Btn, { kind: 'main', onClick: onMake }, m ? `Make ${what} again` : `Make ${what}`))
}
function Listen({ ctx, section, want }) {
  const { data, refetch } = useMedia(ctx, section.id)
  const [kind, setKind] = useState(want || 'podcast')
  useOngoing(data, ['podcast', 'recap'], want, setKind)
  const [ear, setEar] = useState(null)
  const [error, setError] = useState(null)
  const m = data && data.media.find(x => x.kind === kind)
  const make = async () => { setError(null); try { await ctx.rest(`/sections/${section.id}/media`, { method: 'POST', body: { kind } }); refetch(); kick() } catch (err) { setError(msg(err)) } }
  useEffect(() => { if (kind === 'ear' && !ear) ctx.rest(`/sections/${section.id}/ear-quiz`).then(setEar).catch(err => setError(msg(err))) }, [kind])
  const readTurns = useMemo(() => {
    const out = []
    for (const p of String(section.body).split(/\n{2,}/)) { const t = plainText(p); if (t) out.push({ who: 'a', text: t }) }
    return out
  }, [section.body])
  return h('section.so-card.so-in',
    h('h2', 'Listen'),
    h('div.so-tiles', LISTEN.map(([k, t, d, i]) => h('button', { key: k, type: 'button', 'aria-pressed': kind === k, onClick: () => { setKind(k); setError(null) } }, h(Icon, { n: i, size: 22 }), h('b', t), h('span.so-dim', d)))),
    error && h(Note, { bad: true }, error),
    kind === 'read' && h(TurnPlayer, { key: 'read', ctx, title: section.title, turns: readTurns, labels: { a: '' } }),
    kind === 'ear' && ear && h(TurnPlayer, { key: 'ear', ctx, title: `${ear.items.length} questions`, labels: { a: 'Question', b: 'Answer' }, turns: ear.items.flatMap(x => [{ who: 'a', text: x.ask, pause: 6000 }, { who: 'b', text: x.answer, pause: 1200, hide: true }]) }),
    (kind === 'podcast' || kind === 'recap') && (m && m.status === 'ready' ? h('div', { key: kind }, m.stale && h(Note, 'Made from the older wording.', h('span.so-grow'), h(Btn, { icon: 'redo', onClick: make }, 'Make it again')), h(TurnPlayer, { ctx, title: m.data.title, turns: m.data.turns, labels: kind === 'recap' ? { a: '' } : undefined })) : data && h(Making, { m, what: kind === 'podcast' ? 'the podcast' : 'the recap', onMake: make })))
}

/* ---- watch: the HyperFrames composition itself, played live -------------------------------------------------------- */

function Film({ ctx, sid, kind, auto }) {
  const { data: f, error } = useQuery({ queryKey: [ID, 'film', sid, kind], queryFn: () => ctx.rest(`/sections/${sid}/film/${kind}`), staleTime: Infinity })
  const frame = useRef(null)
  const box = useRef(null)
  const sp = useSpeaker(ctx)
  const [scale, setScale] = useState(0)
  const [on, setOn] = useState(false)
  const [at, setAt] = useState(0)
  const [t, setT] = useState(0)
  const time = useRef(0)
  const run = useRef(0)
  const slides = kind === 'slides'
  const [narrate, setNarrate] = useState(false)
  const draw = x => { time.current = x; const w = frame.current && frame.current.contentWindow; if (w) w.postMessage({ t: x }, '*') }
  const starts = useMemo(() => { let s = 0; return f ? f.scenes.map(x => { const at = s; s += x.duration; return at }) : [] }, [f])
  useEffect(() => {
    if (!f) return
    const fit = () => box.current && setScale(Math.min(box.current.clientWidth / f.width, (document.fullscreenElement === box.current ? window.innerHeight : Infinity) / f.height))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box.current)
    document.addEventListener('fullscreenchange', fit)
    return () => { ro.disconnect(); document.removeEventListener('fullscreenchange', fit) }
  }, [f])
  useEffect(() => {
    const ready = e => { if (frame.current && e.source === frame.current.contentWindow && e.data && e.data.film) draw(slides ? hold(0) : Math.min(2.4, f.scenes[0].duration * 0.6)) }
    window.addEventListener('message', ready)
    return () => { window.removeEventListener('message', ready); run.current++ }
  }, [f])
  useEffect(() => { if (f && !slides) fetchVoice(ctx, f.scenes[0].say, 'a') }, [f])
  const began = useRef(false)
  useEffect(() => { if (auto && f && scale > 0 && !began.current) { began.current = true; const t = setTimeout(() => play(0), 900); return () => clearTimeout(t) } }, [auto, f, scale > 0])
  const hold = i => starts[i] + f.scenes[i].duration - 0.45
  const halt = () => { run.current++; sp.stop(); setOn(false) }
  const tick = (mine, from, to) => new Promise(done => {
    let last = performance.now()
    let x = from
    const step = now => {
      if (mine !== run.current) return done(false)
      x += (now - last) / 1000
      last = now
      draw(Math.min(x, to))
      setT(Math.min(x, to))
      if (x >= to) return done(true)
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
  const play = async i0 => {
    const mine = ++run.current
    setOn(true)
    for (let i = i0; i < f.scenes.length; i++) {
      setAt(i)
      if (f.scenes[i + 1]) fetchVoice(ctx, f.scenes[i + 1].say, 'a')
      const s = f.scenes[i]
      let started
      const begun = new Promise(r => { started = r })
      const spoken = sp.say(s.say, 'a', () => started())
      await Promise.race([begun, spoken, new Promise(r => setTimeout(r, 20000))])
      if (mine !== run.current) return
      const ok = await tick(mine, starts[i], starts[i] + s.duration - (i === f.scenes.length - 1 ? 0.02 : 0))
      if (!ok || mine !== run.current) return
      await Promise.race([spoken, new Promise(r => setTimeout(r, 2500))])
      if (mine !== run.current) return
    }
    setOn(false)
  }
  const slide = async i => {
    halt()
    const mine = ++run.current
    setAt(i)
    if (narrate) sp.say(f.scenes[i].say, 'a')
    await tick(mine, starts[i], Math.min(hold(i), starts[i] + 3.2))
    if (mine === run.current) draw(hold(i))
  }
  if (error) return h(Note, { bad: true }, msg(error))
  if (!f) return h('div.so-skel')
  return h('div.so-film', { className: cls('so-film', f.height > f.width && 'tall') },
    h('div.so-stage', { ref: box, style: { aspectRatio: `${f.width}/${f.height}` }, tabIndex: 0, onKeyDown: e => { if (slides && e.key === 'ArrowRight' && at < f.scenes.length - 1) slide(at + 1); if (slides && e.key === 'ArrowLeft' && at > 0) slide(at - 1) } },
      scale > 0 && h(SandboxedFrame, { ref: frame, title: f.title, src: `data:text/html;charset=utf-8,${encodeURIComponent(f.html)}`, style: { width: f.width, height: f.height, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0, display: 'block', maxWidth: 'none', pointerEvents: 'none' } }),
      !slides && !on && h('button.so-filmplay', { type: 'button', 'aria-label': 'Play', onClick: () => play(at >= f.scenes.length - 1 ? 0 : at) }, h(Icon, { n: 'play', size: 34 }))),
    h('div.so-row.so-filmbar',
      slides
        ? [h(IconBtn, { key: 1, icon: 'back', label: 'Previous slide', disabled: at === 0, onClick: () => slide(at - 1) }), h('span.so-dim', { key: 2 }, `${at + 1} of ${f.scenes.length}`), h(IconBtn, { key: 3, icon: 'next', label: 'Next slide', disabled: at === f.scenes.length - 1, onClick: () => slide(at + 1) }), h(Btn, { key: 4, icon: 'sound', 'aria-pressed': narrate, onClick: () => { if (narrate) sp.stop(); else sp.say(f.scenes[at].say, 'a'); setNarrate(!narrate) } }, narrate ? 'Stop speaking' : 'Speak the notes')]
        : [h(IconBtn, { key: 1, icon: on ? 'pause' : 'play', label: on ? 'Pause' : 'Play', onClick: () => (on ? halt() : play(at)) }), h('div.so-chapters', { key: 2 }, f.scenes.map((s, i) => h('button', { key: i, type: 'button', title: s.heading, 'aria-label': s.heading, style: { flex: s.duration }, onClick: () => { halt(); play(i) } }, h('i', { style: { width: `${Math.max(0, Math.min(1, (t - starts[i]) / s.duration)) * 100}%` } })))), h('span.so-dim', { key: 3 }, `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} / ${Math.floor(f.duration / 60)}:${String(Math.floor(f.duration % 60)).padStart(2, '0')}`)],
      h('span.so-grow'),
      h(IconBtn, { icon: 'full', label: 'Full screen', onClick: () => box.current.requestFullscreen && box.current.requestFullscreen() })),
    slides && h('p.so-notes', h('b', 'Notes: '), f.scenes[at].say))
}
const WATCH = [
  ['explainer', 'Explainer', 'A narrated video, about 80 seconds', 'play'],
  ['short', 'Short', 'Vertical, under 40 seconds', 'phone'],
  ['slides', 'Slides', 'Click through, with notes', 'slides']
]
function Watch({ ctx, section, want }) {
  const client = useQueryClient()
  const { data, refetch } = useMedia(ctx, section.id)
  const [kind, setKind] = useState(want || 'explainer')
  useOngoing(data, ['explainer', 'short', 'slides'], want, setKind)
  const [error, setError] = useState(null)
  const m = data && data.media.find(x => x.kind === kind)
  const make = async () => { setError(null); try { await ctx.rest(`/sections/${section.id}/media`, { method: 'POST', body: { kind } }); client.removeQueries({ queryKey: [ID, 'film', section.id, kind] }); refetch(); kick() } catch (err) { setError(msg(err)) } }
  const save = async render => {
    setError(null)
    try { const r = await ctx.rest(`/sections/${section.id}/export`, { method: 'POST', body: { kind, render }, timeoutMs: 120000 }); if (!render && ctx.os && ctx.os.revealPath) ctx.os.revealPath(r.folder); refetch() } catch (err) { setError(msg(err)) }
  }
  const label = (WATCH.find(w => w[0] === kind) || [])[1]
  return h('section.so-card.so-in',
    h('h2', 'Watch'),
    h('div.so-tiles', WATCH.map(([k, t, d, i]) => h('button', { key: k, type: 'button', 'aria-pressed': kind === k, onClick: () => { setKind(k); setError(null) } }, h(Icon, { n: i, size: 22 }), h('b', t), h('span.so-dim', d)))),
    error && h(Note, { bad: true }, error),
    m && m.status === 'ready'
      ? h('div', { key: kind },
          m.stale && h(Note, 'Made from the older wording.', h('span.so-grow'), h(Btn, { icon: 'redo', onClick: make }, 'Make it again')),
          h(Film, { key: `${section.id}${kind}${m.data.title}`, ctx, sid: section.id, kind }),
          h('div.so-row.so-export',
            h('span.so-dim.so-grow', m.export.status === 'rendering' ? 'Rendering with HyperFrames. A few minutes; you can leave.' : m.export.status === 'done' ? 'Rendered.' : 'A HyperFrames composition: save the project, or render an MP4 on this computer.'),
            m.export.status === 'done' && ctx.os && ctx.os.revealPath && h(Btn, { icon: 'file', onClick: () => ctx.os.revealPath(m.export.file) }, 'Show the MP4'),
            h(Btn, { onClick: () => save(false) }, 'Save project'),
            h(Btn, { disabled: m.export.status === 'rendering' || !data.can.node || !data.can.ffmpeg, title: data.can.ffmpeg && data.can.node ? 'Uses npx hyperframes' : 'Needs Node 22 and FFmpeg on this computer', onClick: () => save(true) }, m.export.status === 'rendering' ? [h(Icon, { key: 1, n: 'spin', size: 16 }), 'Rendering'] : 'Render MP4'),
            h(IconBtn, { icon: 'redo', label: 'Make it again', onClick: make })),
          m.export.error && h(Note, { bad: true }, m.export.error))
      : data && h(Making, { m, what: kind === 'slides' ? 'the slides' : `the ${label.toLowerCase()}`, onMake: make }))
}

/* ---- play: the idea as a toy ------------------------------------------------------------------------------------------ */

function Play({ ctx, section }) {
  const { data, refetch } = useMedia(ctx, section.id)
  const [error, setError] = useState(null)
  const [level, setLevel] = useState(0)
  const frame = useRef(null)
  const box = useRef(null)
  const m = data && data.media.find(x => x.kind === 'play')
  const make = async () => { setError(null); setLevel(0); try { await ctx.rest(`/sections/${section.id}/media`, { method: 'POST', body: { kind: 'play' } }); refetch(); kick() } catch (err) { setError(msg(err)) } }
  useEffect(() => {
    const on = e => {
      if (!frame.current || e.source !== frame.current.contentWindow || !e.data || !e.data.game) return
      if (e.data.game === 'level') { setLevel(Math.min(3, Number(e.data.level) || 0)); haptic('success') }
      if (e.data.game === 'won') setLevel(3)
      if (e.data.game === 'error') ctx.rest(`/sections/${section.id}/play/fix`, { method: 'POST', body: { text: String(e.data.text).slice(0, 300) } }).then(() => refetch()).catch(() => {})
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [section.id])
  return h('section.so-card.so-in',
    h('div.so-row', h('h2.so-grow', m && m.status === 'ready' ? m.data.title : 'Play'), m && m.status === 'ready' && [h('span.so-levels', { key: 1, 'aria-label': `${level} of 3 levels` }, [1, 2, 3].map(n => h('i', { key: n, className: cls(n <= level && 'on') }, n <= level ? h(Icon, { n: 'check', size: 14 }) : n))), h(IconBtn, { key: 2, icon: 'full', label: 'Full screen', onClick: () => box.current.requestFullscreen && box.current.requestFullscreen() }), h(IconBtn, { key: 3, icon: 'redo', label: 'Make another game', onClick: make })]),
    error && h(Note, { bad: true }, error),
    m && m.status === 'ready'
      ? [m.stale && h(Note, { key: 'n' }, 'Made from the older wording.'), h('div.so-game', { key: 'g', ref: box }, h(SandboxedFrame, { key: `${m.data.title}${m.data.html.length}`, ref: frame, title: m.data.title, src: `data:text/html;charset=utf-8,${encodeURIComponent(m.data.html)}`, style: { width: '100%', height: '100%', border: 0, display: 'block' } }))]
      : data && (m && m.status === 'making' ? h(Making, { m, what: 'the game' }) : h('div.so-makebox', h(Icon, { n: 'play', size: 44 }), h('p.so-dim', 'A little game where you work the idea with your hands.'), m && m.error && h(Note, { bad: true }, m.error), h(Btn, { kind: 'main', onClick: make }, 'Make the game'))))
}

/* ---- talk: speak, be heard, interrupt ---------------------------------------------------------------------------------- */

function wavOf(chunks, from) {
  const n = chunks.reduce((a, c) => a + c.length, 0)
  const all = new Float32Array(n)
  let o = 0
  for (const c of chunks) { all.set(c, o); o += c.length }
  const step = from / 16000
  const len = Math.floor(n / step)
  const buf = new DataView(new ArrayBuffer(44 + len * 2))
  const text = (at, s) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF'); buf.setUint32(4, 36 + len * 2, true); text(8, 'WAVEfmt '); buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, 16000, true); buf.setUint32(28, 32000, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); text(36, 'data'); buf.setUint32(40, len * 2, true)
  for (let i = 0; i < len; i++) { const a = Math.floor(i * step); const b = Math.min(n, Math.floor((i + 1) * step)); let s = 0; for (let k = a; k < b; k++) s += all[k]; buf.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s / Math.max(1, b - a))) * 32767, true) }
  return new Uint8Array(buf.buffer)
}
/** Listens for speech: starts after 160 ms of voice, ends after 800 ms of quiet. */
function openMic(onStart, onEnd, onLevel) {
  let stream
  let ac
  let closed = false
  const ready = (async () => {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    if (closed) return stream.getTracks().forEach(t => t.stop())
    ac = new AudioContext()
    const src = ac.createMediaStreamSource(stream)
    const node = ac.createScriptProcessor(2048, 1, 1)
    let floor = 0.006
    let pre = []
    let talk = null
    let loud = 0
    let quiet = 0
    node.onaudioprocess = e => {
      const x = new Float32Array(e.inputBuffer.getChannelData(0))
      let s = 0
      for (let i = 0; i < x.length; i++) s += x[i] * x[i]
      const rms = Math.sqrt(s / x.length)
      const ms = (x.length / ac.sampleRate) * 1000
      onLevel(rms)
      const voice = rms > Math.max(0.014, floor * 3.2)
      if (!voice) floor = floor * 0.95 + rms * 0.05
      if (!talk) {
        pre.push(x)
        if (pre.length > 8) pre.shift()
        loud = voice ? loud + ms : 0
        if (loud > 160) { talk = pre; pre = []; quiet = 0; onStart() }
      } else {
        talk.push(x)
        quiet = voice ? 0 : quiet + ms
        const long = (talk.length * x.length) / ac.sampleRate > 40
        if (quiet > 800 || long) { const t = talk; talk = null; loud = 0; onEnd(wavOf(t, ac.sampleRate)) }
      }
    }
    src.connect(node)
    node.connect(ac.destination)
  })()
  return { ready, close() { closed = true; if (stream) stream.getTracks().forEach(t => t.stop()); if (ac) ac.close() } }
}
/** Draws a sketch stroke by stroke, like a hand with a marker. */
function Board({ sketch, busy }) {
  const ink = { ink: 'var(--so-ink)', blue: '#2f3cdc', red: '#d7322a', yellow: '#e0a300', green: '#1a7748', pink: '#d9589a' }
  let t = 0.15
  const marks = sketch ? sketch.marks.map(m => { const len = m.kind === 'text' ? 0.45 : m.kind === 'path' ? 0.95 : m.kind === 'circle' ? Math.min(0.9, 0.3 + m.r / 160) : 0.5; const s = t; t += len * 0.82; return { ...m, s, len } }) : []
  const line = (m, i) => {
    const color = ink[m.color]
    const st = { '--s': `${m.s}s`, '--d': `${m.len}s`, stroke: color }
    const shape = { className: 'so-stroke', style: st, pathLength: 1 }
    const tint = m.fill ? { className: 'so-tint', style: { '--s': `${m.s + m.len}s`, fill: color } } : null
    if (m.kind === 'circle') return [tint && h('circle', { ...tint, cx: m.x, cy: m.y, r: m.r }), h('circle', { ...shape, cx: m.x, cy: m.y, r: m.r })]
    if (m.kind === 'box') return [tint && h('rect', { ...tint, x: m.x, y: m.y, width: m.w, height: m.h, rx: 10 }), h('rect', { ...shape, x: m.x, y: m.y, width: m.w, height: m.h, rx: 10 })]
    if (m.kind === 'path') return [tint && h('path', { ...tint, d: m.d }), h('path', { ...shape, d: m.d })]
    if (m.kind === 'text') return h('text', { className: 'so-ink', style: { '--s': `${m.s}s`, '--d': `${m.len}s`, fill: color }, x: Math.min(m.x, 880 - m.text.length * m.size * 0.47), y: m.y, fontSize: m.size }, m.text)
    const a = Math.atan2(m.y2 - m.y, m.x2 - m.x)
    const tip = k => `${m.x2 - 17 * Math.cos(a + k)} ${m.y2 - 17 * Math.sin(a + k)}`
    return [h('path', { ...shape, d: `M${m.x} ${m.y} L${m.x2} ${m.y2}` }), m.kind === 'arrow' && h('path', { className: 'so-stroke', pathLength: 1, style: { '--s': `${m.s + m.len * 0.8}s`, '--d': '.22s', stroke: color }, d: `M${tip(0.45)} L${m.x2} ${m.y2} L${tip(-0.45)}` })]
  }
  return h('figure.so-board', h('svg', { key: sketch ? sketch.title + sketch.marks.length : 'none', viewBox: '0 0 900 560', role: 'img', 'aria-label': sketch ? `Drawing: ${sketch.title}` : 'Whiteboard' },
    h('defs', h('filter', { id: 'so-hand', x: '-5%', y: '-5%', width: '110%', height: '110%' }, h('feTurbulence', { type: 'fractalNoise', baseFrequency: '.013', numOctaves: 2, seed: 4, result: 'n' }), h('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 7 }))),
    h('g', { filter: 'url(#so-hand)', fill: 'none', strokeWidth: 4.5, strokeLinecap: 'round', strokeLinejoin: 'round' }, marks.filter(m => m.kind !== 'text').map((m, i) => h('g', { key: i }, line(m, i)))),
    h('g', marks.filter(m => m.kind === 'text').map((m, i) => h('g', { key: i }, line(m, i))))),
    h('figcaption', busy ? [h(Icon, { key: 1, n: 'spin', size: 16 }), 'Getting the marker'] : sketch ? sketch.title : ''))
}
function Talk({ ctx, section, onChange }) {
  const sp = useSpeaker(ctx)
  const [log, setLog] = useState([])
  const [state, setState] = useState('idle')
  const [mic, setMic] = useState(false)
  const [text, setText] = useState('')
  const [sketch, setSketch] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [quiz, setQuiz] = useState(false)
  const [error, setError] = useState(null)
  const orb = useRef(null)
  const turns = useRef([])
  const run = useRef(0)
  const open = useRef(null)
  const end = useRef(null)
  const add = t => { turns.current = [...turns.current, t]; setLog(turns.current) }
  useEffect(() => { if (end.current) end.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [log, state])
  useEffect(() => () => { run.current++; if (open.current) open.current.close() }, [])
  const answer = async said => {
    const mine = ++run.current
    sp.stop()
    setError(null)
    const history = turns.current
    if (said) add({ who: 'me', text: said })
    setState('thinking')
    try {
      const r = await ctx.rest(`/sections/${section.id}/talk`, { method: 'POST', body: { text: said, history }, timeoutMs: 120000 })
      if (mine !== run.current) return
      add({ who: 'tutor', text: r.say })
      if (r.draw) {
        setDrawing(true)
        ctx.rest(`/sections/${section.id}/sketch`, { method: 'POST', body: { what: r.draw }, timeoutMs: 120000 }).then(setSketch).catch(() => {}).finally(() => setDrawing(false))
      }
      if (r.quiz) setQuiz(true)
      setState('speaking')
      for (const part of r.say.match(/[^.!?]+[.!?]*\s*/g) || [r.say]) { if (!(await sp.say(part, 'a')) || mine !== run.current) return }
      if (mine === run.current) setState('idle')
    } catch (err) { if (mine === run.current) { setError(msg(err)); setState('idle') } }
  }
  const toggle = async () => {
    if (open.current) { open.current.close(); open.current = null; setMic(false); return }
    setError(null)
    const m = openMic(
      () => { run.current++; sp.stop(); setState('hearing') },
      async wav => {
        setState('thinking')
        try {
          const r = await ctx.rest('/hear', { method: 'POST', upload: { filename: 'talk.wav', contentType: 'audio/wav', bytes: wav }, timeoutMs: 120000 })
          if (r.text.trim()) answer(r.text.trim()); else setState('idle')
        } catch (err) { setError(msg(err)); setState('idle'); if (open.current) { open.current.close(); open.current = null; setMic(false) } }
      },
      l => { if (orb.current) orb.current.style.setProperty('--l', Math.min(1, l * 9).toFixed(3)) })
    open.current = m
    try { await m.ready; setMic(true); if (!turns.current.length) answer('') } catch (err) { open.current = null; setError('The microphone isn’t allowed. You can type instead, or allow Hermes in your system’s privacy settings.') }
  }
  const words = { idle: mic ? 'Listening. Just talk.' : turns.current.length ? 'Your turn' : 'Ready when you are', hearing: 'Hearing you', thinking: 'Thinking', speaking: mic ? 'Speaking. Talk over me any time.' : 'Speaking' }
  return h('section.so-card.so-talk.so-in',
    h('div.so-talktop',
      h('button.so-orb', { ref: orb, type: 'button', className: cls('so-orb', state, mic && 'live'), 'aria-label': mic ? 'Stop the microphone' : 'Start talking', onClick: toggle }, h('i'), h('i'), h(Icon, { n: mic ? 'stop' : 'mic', size: 30 })),
      h('div', { 'aria-live': 'polite' }, h('h2', words[state]), h('p.so-dim', mic ? 'Press the circle to stop the microphone.' : 'Press the circle to talk, or type below.'))),
    error && h(Note, { bad: true }, error),
    h('div', { className: cls('so-talkgrid', !(sketch || drawing) && 'solo') }, (sketch || drawing) && h(Board, { sketch, busy: drawing }), log.length > 0 && h('div.so-log', log.map((t, i) => h('div', { key: i, className: cls('so-say', t.who) }, t.text)), state === 'thinking' && h('div.so-say.tutor.so-dots', h('i'), h('i'), h('i')), h('span', { ref: end }))),
    quiz && h(Quiz, { ctx, scope: { section_id: section.id }, title: 'Show me', onClose: () => setQuiz(false), onChange }),
    h('form.so-row', { onSubmit: e => { e.preventDefault(); const t = text.trim(); if (t) { setText(''); answer(t) } } },
      h('input.so-input.so-grow', { value: text, placeholder: 'Or type it', 'aria-label': 'Say something', maxLength: 1000, onChange: e => setText(e.target.value) }),
      h(Btn, { kind: 'main', type: 'submit', disabled: !text.trim() || state === 'thinking' }, 'Send'),
      !log.length ? h(Btn, { onClick: () => answer('') }, 'You start') : h(Btn, { icon: 'pen', disabled: drawing || state === 'thinking', onClick: () => answer('Draw it for me on the whiteboard.') }, 'Draw it'),
      state === 'speaking' && h(Btn, { icon: 'stop', onClick: () => { run.current++; sp.stop(); setState('idle') } }, 'Quiet')))
}

/** One-click samples, so nothing has to be found or dragged. */
function Samples({ ctx, list, busy, onUse, onError }) {
  const [at, setAt] = useState(null)
  const use = async k => {
    setAt(k)
    try { onUse(k, await ctx.rest(`/samples/${k}`, { method: 'POST', timeoutMs: 300000 })) } catch (err) { onError(msg(err)) }
    setAt(null)
  }
  return h('div.so-samples', h('span.so-label', 'Try a sample'), list.map(([k, label, kind]) => h('button', { key: k, type: 'button', disabled: !!at || busy, className: kind, onClick: () => use(k) }, h(Icon, { n: at === k ? 'spin' : kind === 'hand' ? 'cam' : 'file', size: 15 }), label)))
}
/* ---- showcase: one page in, the whole chain out ------------------------------------------------------------------------- */

const pause = ms => new Promise(r => setTimeout(r, reduced() ? Math.min(ms, 120) : ms))
function Paper({ blocks, shown, parts }) {
  const kindOf = t => {
    if (!parts) return ''
    const flat = s => s.replace(/[^a-z0-9]+/gi, '').toLowerCase()
    const k = flat(t)
    const tries = [0.1, 0.5, 0.75].map(f => k.slice(Math.floor(k.length * f), Math.floor(k.length * f) + 26)).filter(x => x.length > 12)
    const hit = parts.find(p => { const x = flat(p.text); return tries.some(y => x.includes(y)) })
    return hit ? hit.kind : ''
  }
  return h('div.so-paper', blocks.map((b, i) => h('div', { key: i, className: cls('so-blk', i < shown && 'on', kindOf(b.text)), style: { left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, minHeight: `${b.h * 100}%`, fontSize: /title|header/i.test(b.type) ? `${Math.min(3.1, Math.max(1.5, b.h * 62))}cqw` : `${Math.min(2.1, Math.max(0.9, Math.sqrt((b.w * b.h * 1.29) / Math.max(20, b.text.length)) * 122))}cqw` } }, b.text)))
}
const Step = ({ n, title, by, state, children }) => h('div', { className: cls('so-step', state) }, h('span.so-num', state === 'done' ? h(Icon, { n: 'check', size: 16 }) : state === 'now' ? h(Icon, { n: 'spin', size: 16 }) : n), h('div.so-grow', h('div.so-row', h('b', title), by && h('span.so-tag', by)), state !== 'wait' && children))
function Showcase({ ctx, home, go }) {
  const [up, setUp] = useState(null)
  const [shown, setShown] = useState(0)
  const [src, setSrc] = useState(null)
  const [course, setCourse] = useState(null)
  const [pop, setPop] = useState(0)
  const [film, setFilm] = useState(null)
  const [at, setAt] = useState(0)
  const [secs, setSecs] = useState([])
  const [error, setError] = useState(null)
  const [over, setOver] = useState(false)
  const run = useRef(0)
  const pick = useRef(null)
  useEffect(() => () => { run.current++ }, [])
  const begin = async get => {
    const mine = ++run.current
    const ok = () => mine === run.current
    setError(null); setUp(null); setShown(0); setSrc(null); setCourse(null); setPop(0); setFilm(null); setSecs([])
    const took = t => setSecs(s => [...s, ((performance.now() - t) / 1000)])
    try {
      setAt(1)
      let t = performance.now()
      const u = await get()
      if (!ok()) return
      setUp(u)
      for (let i = 0; i <= (u.blocks || []).length; i++) { setShown(i); await pause(150); if (!ok()) return }
      took(t)
      setAt(2)
      t = performance.now()
      const v = home.services.pangram ? await ctx.rest(`/uploads/${u.id}/check`, { method: 'POST', timeoutMs: 120000 }) : null
      await pause(500)
      if (!ok()) return
      setSrc(v)
      took(t)
      await pause(1400)
      if (v && v.ai > 0.5) { setAt(9); return }
      setAt(3)
      t = performance.now()
      const made = await ctx.rest('/courses', { method: 'POST', body: { upload_id: u.id, how: { level: home.prefs.level, story: home.prefs.story, compare_to: home.prefs.compare_to } } })
      let c
      for (;;) { c = await ctx.rest(`/courses/${made.id}`); if (!ok()) return; setCourse(c); if (['ready', 'failed'].includes(c.status)) break; await pause(2000) }
      for (let i = 0; i <= c.list.length; i++) { setPop(i); await pause(420); if (!ok()) return }
      if (c.status === 'failed') throw new Error(c.error)
      took(t)
      setAt(4)
      t = performance.now()
      const s = c.list[0]
      const find = async () => ((await ctx.rest(`/sections/${s.id}/media`)).media.find(m => m.kind === 'explainer'))
      let m = await find()
      if (!m || m.status !== 'ready') { await ctx.rest(`/sections/${s.id}/media`, { method: 'POST', body: { kind: 'explainer' } }); do { await pause(2000); if (!ok()) return; m = await find() } while (m && m.status === 'making') }
      await pause(700)
      if (!ok()) return
      if (!m || m.status !== 'ready') throw new Error((m && m.error) || 'The video couldn’t be made.')
      setFilm(s.id)
      took(t)
      setAt(5)
      setTimeout(() => { const e = document.querySelector('.so-show .so-film'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 500)
    } catch (err) { if (ok()) { setError(msg(err)); setAt(0) } }
  }
  const sample = k => begin(async () => (await ctx.rest(`/samples/${k}`, { method: 'POST', timeoutMs: 300000 })).upload)
  const drop = f => f && begin(() => f.arrayBuffer().then(b => ctx.rest('/upload', { method: 'POST', upload: { filename: f.name, contentType: f.type || 'application/pdf', bytes: new Uint8Array(b) }, timeoutMs: 300000 })))
  const st = n => (at === 9 ? (n < 3 ? 'done' : 'wait') : at > n ? 'done' : at === n ? 'now' : 'wait')
  const sec = i => (secs[i] !== undefined ? `${secs[i].toFixed(1)} s` : '')
  return h('div.so-page.so-show',
    h('header.so-hero.so-in', h('div.so-grow', h('div.so-eyebrow', 'From one page'), h('h1', 'Watch it ', h('em', 'work'))), at > 0 && h(Btn, { icon: 'redo', onClick: () => { run.current++; setAt(0); setUp(null) } }, 'Start over')),
    error && h(Note, { bad: true }, error),
    !at && h('div', { className: cls('so-drop so-bigdrop', over && 'over'), onDragOver: e => { e.preventDefault(); setOver(true) }, onDragLeave: () => setOver(false), onDrop: e => { e.preventDefault(); setOver(false); drop(e.dataTransfer.files[0]) } },
      h('input', { ref: pick, type: 'file', hidden: true, accept: '.pdf', onChange: e => drop(e.target.files[0]) }),
      h(Icon, { n: 'file', size: 54 }), h('h2', 'Drop a page'),
      h('div.so-row', h(Btn, { kind: 'main', icon: 'file', onClick: () => sample('faraday') }, 'A real one: Faraday, 1861'), h(Btn, { icon: 'file', onClick: () => sample('ai-article') }, 'An AI-written article'), h(Btn, { onClick: () => pick.current.click() }, 'Choose a file'))),
    at > 0 && h('div.so-showgrid',
      h('div', up ? h(Paper, { blocks: up.blocks || [], shown, parts: src && src.parts }) : h('div.so-paper.so-empty2', h(Icon, { n: 'spin', size: 34 }))),
      h('div.so-steps',
        h(Step, { n: 1, title: 'Read the page', by: up ? up.read_by : 'Reducto', state: st(1) }, h('p.so-dim', up ? `${(up.blocks || []).length} blocks found` : 'Reading', sec(0) && ` · ${sec(0)}`)),
        h(Step, { n: 2, title: 'Who wrote it?', by: 'Pangram', state: st(2) }, src ? [h(Mix, { key: 1, v: src }), h('p.so-dim', { key: 2 }, h('b', src.ai > 0.5 ? 'AI-written' : `${pct(src.human)}% human`), src.saved ? ' · saved result' : sec(1) && ` · ${sec(1)}`)] : h('p.so-dim', 'Checking part by part')),
        at === 9
          ? h('div.so-stop.so-in', h('h2', 'Stop. Nobody wrote this.'), h('p', 'Study OS tells you before you learn from it. You decide.'), h('div.so-row', h(Btn, { kind: 'main', onClick: () => sample('faraday') }, 'Try a real one'), h(Btn, { onClick: () => go('new') }, 'Use it anyway')))
          : [
              h(Step, { key: 3, n: 3, title: 'Make the course', by: 'Claude, in Hermes', state: st(3) }, course ? h('div.so-pops', h('b', course.title), course.list.map((s, i) => h('span', { key: s.id, className: cls(i < pop && 'on') }, h(Icon, { n: 'check', size: 14 }), s.title, h('em', `${s.goals.length} goals`)))) : h('p.so-dim', 'Planning')),
              h(Step, { key: 4, n: 4, title: 'Make the video', by: 'HyperFrames', state: st(4) }, h('p.so-dim', film ? 'Ready' : 'Drawing the scenes')),
              at === 5 && h('div.so-row.so-in', { key: 5 }, h(Btn, { kind: 'main', icon: 'book', onClick: () => go('course', course.id) }, 'Open the course'))
            ])),
    film && h('section.so-card.so-in', h(Film, { ctx, sid: film, kind: 'explainer', auto: true })),
    h(AorB, { ctx }))
}
function AorB({ ctx }) {
  const [sides, setSides] = useState(null)
  const [pick, setPick] = useState(null)
  const [read, setRead] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const deal = async () => {
    setBusy(true); setPick(null); setRead({}); setError(null)
    try {
      const [p, a] = await Promise.all(['essay-person', 'essay-ai'].map(k => ctx.rest(`/samples/${k}`, { method: 'POST' })))
      const two = [{ ai: false, text: p.text }, { ai: true, text: a.text }]
      setSides(Math.random() < 0.5 ? two : two.reverse())
      setTimeout(() => { const e = document.querySelector('.so-ab'); if (e) e.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }) }, 150)
    } catch (err) { setError(msg(err)) }
    setBusy(false)
  }
  const guess = async i => {
    setPick(i)
    try { const r = await Promise.all(sides.map(s => ctx.rest('/read', { method: 'POST', body: { text: s.text }, timeoutMs: 90000 }))); await pause(700); setRead(r) } catch (err) { setError(msg(err)) }
  }
  return h('section.so-card.so-ab',
    h('div.so-row', h('h2.so-grow', pick === null ? 'A or B: which one did AI write?' : sides[pick].ai ? 'You got it' : 'That one was a person'), h(Btn, { kind: sides ? 'quiet' : 'main', icon: sides ? 'redo' : 'play', disabled: busy, onClick: deal }, sides ? 'Again' : 'Play')),
    error && h(Note, { bad: true }, error),
    sides && h('div.so-cols2', sides.map((s, i) => h('div.so-in', { key: `${i}${s.ai}`, className: cls('so-abside so-in', pick !== null && read[i] && (s.ai ? 'model' : 'mine')) },
      h('div.so-row', h('span.so-optn', 'AB'[i]), pick !== null && read[i] && h('b', s.ai ? 'AI' : 'Michael Faraday, 1861'), h('span.so-grow'), pick === null && h(Btn, { onClick: () => guess(i) }, 'This is AI')),
      read[i] ? [h(Mix, { key: 1, v: read[i] }), h(Painted, { key: 2, v: read[i] })] : [pick !== null && h('div.so-scanbar', { key: 1 }, h('i')), h('p', { key: 2 }, s.text)]))))
}

/* ---- class: shared pieces --------------------------------------------------------------------------------------- */

const openLink = (ctx, url) => { if (ctx.os && ctx.os.openExternal) ctx.os.openExternal(url); else window.open(url, '_blank') }
const dayOf = s => { const d = new Date(s); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
const today = () => dayOf(new Date())
const when = s => new Date(s).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const dueIn = s => {
  if (!s) return 'No deadline'
  const h_ = (new Date(s) - Date.now()) / 3600000
  if (h_ < 0) return 'Past due'
  if (h_ < 24) return `Due in ${Math.max(1, Math.round(h_))} h`
  return `Due in ${Math.round(h_ / 24)} d`
}
const inputDate = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
/** A text with Pangram's reading of each part painted on it. */
const Painted = ({ v }) => v && v.parts && v.parts.length ? h('p.so-painted', v.parts.map((p, i) => h('span', { key: i, style: { '--i': i }, className: p.kind, title: `Reads as ${p.kind === 'ai' ? 'AI-written' : p.kind === 'assisted' ? 'AI-assisted' : 'human-written'}${p.sure ? `, ${p.sure.toLowerCase()} confidence` : ''}${p.humanized ? ', may be run through a humanizer' : ''}` }, p.text))) : null
const Mix = ({ v, small }) => h('div', { className: cls('so-mix', small && 'small'), role: 'img', 'aria-label': `${pct(v.human)}% human, ${pct(v.assisted)}% assisted, ${pct(v.ai)}% AI` }, h('i.hu', { style: { flex: v.human } }), h('i.as', { style: { flex: v.assisted } }), h('i.ai', { style: { flex: v.ai } }))
/** Two weeks of deadlines and meetings. */
function Weeks({ items }) {
  const start = today()
  start.setDate(start.getDate() - start.getDay())
  return h('div.so-cal', Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const on = items.filter(x => x.at && dayOf(x.at).getTime() === d.getTime())
    const is = d.getTime() === today().getTime()
    return h('div.so-day', { key: i, className: cls('so-day', is && 'now', d < today() && 'past') }, h('span', `${d.toLocaleDateString(undefined, { weekday: 'narrow' })} ${d.getDate()}`), on.slice(0, 3).map((x, k) => h('i', { key: k, className: x.kind, title: `${x.title}, ${when(x.at)}` }, x.title)))
  }))
}
function Meetings({ ctx, list, mine, who, onChange }) {
  const [open, setOpen] = useState(false)
  const t = new Date()
  t.setDate(t.getDate() + 1)
  t.setHours(15, 0, 0, 0)
  const [start, setStart] = useState(inputDate(t))
  const [note, setNote] = useState('')
  const [title, setTitle] = useState('')
  const [guests, setGuests] = useState([])
  const [error, setError] = useState(null)
  const go = async () => {
    setError(null)
    try {
      const r = await ctx.rest('/meetings', { method: 'POST', body: { title: title || (mine ? `Help session: ${who.me.name || 'student'}` : guests.length > 1 ? 'Group session' : 'Session'), who: mine ? [who.me.name, who.me.email, who.me.teacher].filter(Boolean) : guests, start: new Date(start).toISOString(), minutes: 30, note, asked_by: mine ? 'student' : 'teacher', book: !mine } })
      if (!mine) openLink(ctx, r.link)
      setOpen(false); setNote(''); setTitle(''); onChange()
    } catch (err) { setError(msg(err)) }
  }
  const set = async (m, s) => { const r = await ctx.rest(`/meetings/${m.id}/${s}`, { method: 'POST' }); if (r.link) openLink(ctx, r.link); onChange() }
  return h('section.so-card',
    h('div.so-row', h('h2.so-grow', 'Meetings'), h(Btn, { icon: 'plus', onClick: () => setOpen(!open) }, mine ? 'Ask for one' : 'Book one')),
    open && h('div.so-meetform.so-in',
      !mine && h('div.so-chips', who.students.map(s => h('button', { key: s.id, type: 'button', 'aria-pressed': guests.includes(s.email || s.name), onClick: () => { const k = s.email || s.name; setGuests(guests.includes(k) ? guests.filter(x => x !== k) : [...guests, k]) } }, s.name))),
      h('div.so-how', h('label', h('span.so-label', 'When'), h('input.so-input', { type: 'datetime-local', value: start, onChange: e => setStart(e.target.value) })), h('label', h('span.so-label', 'About'), h('input.so-input', { value: title, placeholder: mine ? 'What you need help with' : 'Session', onChange: e => setTitle(e.target.value) })), h('label', h('span.so-label', 'Note'), h('input.so-input', { value: note, onChange: e => setNote(e.target.value) }))),
      error && h(Note, { bad: true }, error),
      h('div.so-row.so-end', h(Btn, { kind: 'main', icon: 'cal', disabled: !mine && !guests.length, onClick: go }, mine ? 'Ask the teacher' : 'Book in Google Calendar'))),
    !list.length && !open && h('p.so-dim', mine ? 'Stuck? Ask for a session.' : 'Requests show up here.'),
    list.map(m => h('div.so-meet', { key: m.id, className: cls('so-meet', m.status) }, h('span.so-when', when(m.start)), h('div.so-grow', h('b', m.title), m.note && h('span.so-dim', m.note)), m.status === 'asked' ? (mine ? h('span.so-tag', 'Asked') : [h(Btn, { key: 1, kind: 'main', icon: 'cal', onClick: () => set(m, 'booked') }, 'Book'), h(IconBtn, { key: 2, icon: 'x', label: 'Decline', onClick: () => set(m, 'gone') })]) : [h('span.so-tag.ok', { key: 1 }, 'Booked'), h(IconBtn, { key: 2, icon: 'cal', label: 'Open in Google Calendar', onClick: () => set(m, 'booked') })])))
}

/* ---- the student's class page ------------------------------------------------------------------------------------------ */

function useClass(ctx) { return useQuery({ queryKey: [ID, 'class'], queryFn: () => ctx.rest('/class'), refetchInterval: 8000 }) }
function WhoAmI({ ctx, me, onDone }) {
  const [name, setName] = useState(me.name)
  const [email, setEmail] = useState(me.email)
  const [teacher, setTeacher] = useState(me.teacher)
  const save = async () => { await ctx.rest('/prefs', { method: 'POST', body: { student_id: me.id || Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-8), student_name: name.trim(), student_email: email.trim(), teacher_email: teacher.trim() } }); onDone() }
  return h('div.so-card.so-in', h('h2', 'Who are you?'), h('div.so-how', h('label', h('span.so-label', 'Your name'), h('input.so-input', { value: name, onChange: e => setName(e.target.value) })), !ctx.web && h('label', h('span.so-label', 'Your email'), h('input.so-input', { value: email, type: 'email', onChange: e => setEmail(e.target.value) })), !ctx.web && h('label', h('span.so-label', 'Teacher’s email'), h('input.so-input', { value: teacher, type: 'email', onChange: e => setTeacher(e.target.value) }))), h('div.so-row.so-end', h(Btn, { kind: 'main', disabled: !name.trim(), onClick: save }, 'Save')))
}
function ClassPage({ ctx }) {
  const { data, refetch } = useClass(ctx)
  const [at, setAt] = useState(null)
  const [edit, setEdit] = useState(false)
  if (!data) return h('div.so-page', h('div.so-skel'))
  const a = data.work.find(x => x.id === at)
  if (a) return h(WorkRoom, { key: a.id, ctx, a, services: data.services, onClose: () => { setAt(null); refetch() } })
  const items = [...data.work.map(x => ({ at: x.due, title: x.title, kind: x.kind })), ...data.meetings.map(m => ({ at: m.start, title: m.title, kind: 'meet' }))]
  return h('div.so-page',
    h('header.so-hero.so-in', h('div.so-grow', h('div.so-eyebrow', data.me.name || 'Student'), h('h1', 'Your ', h('em', 'class'))), data.me.id && h('div.so-row', data.me.teacher && h(Btn, { icon: 'mail', onClick: async () => openLink(ctx, (await ctx.rest('/mail', { method: 'POST', body: { to: [data.me.teacher], subject: 'A question', body: '' } })).link) }, 'Email teacher'), h(IconBtn, { icon: 'sliders', label: 'Your details', onClick: () => setEdit(!edit) }))),
    (!data.me.id || edit) && h(WhoAmI, { ctx, me: data.me, onDone: () => { setEdit(false); refetch() } }),
    h(Weeks, { items }),
    !data.work.length && h('div.so-card.so-empty', h(Icon, { n: 'file', size: 40 }), h('h2', 'Nothing set yet'), h('p.so-dim', 'Work your teacher sets appears here.')),
    h('div.so-shelf.wide', data.work.map((x, i) => { const st = x.mine ? x.mine.status : null; const got = x.mine && st === 'returned' ? Object.values(x.mine.marks).reduce((s, m) => s + m.points, 0) : null; return h('button.so-card.so-task.so-in', { key: x.id, type: 'button', disabled: !data.me.id, className: cls('so-card so-task so-in', x.kind), style: { '--i': i }, onClick: () => setAt(x.id) }, h('div.so-eyebrow', x.kind === 'exam' ? `Mock exam${x.minutes ? ` · ${x.minutes} min` : ''}` : 'Assignment'), h('h2', x.title), h('div.so-row', h('span.so-tag', st === 'returned' ? `${got} / ${x.questions.reduce((s, q) => s + q.points, 0)}` : st === 'handed_in' ? 'Handed in' : st === 'working' ? 'Started' : 'New'), h('span.so-dim', dueIn(x.due)))) })),
    data.me.id && h(Meetings, { ctx, list: data.meetings, mine: true, who: data, onChange: refetch }))
}
function WorkRoom({ ctx, a, services, onClose }) {
  const done = a.mine && a.mine.status !== 'working'
  const [ans, setAns] = useState((a.mine && a.mine.answers) || {})
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [left, setLeft] = useState(null)
  const proc = useRef({ typed: 0, pasted: 0, keys: 0, seconds: 0, away: 0, photos: 0, line: [], ...((a.mine && a.mine.process) || {}) })
  const live = useRef(ans)
  const dirty = useRef(false)
  live.current = ans
  const save = async hand_in => { dirty.current = false; await ctx.rest(`/class/${a.id}`, { method: 'POST', body: { answers: live.current, process: proc.current, hand_in } }) }
  useEffect(() => {
    if (done) return
    const began = a.mine && a.mine.started_at ? new Date(a.mine.started_at).getTime() : Date.now()
    const t = setInterval(() => {
      if (!document.hidden) proc.current.seconds += 3
      const len = Object.values(live.current).reduce((s, x) => s + (x.text || '').length, 0)
      proc.current.line = [...proc.current.line, len].slice(-240)
      if (dirty.current) save(false).catch(() => {})
      if (a.kind === 'exam' && a.minutes) setLeft(Math.max(0, a.minutes * 60 - Math.round((Date.now() - began) / 1000)))
    }, 3000)
    const hide = () => { if (document.hidden) proc.current.away += 1 }
    document.addEventListener('visibilitychange', hide)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', hide); if (dirty.current) save(false).catch(() => {}) }
  }, [])
  const put = (id, text, by = 'typed') => { dirty.current = true; setAns(x => ({ ...x, [id]: { text, by } })) }
  const type = (q, e) => {
    const was = ((ans[q.id] || {}).text || '').length
    const n = e.target.value.length - was
    const t = e.nativeEvent && e.nativeEvent.inputType
    if (t === 'insertFromPaste' || t === 'insertFromDrop') proc.current.pasted += Math.max(0, n)
    else if (n > 0) proc.current.typed += n
    proc.current.keys += 1
    put(q.id, e.target.value)
  }
  const photo = async (q, file) => {
    if (!file) return
    setBusy(q.id); setError(null)
    try { const r = await ctx.rest('/photo', { method: 'POST', upload: { filename: file.name, contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }, timeoutMs: 300000 }); proc.current.photos += 1; put(q.id, r.text, 'photo') } catch (err) { setError(msg(err)) }
    setBusy(null)
  }
  const hand = async () => { setBusy('hand'); try { await save(true); haptic('success'); onClose() } catch (err) { setError(msg(err)); setBusy(null) } }
  const marks = (a.mine && a.mine.marks) || {}
  return h('div.so-page.so-work',
    h('div.so-quiztop', h(IconBtn, { icon: 'back', label: 'Back', onClick: onClose }), h('div.so-grow', h('div.so-eyebrow', a.kind === 'exam' ? 'Mock exam' : 'Assignment'), h('h2', a.title)), left !== null && h('span.so-clock', { className: cls('so-clock', left < 120 && 'low') }, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`), h('span.so-dim', dueIn(a.due))),
    a.instructions && h('p.so-lead', a.instructions),
    a.mine && a.mine.comment && h(Note, h('span', h('b', 'Teacher: '), a.mine.comment)),
    a.questions.map((q, i) => h('section.so-card.so-in', { key: q.id, style: { '--i': i } },
      h('div.so-row', h('span.so-optn', i + 1), h('h2.so-grow.so-qh', q.prompt), h('span.so-dim', marks[q.id] ? `${marks[q.id].points} / ${q.points}` : `${q.points} pt`)),
      q.kind === 'choice'
        ? h('div.so-opts', q.options.map((o, k) => h('button', { key: k, type: 'button', disabled: done, className: cls('so-opt', (ans[q.id] || {}).text === o && 'picked'), onClick: () => put(q.id, o) }, h('span.so-optn', 'ABCD'[k]), h('span', o))))
        : h('div', h('textarea.so-input', { rows: q.kind === 'essay' ? 9 : 3, value: (ans[q.id] || {}).text || '', disabled: done || busy === q.id, spellCheck: true, placeholder: 'Your own words', 'aria-label': `Answer ${i + 1}`, onChange: e => type(q, e) }),
            !done && services.reducto && q.kind === 'essay' && h(Samples, { ctx, busy: !!busy, list: [['handwriting', 'Handwritten page', 'hand']], onError: setError, onUse: (k, r) => { proc.current.photos += 1; put(q.id, r.text, 'photo') } }),
            h('div.so-row', h('span.so-dim.so-grow', (ans[q.id] || {}).by === 'photo' ? 'Read from your handwriting by Reducto. Fix anything it misread.' : `${(((ans[q.id] || {}).text || '').trim().match(/\S+/g) || []).length} words`), !done && services.reducto && h('label.so-btn.so-quiet', { className: 'so-btn so-quiet' }, h(Icon, { n: busy === q.id ? 'spin' : 'cam', size: 16 }), busy === q.id ? 'Reading it' : 'Photo of handwriting', h('input', { type: 'file', hidden: true, accept: 'image/png,image/jpeg,application/pdf', onChange: e => photo(q, e.target.files[0]) })))),
      marks[q.id] && h('p.so-dim', marks[q.id].why))),
    error && h(Note, { bad: true }, error),
    !done && h('div.so-row.so-end', h('span.so-dim.so-grow', 'Saved as you go. Your teacher sees your answers, whether they were typed, pasted or written by hand, and how long it took.'), sure ? [h(Btn, { key: 1, onClick: () => setSure(false) }, 'Keep working'), h(Btn, { key: 2, kind: 'main', icon: 'check', disabled: busy === 'hand', onClick: hand }, 'Yes, hand it in')] : h(Btn, { kind: 'main', onClick: () => setSure(true) }, 'Hand in')))
}

/* ---- the teacher's desk ---------------------------------------------------------------------------------------------------- */

function NewWork({ ctx, onDone }) {
  const [kind, setKind] = useState('assignment')
  const [up, setUp] = useState(null)
  const [text, setText] = useState('')
  const [paste, setPaste] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [over, setOver] = useState(false)
  const [src, setSrc] = useState(undefined)
  const t = new Date()
  t.setDate(t.getDate() + 7)
  t.setHours(17, 0, 0, 0)
  const [due, setDue] = useState(inputDate(t))
  const pick = useRef(null)
  const add = async f => { if (!f) return; setBusy(true); setError(null); setUp(null); setSrc(undefined); try { const u = await ctx.rest('/upload', { method: 'POST', upload: { filename: f.name, contentType: f.type || 'application/octet-stream', bytes: new Uint8Array(await f.arrayBuffer()) }, timeoutMs: 300000 }); setUp(u); ctx.rest(`/uploads/${u.id}/check`, { method: 'POST', timeoutMs: 120000 }).then(setSrc).catch(() => setSrc(null)) } catch (err) { setError(msg(err)) } setBusy(false) }
  const make = async () => { setBusy(true); setError(null); try { await ctx.rest('/teach/make', { method: 'POST', body: { kind, upload_id: up ? up.id : null, text: paste ? text : null, name: up ? up.name : 'Pasted text', due: new Date(due).toISOString(), minutes: kind === 'exam' ? 30 : null } }); kick(); onDone() } catch (err) { setError(msg(err)); setBusy(false) } }
  return h('section.so-card.so-in',
    h('div.so-row', h('h2.so-grow', 'New work'), h('div.so-seg', [['assignment', 'Assignment'], ['exam', 'Mock exam']].map(([k, l]) => h('button', { key: k, type: 'button', 'aria-pressed': kind === k, onClick: () => setKind(k) }, l)))),
    paste ? h('textarea.so-input', { rows: 6, value: text, placeholder: 'Paste the material', 'aria-label': 'Material', onChange: e => setText(e.target.value), style: { marginTop: 14 } })
      : h('div', { className: cls('so-drop', over && 'over'), style: { marginTop: 14 }, onDragOver: e => { e.preventDefault(); setOver(true) }, onDragLeave: () => setOver(false), onDrop: e => { e.preventDefault(); setOver(false); add(e.dataTransfer.files[0]) } },
          h('input', { ref: pick, type: 'file', hidden: true, accept: '.pdf,.docx,.txt,.md', onChange: e => add(e.target.files[0]) }),
          h(Icon, { n: busy ? 'spin' : up ? 'check' : 'file', size: 34 }), up ? h('div', h('b', up.name), h('p.so-dim', `${up.characters.toLocaleString()} characters, read by ${up.read_by}`)) : h('b', busy ? 'Reading it' : 'Drop the document'), !busy && h('div.so-row', h(Btn, { onClick: () => pick.current.click() }, up ? 'Choose another' : 'Choose a file'), !up && h(Btn, { onClick: () => setPaste(true) }, 'Paste instead'))),
    !paste && h(Samples, { ctx, busy, list: [['faraday', 'Faraday, 1861', 'hu'], ['ai-article', 'AI-written article', 'ai']], onError: setError, onUse: (k, r) => { const u = r.upload; setError(null); setUp(u); setSrc(undefined); ctx.rest(`/uploads/${u.id}/check`, { method: 'POST', timeoutMs: 120000 }).then(setSrc).catch(() => setSrc(null)) } }),
    up && h(SourceCheck, { v: src }),
    error && h(Note, { bad: true }, error),
    h('div.so-row.so-end', h('label.so-row', h('span.so-dim', 'Due'), h('input.so-input', { type: 'datetime-local', value: due, style: { width: 210 }, onChange: e => setDue(e.target.value) })), h('span.so-grow'), h(Btn, { kind: 'main', disabled: busy || !(up || (paste && text.trim().length > 200)), onClick: make }, kind === 'exam' ? 'Make the exam' : 'Make the assignment')))
}
/** Who wrote the source, by Pangram. undefined: still looking. */
function SourceCheck({ v }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(false)
  useEffect(() => { setSeen(false); if (!v) return; const t = setTimeout(() => setSeen(true), reduced() ? 0 : 900); return () => clearTimeout(t) }, [v])
  if (v === null) return null
  if (v !== undefined && !seen) return h('div.so-source2.scan', h(Icon, { n: 'spin', size: 18 }), h('div.so-grow', h('b', 'Reading it part by part'), h('div.so-scanbar', h('i'))))
  if (v === undefined) return h('div.so-source2', h(Icon, { n: 'spin', size: 18 }), h('span', 'Pangram is checking who wrote it'))
  const slop = v.ai > 0.5
  return h('div', h('button.so-source2', { type: 'button', className: cls('so-source2', slop ? 'bad' : 'good'), 'aria-expanded': open, onClick: () => setOpen(!open) }, h(Icon, { n: slop ? 'x' : 'check', size: 20 }), h('div.so-grow', h('b', slop ? 'This source reads as AI-written' : v.ai > 0.1 ? 'Mostly written by people' : 'Written by people'), h(Mix, { v })), h('span', `${pct(v.human)}% human`, v.saved && h('span.so-dim', ' · saved'))), open && h(Painted, { v }))
}
const Spark = ({ line, pasted }) => {
  const l = line && line.length > 1 ? line : [0, 0]
  const max = Math.max(1, ...l)
  return h('svg.so-spark', { viewBox: '0 0 200 46', preserveAspectRatio: 'none', 'aria-hidden': true }, h('path', { d: `M0 46 ${l.map((v, i) => `L${(i / (l.length - 1)) * 200} ${44 - (v / max) * 40}`).join(' ')} L200 46Z`, className: pasted ? 'bad' : '' }))
}
function Submission({ ctx, s, a, students, onClose, onChange }) {
  const [marks, setMarks] = useState(s.marks || {})
  const [comment, setComment] = useState(s.comment || '')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (Object.keys(s.marks || {}).length && !Object.keys(marks).length) setMarks(s.marks) }, [s.marks])
  const o = s.checked && s.checked.overall
  const p = s.process
  const total = Math.max(1, (p.typed || 0) + (p.pasted || 0))
  const hand = Object.values(s.answers).filter(x => x.by === 'photo').length
  const mins = Math.max(1, Math.round((p.seconds || 0) / 60))
  const email = (students.find(x => x.id === s.student_id) || {}).email
  const give = async () => { setBusy(true); await ctx.rest(`/teach/submissions/${s.id}/return`, { method: 'POST', body: { marks, comment } }); setBusy(false); onChange() }
  return h('div.so-page',
    h('div.so-quiztop', h(IconBtn, { icon: 'back', label: 'Back', onClick: onClose }), h('div.so-grow', h('div.so-eyebrow', a.title), h('h1.so-mid', s.student_name)), email && h(Btn, { icon: 'mail', onClick: async () => openLink(ctx, (await ctx.rest('/mail', { method: 'POST', body: { to: [email], subject: `About ${a.title}`, body: `Hi ${s.student_name.split(' ')[0]},\n\n` } })).link) }, 'Email'), h(Btn, { icon: 'redo', disabled: s.check_status === 'checking', onClick: async () => { await ctx.rest(`/teach/submissions/${s.id}/check`, { method: 'POST' }); onChange() } }, 'Check again')),
    h('div.so-signals.so-in',
      h('div.so-card', h('div.so-label', 'Reads as'), s.check_status === 'checking' ? h('div.so-row', h(Icon, { n: 'spin' }), 'Checking') : o ? [h('b.so-big2', { key: 1 }, `${pct(o.human)}%`, h('span', ' human')), h(Mix, { key: 2, v: o })] : h('span.so-dim', (s.checked && s.checked.notes && s.checked.notes[0]) || 'Too short to say')),
      h('div.so-card', h('div.so-label', hand ? 'Written by hand' : 'Written'), hand ? h('b.so-big2', hand, h('span', hand === 1 ? ' photo' : ' photos')) : [h('b.so-big2', { key: 1 }, `${Math.round(((p.pasted || 0) / total) * 100)}%`, h('span', ' pasted')), h(Spark, { key: 2, line: p.line, pasted: (p.pasted || 0) / total > 0.5 })]),
      h('div.so-card', h('div.so-label', 'Time on it'), h('b.so-big2', mins, h('span', ' min')), h('span.so-dim', p.away ? `Left the page ${p.away}x` : 'Stayed on the page'))),
    a.questions.map((q, i) => { const x = s.answers[q.id] || {}; const r = s.checked && s.checked.reads && s.checked.reads[q.id]; const m = marks[q.id] || { points: 0, why: '' }; return h('section.so-card', { key: q.id },
      h('div.so-row', h('span.so-optn', i + 1), h('b.so-grow', q.prompt), x.by === 'photo' && h('span.so-tag', 'By hand'), h('input.so-input.so-pts', { type: 'number', min: 0, max: q.points, step: 0.5, value: m.points, 'aria-label': 'Points', onChange: e => setMarks({ ...marks, [q.id]: { ...m, points: Number(e.target.value) } }) }), h('span.so-dim', `/ ${q.points}`)),
      r ? h(Painted, { v: r }) : h('p.so-ans', x.text || 'No answer'),
      m.why && h('p.so-dim', m.why)) }),
    h('section.so-card', h('textarea.so-input', { rows: 3, value: comment, placeholder: 'A note back', 'aria-label': 'Comment', onChange: e => setComment(e.target.value) }), h('div.so-row.so-end', h('span.so-dim.so-grow', 'Signals to talk about, never proof. Marks are suggestions until you return it.'), h(Btn, { kind: 'main', icon: 'check', disabled: busy, onClick: give }, s.status === 'returned' ? 'Return again' : `Return ${Object.values(marks).reduce((t, m) => t + m.points, 0)} / ${a.questions.reduce((t, q) => t + q.points, 0)}`))))
}
function Draft({ ctx, a, onChange }) {
  if (a.status === 'making') return h('section.so-card.so-in', h('div.so-row', h('h3.so-grow', { style: { margin: 0 } }, `Making ${a.kind === 'exam' ? 'the mock exam' : 'the assignment'} from ${a.source_name || 'your text'}`), a.read_by && h('span.so-tag', `Read by ${a.read_by}`)), h(Progress, { p: a.progress || JUSTBEGUN }))
  if (a.status === 'failed') return h(Note, { bad: true }, h('span.so-grow', a.error), h(IconBtn, { icon: 'trash', label: 'Remove', onClick: async () => { await ctx.rest(`/teach/assignments/${a.id}`, { method: 'DELETE' }); onChange() } }))
  return h('section.so-card.so-in', h('div.so-row', h('div.so-grow', h('div.so-eyebrow', a.kind === 'exam' ? 'Mock exam, ready to set' : 'Assignment, ready to set'), h('h2', a.title)), h('span.so-tag', `Read by ${a.read_by}`), h(IconBtn, { icon: 'trash', label: 'Remove', onClick: async () => { await ctx.rest(`/teach/assignments/${a.id}`, { method: 'DELETE' }); onChange() } }), h(Btn, { kind: 'main', icon: 'check', onClick: async () => { await ctx.rest(`/teach/assignments/${a.id}/set`, { method: 'POST', body: {} }); onChange() } }, 'Set it')),
    a.source && h(SourceCheck, { v: a.source }),
    h('ol.so-ul.so-qs', a.questions.map(q => h('li', { key: q.id }, q.prompt, h('span.so-dim', ` ${q.kind}, ${q.points} pt`)))))
}
function Desk({ ctx }) {
  const client = useQueryClient()
  const { data, error, refetch } = useQuery({ queryKey: [ID, 'teach'], queryFn: () => ctx.rest('/teach'), refetchInterval: q => (q.state.data && (q.state.data.assignments.some(a => a.status === 'making') || q.state.data.submissions.some(s => s.check_status === 'checking')) ? 2500 : 7000) })
  const [make, setMake] = useState(false)
  const [at, setAt] = useState(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const look = (ctx.storage && ctx.storage.get('look', 'sticker')) || 'sticker'
  const re = () => { refetch(); client.invalidateQueries({ queryKey: [ID, 'class'] }) }
  const wrap = x => h('div.so-root', { className: cls('so-root', look) }, h('div.so-top', h('span.so-logo', 'Study', h('em', 'os')), h('span.so-tag', 'Teacher'), h('span.so-grow'), h(Btn, { kind: 'main', icon: 'plus', onClick: () => { setAt(null); setMake(true) } }, 'New work')), x, h(Tray, { ctx, teacher: true }))
  if (!data) return wrap(h('div.so-page', error ? h(Note, { bad: true }, msg(error)) : h('div.so-skel')))
  const set = data.assignments.filter(a => a.status === 'set')
  const s = data.submissions.find(x => x.id === at)
  if (s) return wrap(h(Submission, { key: s.id, ctx, s, a: data.assignments.find(a => a.id === s.assignment_id), students: data.students, onClose: () => setAt(null), onChange: re }))
  const items = [...set.map(x => ({ at: x.due, title: x.title, kind: x.kind })), ...data.meetings.map(m => ({ at: m.start, title: m.title, kind: 'meet' }))]
  const people = [...data.students]
  const waiting = data.submissions.filter(x => x.status === 'handed_in').length
  return wrap(h('div.so-page',
    h('header.so-hero.so-in', h('div.so-grow', h('div.so-eyebrow', waiting ? `${waiting} to look at` : 'All caught up'), h('h1', 'Your ', h('em', 'class')))),
    make && h(NewWork, { ctx, onDone: () => { setMake(false); re() } }),
    data.assignments.filter(a => a.status !== 'set').map(a => h(Draft, { key: a.id, ctx, a, onChange: re })),
    h(Weeks, { items }),
    h('section.so-card', h('div.so-row', h('h2.so-grow', 'Students'), h(Btn, { icon: 'plus', onClick: () => setAdding(!adding) }, 'Add')),
      adding && h('form.so-row.so-in', { style: { marginTop: 12 }, onSubmit: async e => { e.preventDefault(); await ctx.rest('/teach/students', { method: 'POST', body: { name, email } }); setName(''); setEmail(''); setAdding(false); re() } }, h('input.so-input', { style: { flex: 1 }, value: name, placeholder: 'Name', onChange: e => setName(e.target.value) }), h('input.so-input', { style: { flex: 1 }, value: email, placeholder: 'Email', onChange: e => setEmail(e.target.value) }), h(Btn, { kind: 'main', type: 'submit', disabled: !name.trim() }, 'Add')),
      !people.length && !adding ? h('p.so-dim', 'Students appear when they hand something in, or add them now.')
        : h('div.so-scroll', h('table.so-grid', h('thead', h('tr', h('th'), set.map(a => h('th', { key: a.id }, h('b', a.title), h('span.so-dim', dueIn(a.due)))))), h('tbody', people.map(p => h('tr', { key: p.id }, h('th', h('span.so-face', p.name[0]), h('span', p.name)), set.map(a => {
            const x = data.submissions.find(y => y.assignment_id === a.id && y.student_id === p.id)
            if (!x || x.status === 'working') return h('td', { key: a.id }, h('span.so-dot2', { className: cls('so-dot2', x ? 'half' : a.due && new Date(a.due) < new Date() ? 'late' : '') , title: x ? 'Working' : 'Not started' }))
            const o = x.checked && x.checked.overall
            const pts = Object.values(x.marks || {}).reduce((t, m) => t + m.points, 0)
            return h('td', { key: a.id }, h('button.so-cell', { type: 'button', onClick: () => setAt(x.id), className: cls('so-cell', x.status === 'returned' && 'back') }, x.check_status === 'checking' ? h(Icon, { n: 'spin', size: 16 }) : o ? h(Mix, { v: o, small: true }) : h('span.so-dim', 'No reading'), h('span', x.status === 'returned' ? `${pts} pt` : o ? `${pct(o.human)}% human` : 'Open')))
          }))))))),
    h(Meetings, { ctx, list: data.meetings, mine: false, who: data, onChange: re })))
}

/* ---- essay check --------------------------------------------------------------------------------------------------------- */

const Reads = ({ v, note }) => v
  ? h('div.so-reads', h('div.so-mix', { role: 'img', 'aria-label': `${pct(v.human)}% human, ${pct(v.assisted)}% assisted, ${pct(v.ai)}% AI` }, h('i.hu', { style: { flex: v.human } }), h('i.as', { style: { flex: v.assisted } }), h('i.ai', { style: { flex: v.ai } })), h('div.so-dim', h('b', `Reads as ${v.label}. `), `${pct(v.human)}% human-written, ${pct(v.assisted)}% assisted, ${pct(v.ai)}% AI, by Pangram`), h(Painted, { v }))
  : h('p.so-dim', note)
function Essay({ ctx, home }) {
  const [text, setText] = useState('')
  const [task, setTask] = useState('')
  const [busy, setBusy] = useState(null)
  const [r, setR] = useState(null)
  const [pair, setPair] = useState(null)
  const [guess, setGuess] = useState(null)
  const [error, setError] = useState(null)
  const go = async what => {
    setBusy(what); setError(null)
    try {
      const out = await ctx.rest(what === 'ab' ? '/essay/ab' : '/essay', { method: 'POST', body: { text, task }, timeoutMs: 300000 })
      if (what === 'ab') { setPair(out); setGuess(null) } else setR(out)
    } catch (err) { setError(msg(err)) }
    setBusy(null)
  }
  const n = text.trim() ? text.trim().split(/\s+/).length : 0
  return h('div.so-page',
    h('header.so-in', h('div.so-eyebrow', 'For essays and projects'), h('h1', 'Essay ', h('em', 'check')), h('p.so-lead', 'Feedback on a draft that never rewrites it, how it reads, and a blind test against what a model would write.')),
    h('div.so-card.so-in',
      h('label', h('span.so-label', 'The task (optional)'), h('input.so-input', { value: task, maxLength: 600, placeholder: 'Explain why bread rises, for a class report', onChange: e => setTask(e.target.value) })),
      h('label.so-block', h('span.so-label', 'The draft'), h('textarea.so-input', { rows: 11, value: text, maxLength: 20000, placeholder: 'Paste at least 50 words', onChange: e => setText(e.target.value) })),
      h(Samples, { ctx, busy: !!busy, list: [['essay-person', 'A person wrote this', 'hu'], ['essay-ai', 'An AI wrote this', 'ai']], onError: setError, onUse: (k, r) => { setText(r.text); setTask('Explain how a candle burns'); setR(null); setPair(null); setError(null) } }),
      h('div.so-row.so-end', h('span.so-dim.so-grow', `${n} words`), h(Btn, { disabled: n < 50 || busy, onClick: () => go('ab') }, busy === 'ab' ? [h(Icon, { key: 1, n: 'spin', size: 16 }), 'Writing the other one'] : 'Blind A/B test'), h(Btn, { kind: 'main', disabled: n < 50 || busy, onClick: () => go('check') }, busy === 'check' ? [h(Icon, { key: 1, n: 'spin', size: 16 }), 'Reading it'] : 'Check it')),
      error && h(Note, { bad: true }, error),
      !home.services.pangram && h(Note, 'Feedback works now. To see whether a text reads as AI-written, add a Pangram key in Settings, Plugins, Study OS Solo.')),
    r && h('section.so-card.so-in', h('h2', r.summary), h(Reads, { v: r.authorship, note: r.note }),
      h('div.so-cols2', h('div', h('div.so-label', 'What works'), h('ul.so-ul', r.strong.map((x, i) => h('li', { key: i }, x)))), h('div', h('div.so-label', 'Think about'), h('ul.so-ul', r.improve.map((x, i) => h('li', { key: i }, h('b', `“${x.where}” `), x.why))))),
      h('div.so-label', 'Only the writer could answer these'), h('ul.so-ul', r.questions.map((x, i) => h('li', { key: i }, x)))),
    pair && h('section.so-card.so-in',
      h('h2', guess === null ? 'One is the draft, one is a model’s. Which is the model’s?' : pair.sides[guess].mine ? 'That one was the draft' : 'Right, that’s the model'),
      h('div.so-cols2', pair.sides.map((s, i) => h('div.so-abside', { key: i, className: cls('so-abside', guess !== null && (s.mine ? 'mine' : 'model')) },
        h('div.so-row', h('span.so-optn', 'AB'[i]), guess !== null && h('b', s.mine ? 'The draft' : 'Written by a model'), h('span.so-grow'), guess === null && h(Btn, { onClick: () => setGuess(i) }, 'This is AI')),
        (guess === null || !s.authorship) && h('p', s.text), guess !== null && h(Reads, { v: s.authorship, note: s.note })))),
      guess !== null && h('p.so-dim', 'A detector can be wrong both ways. Use it to start a conversation, never to decide one.')))
}

/* ---- a course -------------------------------------------------------------------------------------------------------- */

const nice = m => String(m || '').split('/').pop().split('-').map(w => (/^\d/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ').replace(/(\d) (\d)/g, '$1.$2')
/** What is in this lesson, printed like the side of a packet. */
function Label({ d }) {
  const Line = (a, b, strong) => h('div', { key: a, className: cls('so-factrow', strong && 'big') }, h('span', a), h('b', b))
  const s = d.source
  return h('section.so-facts.so-in',
    h('div.so-factsmain',
      h('h2', 'Lesson facts'),
      Line('Written by', /^your /.test(d.model) ? 'Your Hermes model' : nice(d.model)),
      Line('Taught from', d.source_name || 'What the model knows'),
      s && Line('Read by', s.read_by),
      s && s.human !== undefined && Line('Who wrote the source', s.ai > 0.5 ? `${pct(s.ai)}% AI` : `${pct(s.human)}% human`),
      h('i.so-thick'),
      Line('Tied to the source', d.source_name ? `${d.tied} of ${d.lines.length} lines` : 'No source', true),
      Line('The model’s own words', `${d.lines.length - d.tied} lines`),
      d.refused > 0 && Line('Claimed quotes thrown out', d.refused),
      Line('Stock phrases', d.stock.length ? d.stock.join(', ') : `0 of ${d.checked} we look for`),
      h('p.so-factnote', 'Every quote is matched word for word by code. Click any line below.')),
    d.choices.length > 0 && h('div.so-choices', h('h2', 'Choices'), d.choices.map((c, i) => h('div', { key: i }, h('b', c.choice), h('p', c.because), h('s', c.instead_of)))))
}

const LABELWAIT = { seconds: 0, typical: 9, stage: 'Finding the source lines', share: 0 }
function Course({ ctx, id, home, go, want }) {
  const client = useQueryClient()
  const [at, setAt] = useState(0)
  const [quiz, setQuiz] = useState(false)
  const [reword, setReword] = useState(false)
  const [sure, setSure] = useState(false)
  const [label, setLabel] = useState(null)
  const top = useRef(null)
  const { data: c, error, refetch } = useQuery({ queryKey: [ID, 'course', id], queryFn: () => ctx.rest(`/courses/${id}`), refetchInterval: q => (q.state.data && ['planning', 'writing'].includes(q.state.data.status) ? 3000 : false) })
  const [tab, setTab] = useState('learn')
  const s = c && c.list[at]
  useEffect(() => {
    if (!c || !want) return
    const i = c.list.findIndex(x => x.id === want.section_id)
    if (i >= 0) setAt(i)
    setQuiz(false)
    if (want.tab) setTab(want.tab)
  }, [!!c, want && want.n])
  useEffect(() => { if (s && s.body && !s.read) ctx.rest(`/courses/${id}?section=${s.id}`).then(() => client.invalidateQueries({ queryKey: [ID, 'home'] })).catch(() => {}) }, [s && s.id, s && !!s.body])
  const open = i => { setAt(i); setQuiz(false); setReword(false); setLabel(null); top.current && top.current.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }) }
  const changed = () => { refetch(); client.invalidateQueries({ queryKey: [ID, 'home'] }); client.invalidateQueries({ queryKey: [ID, 'progress'] }) }
  if (error && !c) return h('div.so-page', h(Note, { bad: true }, msg(error)), h(Btn, { onClick: () => go('home') }, 'Back to courses'))
  if (!c) return h('div.so-page', h('div.so-skel'))
  const busy = ['planning', 'writing'].includes(c.status)
  return h('div.so-page', { ref: top },
    h('header.so-coursehead.so-in',
      h(Cover, { course: c, big: true }),
      h('div.so-grow',
        h('div.so-eyebrow', [c.subject, c.level_label].filter(Boolean).join(' · ')),
        h('h1', c.title),
        c.summary && h('p.so-lead', c.summary),
        h('div.so-row', h('div.so-barwide', h(Bar, { value: c.mastery })), h('span.so-dim', `${c.mastered} of ${c.goals} goals known`), h('span.so-grow'),
          sure ? [h('span.so-dim', { key: 1 }, 'Delete it and its progress?'), h(Btn, { key: 2, onClick: () => setSure(false) }, 'Keep'), h(Btn, { key: 3, kind: 'danger', onClick: async () => { await ctx.rest(`/courses/${id}`, { method: 'DELETE' }); client.invalidateQueries({ queryKey: [ID] }); go('home') } }, 'Delete')] : h(IconBtn, { icon: 'trash', label: 'Delete this course', onClick: () => setSure(true) })))),
    busy && h('section.so-card.so-courseprog', h('div.so-row', h('h3.so-grow', { style: { margin: 0 } }, c.status === 'planning' ? 'Planning your course' : 'Writing your course'), c.sections > 0 && h('span.so-dim', `${c.written} of ${c.sections} sections`)), h(Progress, { p: c.progress || JUSTBEGUN }), h('p.so-dim', 'Read the first section as soon as it’s here. The rest carries on.')),
    c.error && !busy && h(Note, { bad: true }, h('span.so-grow', c.error), h(Btn, { icon: 'redo', onClick: async () => { await ctx.rest(`/courses/${id}/retry`, { method: 'POST' }); refetch() } }, 'Try again')),
    c.list.length > 0 && h('div.so-two',
      h('nav.so-rail', { 'aria-label': 'Sections' }, c.list.map((x, i) => {
        const known = x.goals.length ? x.goals.reduce((a, g) => a + g.mastery, 0) / x.goals.length : 0
        return h('button', { key: x.id, type: 'button', 'aria-current': i === at ? 'true' : undefined, className: cls(i === at && 'on'), onClick: () => open(i) },
          h('span', { className: cls('so-num', x.goals.length && x.goals.every(g => g.mastered) && 'done') }, x.status === 'writing' ? h(Icon, { n: 'spin', size: 14 }) : x.goals.length && x.goals.every(g => g.mastered) ? h(Icon, { n: 'check', size: 14 }) : i + 1),
          h('span.so-grow', x.title, h(Bar, { value: known })))
      })),
      s && h('div.so-main', { key: s.id },
        s.body && !quiz && h('div.so-tabs', { role: 'tablist' }, [['learn', 'Learn', 'book'], ['watch', 'Watch', 'play'], ['listen', 'Listen', 'sound'], ['play', 'Play', 'bolt'], ['talk', 'Talk', 'mic']].map(([k, t, i]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': tab === k, onClick: () => { setTab(k); setReword(false) } }, h(Icon, { n: i, size: 16 }), t))),
        s.body && !quiz && tab === 'watch' ? h(Watch, { key: `w${s.id}${want ? want.n : ''}`, ctx, section: s, want: want && want.section_id === s.id && want.tab === 'watch' ? want.kind : null }) : s.body && !quiz && tab === 'listen' ? h(Listen, { key: `l${s.id}${want ? want.n : ''}`, ctx, section: s, want: want && want.section_id === s.id && want.tab === 'listen' ? want.kind : null }) : s.body && !quiz && tab === 'play' ? h(Play, { key: `p${s.id}`, ctx, section: s }) : s.body && !quiz && tab === 'talk' ? h(Talk, { key: `t${s.id}`, ctx, section: s, onChange: changed }) : quiz ? h(Quiz, { ctx, scope: { course_id: id, section_id: s.id }, title: s.title, onClose: () => { setQuiz(false); changed() }, onChange: changed })
          : h('div.so-in',
            h('article.so-card.so-lesson',
              h('div.so-eyebrow', `Section ${at + 1} of ${c.list.length}`),
              h('h2.so-title', s.title),
              s.goal && h('p.so-lead', s.goal),
              s.body && h('div.so-row.so-tools', h(Btn, { icon: label === 'wait' ? 'spin' : 'look', 'aria-pressed': !!label, disabled: label === 'wait', className: cls(label && label.lines && 'so-pressed'), onClick: async () => { if (label && label.lines) return setLabel(null); setLabel('wait'); try { const d = await ctx.rest(`/sections/${s.id}/label`, { timeoutMs: 120000 }); setLabel({ ...d, sid: s.id, body: s.body }) } catch (e) { setLabel({ error: msg(e) }) } } }, 'Show the seams'), h(Btn, { icon: 'sliders', 'aria-expanded': reword, onClick: () => setReword(!reword) }, 'Change how it’s explained')),
              reword && h(Rewording, { ctx, section: s, meta: home, onClose: () => setReword(false), onChange: changed }),
              label === 'wait' && h(Progress, { p: LABELWAIT }),
              label && label.error && h(Note, { bad: true }, label.error),
              label && label.lines && label.sid === s.id && label.body === s.body && h(Label, { d: label }),
              s.body ? h(Markdown, { text: s.body, seams: label && label.sid === s.id && label.body === s.body ? label : null }) : s.error ? h(Note, { bad: true }, s.error) : h('div.so-writing', [92, 100, 84, 96, 70].map(w => h('i', { key: w, style: { width: `${w}%` } }))),
              s.body && s.visual && h(Visual, { v: s.visual }),
              s.terms.length > 0 && h('dl.so-terms', s.terms.map(t => h('div', { key: t.term }, h('dt', t.term), h('dd', t.definition)))),
              s.body && h('p.so-source', s.from_material ? `Written from your material${c.source_name ? `: ${c.source_name}` : ''}.` : 'Written by your Hermes model from what it knows. Check anything important.')),
            s.goals.length > 0 && h('section.so-card.so-cta', h('div.so-grow', h('h2', 'Ready to see what stuck?'), h('p.so-dim', `${s.goals.length} goals, with questions that fit what you know.`)), h(Btn, { kind: 'main', onClick: () => setQuiz(true) }, 'Start the quiz')),
            s.body && s.goals.length > 0 && h(ExplainBack, { key: `e${s.id}`, ctx, section: s, checks: home.services.pangram, onChange: changed }),
            h('div.so-row.so-pager', h(Btn, { icon: 'back', disabled: at === 0, onClick: () => open(at - 1) }, 'Previous'), h('span.so-grow'), h(Btn, { disabled: at === c.list.length - 1, onClick: () => open(at + 1) }, 'Next section', h(Icon, { n: 'next', size: 16 })))))))
}

/* ---- make a course --------------------------------------------------------------------------------------------------------- */

const IDEAS = ['How vaccines work', 'Why the sky is blue', 'Reading a budget', 'How computers count', 'What makes music sound sad']
function NewCourse({ ctx, home, go }) {
  const client = useQueryClient()
  const [mode, setMode] = useState('topic')
  const [topic, setTopic] = useState('')
  const [text, setText] = useState('')
  const [up, setUp] = useState(null)
  const [how, setHow] = useState({ level: home.prefs.level, story: home.prefs.story, compare_to: home.prefs.compare_to })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [over, setOver] = useState(false)
  const [src, setSrc] = useState(undefined)
  const pick = useRef(null)
  const add = async file => {
    if (!file) return
    setBusy(true); setError(null); setSrc(undefined)
    try { const u = await ctx.rest('/upload', { method: 'POST', upload: { filename: file.name, contentType: file.type || 'application/octet-stream', bytes: new Uint8Array(await file.arrayBuffer()) }, timeoutMs: 300000 }); setUp(u); if (home.services.pangram) ctx.rest(`/uploads/${u.id}/check`, { method: 'POST', timeoutMs: 120000 }).then(setSrc).catch(() => setSrc(null)); else setSrc(null) } catch (err) { setError(msg(err)) }
    setBusy(false)
  }
  const make = async () => {
    setBusy(true); setError(null)
    try {
      const body = { how, topic: mode === 'topic' ? topic : null, text: mode === 'text' ? text : null, upload_id: mode === 'file' && up ? up.id : null }
      const r = await ctx.rest('/courses', { method: 'POST', body })
      kick()
      ctx.rest('/prefs', { method: 'POST', body: { level: how.level, story: how.story, compare_to: how.compare_to || '' } }).catch(() => {})
      client.invalidateQueries({ queryKey: [ID, 'home'] })
      go('course', r.id)
    } catch (err) { setError(msg(err)); setBusy(false) }
  }
  const ok = mode === 'topic' ? topic.trim().length > 2 : mode === 'text' ? text.trim().length >= 200 : !!up
  return h('div.so-page',
    h('header.so-in', h('div.so-eyebrow', 'Start something new'), h('h1', 'Make a ', h('em', 'course'))),
    h('div.so-seg.so-in', [['topic', 'A topic'], ['file', 'A file'], ['text', 'Paste text']].map(([k, t]) => h('button', { key: k, type: 'button', 'aria-pressed': mode === k, onClick: () => { setMode(k); setError(null) } }, t))),
    h('div.so-card.so-in', { key: mode },
      mode === 'topic' && h('div', h('input.so-input.so-big', { value: topic, autoFocus: true, maxLength: 200, placeholder: 'What do you want to learn?', 'aria-label': 'What do you want to learn?', onChange: e => setTopic(e.target.value), onKeyDown: e => e.key === 'Enter' && ok && !busy && make() }), h('div.so-chips', IDEAS.map(i => h('button', { key: i, type: 'button', onClick: () => setTopic(i) }, i)))),
      mode === 'text' && h('textarea.so-input', { rows: 9, value: text, maxLength: 200000, placeholder: 'Paste notes, an article or a chapter', 'aria-label': 'Your material', onChange: e => setText(e.target.value) }),
      mode === 'file' && h('div', { className: cls('so-drop', over && 'over'), onDragOver: e => { e.preventDefault(); setOver(true) }, onDragLeave: () => setOver(false), onDrop: e => { e.preventDefault(); setOver(false); add(e.dataTransfer.files[0]) } },
        h('input', { ref: pick, type: 'file', hidden: true, accept: '.pdf,.docx,.txt,.md', onChange: e => add(e.target.files[0]) }),
        h(Icon, { n: busy ? 'spin' : up ? 'check' : 'file', size: 34 }),
        up ? h('div', h('b', up.name), h('p.so-dim', `${up.characters.toLocaleString()} characters, read by ${up.read_by}`)) : h('div', h('b', busy ? 'Reading it' : 'Drop a file here'), h('p.so-dim', home.services.reducto ? 'PDF, scan, Word or text. Reducto reads PDFs.' : 'PDF, Word or text. Read on this computer.')),
        h(Btn, { disabled: busy, onClick: () => pick.current.click() }, up ? 'Choose another' : 'Choose a file')),
      mode === 'file' && h(Samples, { ctx, busy, list: [['ai-article', 'AI-written article', 'ai'], ['faraday', 'Faraday, 1861', 'hu']], onError: setError, onUse: (k, r) => { const u = r.upload; setError(null); setUp(u); setSrc(undefined); if (home.services.pangram) ctx.rest(`/uploads/${u.id}/check`, { method: 'POST', timeoutMs: 120000 }).then(setSrc).catch(() => setSrc(null)); else setSrc(null) } }),
      mode === 'file' && up && h(SourceCheck, { v: src }),
      h(How, { how, set: setHow, meta: home }),
      error && h(Note, { bad: true }, error),
      h('div.so-row.so-end', h('span.so-dim.so-grow', 'It stays on this computer. Your Hermes model writes it.'), h(Btn, { kind: 'main', disabled: !ok || busy, onClick: make }, busy && mode !== 'file' ? 'Starting' : 'Make the course'))))
}

/* ---- what you know --------------------------------------------------------------------------------------------------------------- */

function Known({ ctx, go }) {
  const { data, error } = useQuery({ queryKey: [ID, 'progress'], queryFn: () => ctx.rest('/progress') })
  const [find, setFind] = useState('')
  const [state, setState] = useState('all')
  const t = find.trim().toLowerCase()
  const list = useMemo(() => ((data && data.courses) || []).map(c => ({ ...c, goals: c.goals.filter(g => (state === 'all' || (state === 'due' ? g.due : g.state === state)) && (!t || `${g.label} ${c.title}`.toLowerCase().includes(t))) })).filter(c => c.goals.length), [data, t, state])
  const all = ((data && data.courses) || []).flatMap(c => c.goals)
  const count = k => (k === 'all' ? all.length : k === 'due' ? all.filter(g => g.due).length : all.filter(g => g.state === k).length)
  return h('div.so-page',
    h('header.so-in', h('div.so-eyebrow', 'Everything, in one place'), h('h1', 'What you ', h('em', 'know'))),
    error && h(Note, { bad: true }, msg(error)),
    h('div.so-row.so-filters', h('input.so-input.so-grow', { value: find, placeholder: 'Search your goals', 'aria-label': 'Search your goals', onChange: e => setFind(e.target.value) })),
    h('div.so-chips', [['all', 'All'], ['mastered', 'Known'], ['learning', 'Learning'], ['new', 'Not started'], ['due', 'Due']].map(([k, l]) => h('button', { key: k, type: 'button', 'aria-pressed': state === k, onClick: () => setState(k) }, `${l} ${count(k)}`))),
    data && !list.length && h('p.so-dim', all.length ? 'Nothing matches.' : 'Make a course and its goals appear here.'),
    list.map((c, i) => h('section.so-card.so-in', { key: c.id, style: { '--i': i } },
      h('button.so-link', { type: 'button', onClick: () => go('course', c.id) }, c.title),
      h('div.so-goals', c.goals.map(g => h('span', { key: g.id, className: cls('so-goal', g.state, g.due && 'due'), title: `${g.section}: ${pct(g.mastery)}%` }, h('i', { style: { '--m': pct(g.mastery) } }), g.label))))))
}

/* ---- home --------------------------------------------------------------------------------------------------------------------------- */

function Home({ home, go }) {
  const cs = home.courses
  const last = cs.find(c => c.opened_at && c.status === 'ready') || cs[0]
  const hi = new Date().getHours()
  return h('div.so-page',
    h('header.so-hero.so-in',
      h('div.so-grow', h('div.so-eyebrow', hi < 12 ? 'Good morning' : hi < 18 ? 'Good afternoon' : 'Good evening'), h('h1', cs.length ? ['Pick up ', h('em', { key: 1 }, 'where you left off')] : ['What do you want to ', h('em', { key: 1 }, 'learn?')])),
      h('div.so-streak', { 'aria-label': `${home.streak.days} day streak` }, h('div.so-row', h('span.so-flame', h(Icon, { n: 'flame', size: 26 })), h('b', home.streak.days), h('span.so-dim', home.streak.days === 1 ? 'day' : 'days')), h('div.so-week', home.streak.week.map((d, i) => h('span', { key: i, className: cls(d.done && 'on'), title: d.day }, d.day[0]))))),
    !cs.length && h('div.so-card.so-empty.so-in', h(Icon, { n: 'book', size: 44 }), h('h2', 'Make your first course'), h('p.so-dim', 'Give it a topic, a PDF or your notes. It writes short lessons, quizzes you, and brings things back before you forget them. All on this computer, with no account.'), h('div.so-row', h(Btn, { kind: 'main', icon: 'plus', onClick: () => go('new') }, 'Make a course'), h(Btn, { icon: 'sliders', onClick: () => go('setup') }, 'Set up'))),
    cs.length > 0 && h('div.so-grid2.so-in',
      h('button.so-card.so-resume', { type: 'button', onClick: () => go('course', last.id) }, h(Cover, { course: last }), h('div.so-grow', h('div.so-eyebrow', last.status === 'ready' ? 'Keep going' : last.status === 'failed' ? 'Needs another try' : 'Being written'), h('h2', last.title), h('p.so-dim', last.status === 'ready' ? `${last.read} of ${last.sections} sections read` : last.status === 'failed' ? last.error : `${last.written} of ${last.sections || '…'} sections ready`), h(Bar, { value: last.mastery })), h(Ring, { value: last.mastery, size: 72 }, h('b', `${pct(last.mastery)}%`))),
      h('button', { type: 'button', className: cls('so-card so-due', home.due && 'hot'), disabled: !home.due, onClick: () => go('review') }, h(Icon, { n: 'redo', size: 26 }), h('div', h('b.so-count', home.due), h('div', home.due === 1 ? 'goal to review' : 'goals to review')), h('span.so-dim', home.due ? 'A few minutes keeps it fresh' : 'Nothing due right now'))),
    cs.length > 0 && h('div.so-row.so-sec', h('h2.so-grow', 'Your courses'), h(Btn, { kind: 'main', icon: 'plus', onClick: () => go('new') }, 'New course')),
    h('div.so-shelf', cs.map((c, i) => h('button.so-book.so-in', { key: c.id, type: 'button', style: { '--i': i }, onClick: () => go('course', c.id) }, h(Cover, { course: c }), h('div', h('b', c.title), h('span.so-dim', c.status === 'ready' ? `${c.mastered} of ${c.goals} known` : c.status === 'failed' ? 'Needs another try' : `Writing ${c.written}/${c.sections || '…'}`), c.due > 0 && h('span.so-tag', `${c.due} due`))))))
}

/* ---- set up: your own keys, or only this computer ------------------------------------------------------------------------ */

function Setup({ ctx, home, go }) {
  const s = home.services
  const open = () => host.navigate(`/settings?tab=plugins&agent=${ID}`)
  const rows = [
    ['reducto', 'Reducto', 'Reads PDFs, scans and handwriting', 'PDFs with text are read here', 'file'],
    ['pangram', 'Pangram', 'Says who wrote it, part by part', 'The check stays off', 'check'],
    ['modal', 'Modal', 'A natural voice that hears you', 'Your computer’s own voice', 'mic']
  ]
  return h('div.so-page',
    h('header.so-in', h('div.so-eyebrow', 'Takes a minute'), h('h1', 'Set ', h('em', 'up')), h('p.so-lead', 'Use only this computer, or add your own keys. You can change it any time.')),
    h('div.so-setup', h('div.so-card.so-in.here', h(Icon, { n: 'check', size: 34 }), h('h2', 'Just this computer'), h('p', 'Works now. Nothing to add. Lessons come from the model you use in Hermes.'), h(Btn, { kind: 'main', onClick: () => go('new') }, 'Start')),
      h('div.so-card.so-in', { style: { '--i': 1 } }, h('div.so-row', h('h2.so-grow', 'Add your keys'), h(Btn, { icon: 'sliders', onClick: open }, 'Open settings')), rows.map(([k, n, on, off, i]) => h('div.so-svc', { key: k, className: cls('so-svc', s[k] && 'on') }, h('span.so-dotbig', h(Icon, { n: s[k] ? 'check' : i, size: 18 })), h('div.so-grow', h('b', n), h('span.so-dim', s[k] ? on : `${on}. Without it: ${off.charAt(0).toLowerCase()}${off.slice(1)}.`)), h('span.so-tag', { className: cls('so-tag', s[k] && 'ok') }, s[k] ? 'On' : 'Optional'))))),
    h('div.so-card.so-in', { style: { '--i': 2 } }, h('div.so-row', h('div.so-grow', h('h2', 'Or let Hermes do it'), h('p.so-dim', 'It walks you through keys, Google and your class folder. You paste keys into Hermes’ settings, never into the chat.')), h(Btn, { icon: 'chat', onClick: async () => { host.newChat && host.newChat(); setTimeout(() => host.composer && host.composer.setDraft('new', 'Set up Study OS for me. Use the study-os-solo:setup skill.'), 700) } }, 'Ask Hermes'))))
}

/** What is being made anywhere, in a corner, until it is ready. */
function Tray({ ctx, go, teacher }) {
  const client = useQueryClient()
  const roomy = () => window.innerWidth > 640 // on a phone it stays a small tab until it's pressed
  const [open, setOpen] = useState(roomy)
  const [gone, setGone] = useState([])
  const seen = useRef('')
  const { data, refetch } = useQuery({ queryKey: [ID, 'making', teacher ? 't' : 's'], queryFn: () => ctx.rest('/making'), refetchInterval: q => (q.state.data && q.state.data.making.length ? 2000 : q.state.data && q.state.data.done.length ? 6000 : 15000), retry: 1 })
  useEffect(() => { const f = () => { setOpen(roomy()); refetch(); setTimeout(refetch, 1200) }; kicks.add(f); return () => kicks.delete(f) }, [])
  const making = (data && data.making) || []
  const done = ((data && data.done) || []).filter(x => !gone.includes(x.key + x.at))
  useEffect(() => {
    const now = done.map(x => x.key + x.at).join()
    if (now === seen.current) return
    seen.current = now
    for (const k of ['media', 'film', 'home', 'course', 'teach', 'wordings']) client.invalidateQueries({ queryKey: [ID, k] })
  }, [done.map(x => x.key + x.at).join()])
  if (!making.length && !done.length) return null
  const hide = x => setGone(g => [...g, x.key + x.at])
  const visit = x => {
    if (!making.includes(x)) hide(x)
    if (x.work) return teacher ? window.scrollTo({ top: 0 }) : ctx.openTeacher ? ctx.openTeacher() : host.navigate(`${ROUTE}-teacher`)
    const want = { section_id: x.section_id, tab: x.tab, kind: x.kind }
    if (go) return go('course', x.course_id, want)
    if (ctx.storage) ctx.storage.set('view', { name: 'course', id: x.course_id, want: { ...want, n: Date.now() } })
    ctx.openStudy ? ctx.openStudy() : host.navigate(ROUTE)
  }
  const all = [...making, ...done]
  return h('aside.so-tray', { 'aria-label': 'Being made' },
    h('button.so-trayhead', { type: 'button', 'aria-expanded': open, onClick: () => setOpen(!open) }, making.length ? h(Icon, { n: 'spin', size: 16 }) : h(Icon, { n: 'check', size: 16 }), h('b', making.length ? `Making ${making.length}` : done.some(x => !x.failed) ? 'Ready' : 'Stopped'), h('span.so-grow'), h('span', open ? 'Hide' : 'Show')),
    open && h('div.so-traylist', all.slice(0, 6).map(x => h('div', { key: x.key + x.at, className: cls('so-trayrow', !making.includes(x) && (x.failed ? 'bad' : 'ok')) },
      h('button', { type: 'button', onClick: () => visit(x) }, h('b', x.name), h('span', x.title)),
      making.includes(x) ? h(Progress, { p: x, slim: true }) : h('div.so-row.so-traydone', h('b', x.failed ? 'Didn’t work' : 'Ready'), h('span.so-grow'), h('button', { type: 'button', onClick: () => visit(x) }, x.failed ? 'Look' : 'Open'), h('button', { type: 'button', 'aria-label': 'Dismiss', onClick: () => hide(x) }, h(Icon, { n: 'x', size: 14 })))))))
}

function Page({ ctx }) {
  const saved = ctx.storage ? ctx.storage.get('view', { name: 'home' }) : { name: 'home' }
  const [view, setView] = useState(saved || { name: 'home' })
  const [look, setLook] = useState((ctx.storage && ctx.storage.get('look', 'sticker')) || 'sticker')
  const client = useQueryClient()
  const { data: home, error, refetch } = useQuery({ queryKey: [ID, 'home'], queryFn: () => ctx.rest('/home'), refetchInterval: q => (q.state.data && q.state.data.courses.some(c => ['planning', 'writing'].includes(c.status)) ? 4000 : 60000), retry: 1 })
  const go = useCallback((name, id, want) => {
    const v = { name, id, want: want ? { ...want, n: Date.now() } : undefined }
    setView(v)
    if (ctx.storage) ctx.storage.set('view', name === 'review' ? { name: 'home' } : v)
    haptic('tap')
  }, [ctx])
  useEffect(() => {
    const on = ctx.onEvent || host.onEvent
    const off = on ? on(`plugin.${ID}.course.changed`, () => client.invalidateQueries({ queryKey: [ID] })) : null
    return () => { if (typeof off === 'function') off() }
  }, [client, ctx])
  const missing = home && view.name === 'course' && !home.courses.some(c => c.id === view.id)
  const name = missing ? 'home' : view.name
  let body
  if (error && !home) body = h('div.so-page', h('div.so-card.so-empty', h('h2', 'Study OS isn’t running yet'), h('p.so-dim', 'Turn on its agent half: run “hermes plugins enable study-os-solo”, then restart the gateway.'), h('p.so-dim', msg(error)), h(Btn, { kind: 'main', onClick: () => refetch() }, 'Try again')))
  else if (!home) body = h('div.so-page', h('div.so-skel'), h('div.so-skel'))
  else if (name === 'new') body = h(NewCourse, { ctx, home, go })
  else if (name === 'show') body = h(Showcase, { ctx, home, go })
  else if (name === 'setup') body = h(Setup, { ctx, home, go })
  else if (name === 'class') body = h(ClassPage, { ctx })
  else if (name === 'essay') body = h(Essay, { ctx, home })
  else if (name === 'known') body = h(Known, { ctx, go })
  else if (name === 'review') body = h('div.so-page', h(Quiz, { ctx, scope: { due_only: true }, title: 'Review', onClose: () => { refetch(); go('home') }, onChange: () => client.invalidateQueries({ queryKey: [ID, 'progress'] }) }))
  else if (name === 'course') body = h(Course, { key: view.id, ctx, id: view.id, home, go, want: view.want })
  else body = h(Home, { home, go })
  return h('div.so-root', { className: cls('so-root', look) },
    h('div.so-top', h('button.so-logo', { type: 'button', onClick: () => go('home') }, 'Study', h('em', 'os')),
      h('nav', { 'aria-label': 'Study OS' }, [['home', 'Courses'], ['show', 'Showcase'], ['known', 'What you know'], ['essay', 'Essay check'], ['class', 'Class']].map(([k, t]) => h('button', { key: k, type: 'button', 'aria-current': name === k ? 'page' : undefined, onClick: () => go(k) }, t)), home && home.due > 0 && h('button', { type: 'button', 'aria-current': name === 'review' ? 'page' : undefined, onClick: () => go('review') }, 'Review', h('span.so-badge', home.due))),
      h('span.so-grow'), !ctx.web && h(IconBtn, { icon: 'sliders', label: 'Set up', onClick: () => go('setup') }), h(IconBtn, { icon: 'look', label: 'Change the look', onClick: () => { const n = { sticker: 'studio', studio: 'hermes', hermes: 'sticker' }[look] || 'sticker'; setLook(n); if (ctx.storage) ctx.storage.set('look', n) } }), h(Btn, { kind: 'main', icon: 'plus', onClick: () => go('new') }, 'New')),
    h('div.so-body', { key: `${name}:${view.id || ''}` }, body), h(Tray, { ctx, go }))
}

/* ---- style: Hermes' own theme colours, so it follows every theme ---------------------------------------------------------------- */

const CSS = `
.so-root{--so-a:var(--ui-accent,#6a8cff);--so-ink:var(--ui-text-primary,currentColor);--so-2:var(--ui-text-secondary,currentColor);--so-3:var(--ui-text-tertiary,color-mix(in srgb,currentColor 60%,transparent));--so-line:var(--ui-stroke-secondary,color-mix(in srgb,currentColor 16%,transparent));--so-card:var(--ui-bg-elevated,color-mix(in srgb,currentColor 4%,transparent));--so-good:var(--ui-green,#3fae6b);--so-bad:var(--ui-red,#d9534f);--so-ease:cubic-bezier(.2,.7,.2,1);--so-on:color-mix(in oklab,var(--so-a),white 88%);container-type:inline-size;height:100%;overflow:auto;color:var(--so-ink);font-size:14px;line-height:1.5}
.so-root *{box-sizing:border-box}
:where(.so-root) button{font:inherit;color:inherit;cursor:pointer;background:none;border:0;text-align:left}
:where(.so-root) button:disabled{cursor:default}
.so-root :focus-visible{outline:2px solid var(--so-a);outline-offset:2px}
.so-root h1,.so-root h2,.so-root h3,.so-root p,.so-root ul,.so-root ol,.so-root dl,.so-root dd,.so-root figure{margin:0}
.so-root em{font-style:italic;font-family:Georgia,'Iowan Old Style',serif;font-weight:400;color:var(--so-a)}
.so-grow{flex:1;min-width:0}.so-dim{color:var(--so-3);font-size:13px}.so-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.so-end{justify-content:flex-end;margin-top:16px}
.so-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;padding:10px 24px;background:var(--ui-bg-editor,var(--ui-chat-surface-background,Canvas));border-bottom:1px solid var(--so-line)}
.so-top nav{display:flex;gap:2px}.so-top nav button{padding:7px 12px;border-radius:99px;color:var(--so-2);font-size:13px;transition:background .2s,color .2s}.so-top nav button:hover{background:color-mix(in srgb,var(--so-ink) 7%,transparent)}.so-top nav button[aria-current]{background:color-mix(in srgb,var(--so-a) 16%,transparent);color:var(--so-ink)}
.so-logo{font-weight:700;font-size:16px;letter-spacing:-.02em}.so-logo em{margin-left:3px}
.so-badge{margin-left:7px;padding:1px 7px;border-radius:99px;background:var(--so-a);color:var(--so-on);font-size:11px;font-weight:700}
.so-page{max-width:1080px;margin:0 auto;padding:34px 24px 80px;display:flex;flex-direction:column;gap:20px}
.so-root h1{font-size:clamp(32px,6cqw,58px);line-height:1.02;letter-spacing:-.035em;font-weight:700;text-wrap:balance}
.so-root h2{font-size:19px;line-height:1.25;letter-spacing:-.015em;font-weight:650}
.so-eyebrow{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--so-a);font-weight:600;margin-bottom:8px}
.so-label{display:block;font-size:12px;color:var(--so-3);margin-bottom:6px;font-weight:550}
.so-lead{font-size:16px;color:var(--so-2);max-width:62ch;margin-top:10px!important}
.so-card>p.so-dim{margin:5px 0 14px}.so-card{border:1px solid var(--so-line);border-radius:22px;background:var(--so-card);padding:24px;display:block;width:100%}
.so-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 14px!important;border-radius:12px;font-size:13px!important;border:1px solid var(--so-line)!important;transition:transform .18s var(--so-ease),background .2s,border-color .2s;white-space:nowrap}
.so-btn:hover:not(:disabled){border-color:color-mix(in srgb,var(--so-a) 55%,transparent)!important}.so-btn:active:not(:disabled){transform:scale(.97)}.so-btn:disabled{opacity:.45}
.so-btn.so-primary{background:var(--so-a)!important;color:var(--so-on)!important;border-color:transparent!important;font-weight:600}.so-btn.so-primary:hover:not(:disabled){background:color-mix(in oklab,var(--so-a),white 10%)!important}
.so-btn.so-danger{color:var(--so-bad)!important}
.so-iconbtn{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;color:var(--so-3)!important}.so-iconbtn:hover{background:color-mix(in srgb,var(--so-ink) 7%,transparent)!important;color:var(--so-ink)!important}
.so-input{width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--so-line);background:var(--ui-bg-input,transparent);color:var(--so-ink);font:inherit;transition:border-color .2s,box-shadow .2s}.so-input:focus{outline:none;border-color:var(--so-a);box-shadow:0 0 0 4px color-mix(in srgb,var(--so-a) 18%,transparent)}textarea.so-input{resize:vertical;line-height:1.6}.so-big{font-size:22px;padding:16px 18px;letter-spacing:-.01em}
.so-seg{display:inline-flex;align-self:flex-start;gap:3px;padding:4px;border:1px solid var(--so-line);border-radius:14px}.so-seg button{padding:7px 14px;border-radius:10px;font-size:13px;color:var(--so-2)}.so-seg button[aria-pressed=true]{background:var(--so-ink);color:var(--ui-bg-editor,Canvas)}
.so-chips{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.so-chips button{padding:6px 13px;border-radius:99px;border:1px solid var(--so-line);font-size:13px;color:var(--so-2);transition:border-color .2s,background .2s}.so-chips button:hover{border-color:var(--so-a)}.so-chips button[aria-pressed=true]{background:color-mix(in srgb,var(--so-a) 18%,transparent);border-color:color-mix(in srgb,var(--so-a) 55%,transparent);color:var(--so-ink)}
.so-tag{padding:2px 9px;border-radius:99px;background:color-mix(in srgb,var(--so-a) 16%,transparent);font-size:11.5px;font-weight:600}
.so-bar{height:5px;border-radius:9px;background:color-mix(in srgb,var(--so-ink) 10%,transparent);overflow:hidden}.so-bar i{display:block;height:100%;border-radius:9px;background:var(--so-a);transition:width .7s var(--so-ease)}.so-barwide{width:180px}
.so-ring{position:relative;display:grid;place-items:center;flex:none}.so-ring svg{position:absolute;inset:0}.so-ring circle{fill:none;stroke-width:6;stroke-linecap:round}.so-ring-bg{stroke:color-mix(in srgb,var(--so-ink) 10%,transparent)}.so-ring-fg{stroke:var(--so-a);transition:stroke-dashoffset .9s var(--so-ease)}.so-ring-in{position:relative;font-size:15px}
.so-note{display:flex;gap:10px;align-items:center;padding:12px 16px;border-radius:14px;margin-top:12px;background:color-mix(in srgb,var(--so-a) 11%,transparent);font-size:13.5px}.so-note-bad{background:color-mix(in srgb,var(--so-bad) 13%,transparent)}
.so-skel{height:170px;border-radius:22px;background:color-mix(in srgb,var(--so-ink) 6%,transparent);animation:so-pulse 1.5s ease-in-out infinite}
.so-cover{display:block;width:74px;aspect-ratio:4/5;border-radius:12px;flex:none;box-shadow:0 8px 22px -10px rgb(0 0 0/.5)}.so-cover-big{width:128px;border-radius:18px;transform:rotate(-2.5deg)}
.so-cover .c1{fill:oklch(from var(--so-a) .46 .12 calc(h + var(--hh)))}.so-cover .c2{fill:oklch(from var(--so-a) .76 .15 calc(h + var(--hh) + 30))}.so-cover .c3{fill:oklch(from var(--so-a) .9 .08 calc(h + var(--hh) - 60))}.so-cover .l2{stroke:oklch(from var(--so-a) .8 .13 calc(h + var(--hh) + 30))}
.h0{--hh:0}.h1{--hh:48}.h2{--hh:310}.h3{--hh:200}.h4{--hh:275}
.so-hero{display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap}.so-streak{border:1px solid var(--so-line);border-radius:20px;padding:14px 18px;background:var(--so-card)}.so-streak b{font-size:24px;letter-spacing:-.03em}.so-flame{color:var(--ui-orange,#f08a3c);display:grid}
.so-week{display:flex;gap:5px;margin-top:8px}.so-week span{width:22px;height:22px;border-radius:8px;display:grid;place-items:center;font-size:10.5px;color:var(--so-3);background:color-mix(in srgb,var(--so-ink) 7%,transparent)}.so-week .on{background:color-mix(in srgb,var(--ui-orange,#f08a3c) 80%,transparent);color:#fff;font-weight:700}
.so-grid2{display:grid;grid-template-columns:2fr 1fr;gap:16px}.so-resume{display:flex!important;gap:20px;align-items:center;transition:border-color .25s,transform .25s var(--so-ease)}.so-resume:hover,.so-book:hover{transform:translateY(-3px)}.so-resume:hover{border-color:color-mix(in srgb,var(--so-a) 60%,transparent)}.so-resume h2{font-size:23px}.so-resume .so-bar{margin-top:12px}
.so-due{display:flex!important;flex-direction:column;gap:10px;justify-content:space-between}.so-due.hot{background:color-mix(in oklab,var(--so-a),transparent 78%);border-color:color-mix(in srgb,var(--so-a) 45%,transparent)}.so-count{font-size:40px;line-height:1;letter-spacing:-.04em}
.so-sec{margin-top:18px}.so-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}.so-book{display:flex!important;gap:14px;align-items:center;padding:12px!important;border:1px solid var(--so-line)!important;border-radius:18px;transition:transform .25s var(--so-ease),border-color .25s}.so-book:hover{border-color:color-mix(in srgb,var(--so-a) 55%,transparent)!important}.so-book .so-cover{width:56px}.so-book b,.so-book .so-dim{display:block}.so-book b{line-height:1.25;margin-bottom:3px}.so-book .so-tag{display:inline-block;margin-top:6px}
.so-empty{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:44px}.so-empty svg{color:var(--so-a)}.so-empty p{max-width:56ch}
.so-coursehead{display:flex;gap:26px;align-items:center}.so-coursehead .so-row{margin-top:16px}
.so-building{display:flex;gap:12px;align-items:center;padding:13px 18px;border-radius:16px;background:color-mix(in srgb,var(--so-a) 11%,transparent)}.so-building .so-barwide{margin-left:auto}
.so-two{display:grid;grid-template-columns:230px minmax(0,1fr);gap:22px;align-items:start}.so-rail{position:sticky;top:70px;display:flex;flex-direction:column;gap:3px}.so-rail button{display:flex;gap:11px;padding:11px 12px;border-radius:14px;color:var(--so-2);font-size:13px;line-height:1.35;transition:background .2s}.so-rail button:hover{background:color-mix(in srgb,var(--so-ink) 5%,transparent)}.so-rail .on{background:color-mix(in srgb,var(--so-a) 13%,transparent);color:var(--so-ink);font-weight:600}.so-rail .so-bar{height:3px;margin-top:8px}
.so-num{display:grid;place-items:center;width:23px;height:23px;flex:none;border-radius:99px;border:1px solid var(--so-line);font-size:11px;font-weight:600}.so-num.done{background:var(--so-good);border-color:transparent;color:#fff}
.so-main>.so-in{display:flex;flex-direction:column;gap:16px}.so-lesson{padding:38px clamp(22px,5cqw,52px);display:block!important}.so-title{font-size:clamp(26px,4cqw,38px)!important;line-height:1.08!important;letter-spacing:-.03em!important}.so-tools{margin:18px 0 6px}
.so-prose{font-size:16px;line-height:1.75;color:var(--so-ink);max-width:68ch}.so-prose>*{margin:0 0 16px!important}.so-prose h3{font-size:20px;line-height:1.3;letter-spacing:-.015em;font-weight:650;margin:32px 0 12px!important}.so-prose em{color:inherit;font-family:inherit;font-weight:inherit}.so-prose strong{font-weight:680}.so-prose ul,.so-prose ol{padding-left:22px}.so-prose li{margin-bottom:6px}.so-prose ul{list-style:disc}.so-prose ol{list-style:decimal}.so-prose li::marker{color:var(--so-a)}
.so-prose code{font-family:ui-monospace,Menlo,monospace;font-size:.88em;padding:1px 6px;border-radius:6px;background:color-mix(in srgb,var(--so-ink) 8%,transparent)}.so-prose pre{padding:16px;border-radius:14px;overflow:auto;background:color-mix(in srgb,var(--so-ink) 6%,transparent)}.so-prose pre code{background:none;padding:0}.so-prose blockquote{padding-left:18px;border-left:3px solid var(--so-a);color:var(--so-2)}.so-prose hr{border:0;border-top:1px solid var(--so-line)}.so-scroll{overflow-x:auto}.so-prose table{border-collapse:collapse;width:100%;font-size:14.5px}.so-prose th,.so-prose td{text-align:left;padding:9px 14px 9px 0;border-bottom:1px solid var(--so-line);vertical-align:top}
.so-compare{border:1px solid var(--so-line);border-radius:16px;padding:12px 18px}.so-compare summary{display:flex;justify-content:space-between;cursor:pointer;font-size:13px;color:var(--so-3);list-style:none}.so-compare summary::-webkit-details-marker{display:none}.so-hide{text-decoration:underline;text-underline-offset:4px}.so-compare p{margin:8px 0 2px!important}
.so-visual{margin:30px 0 0!important;padding:22px;border-radius:20px;border:1px solid var(--so-line);background:color-mix(in srgb,var(--so-a) 6%,transparent)}.so-visual figcaption{font-weight:650;margin-bottom:16px}.so-vflow,.so-vcycle,.so-vparts{display:flex;flex-direction:column}.so-vstep{position:relative;display:flex;gap:14px;padding-bottom:18px;animation:so-up .5s var(--so-ease) both;animation-delay:calc(var(--i)*70ms)}.so-vstep:last-of-type{padding-bottom:0}.so-vstep:not(:last-of-type)::before{content:'';position:absolute;left:14px;top:30px;bottom:0;width:2px;background:color-mix(in srgb,var(--so-a) 35%,transparent)}.so-vparts .so-vstep::before{display:none}.so-vdot{display:grid;place-items:center;width:30px;height:30px;flex:none;border-radius:99px;background:var(--so-a);color:var(--so-on);font-size:13px;font-weight:700}.so-vparts .so-vdot{width:12px;height:12px;margin:6px}.so-vstep span:not(.so-vdot){display:block;color:var(--so-2);font-size:13.5px}.so-vloop{display:flex;gap:8px;align-items:center;margin-top:14px;color:var(--so-a);font-size:13px}.so-vcompare{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.so-vcard{padding:16px;border-radius:16px;background:var(--so-card);border:1px solid var(--so-line);animation:so-up .5s var(--so-ease) both;animation-delay:calc(var(--i)*70ms)}.so-vcard ul{padding-left:18px;margin-top:8px;list-style:disc;color:var(--so-2);font-size:13.5px}
.so-terms{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:30px!important;padding-top:24px;border-top:1px solid var(--so-line)}.so-terms dt{font-weight:650}.so-terms dd{color:var(--so-2);font-size:13.5px}.so-source{margin-top:26px!important;font-size:12.5px;color:var(--so-3)}
.so-writing{display:flex;flex-direction:column;gap:13px;margin-top:24px}.so-writing i{height:13px;border-radius:9px;background:color-mix(in srgb,var(--so-ink) 9%,transparent);animation:so-pulse 1.6s ease-in-out infinite}
.so-cta{display:flex!important;gap:18px;align-items:center;flex-wrap:wrap;flex-direction:row!important;background:color-mix(in oklab,var(--so-a),transparent 86%)}.so-feedback{display:flex;gap:22px;margin-top:22px;align-items:flex-start}.so-feedback ul{padding-left:18px;margin-bottom:12px;list-style:disc}
.so-how{display:grid;grid-template-columns:1fr 1fr 2fr;gap:14px;margin-top:20px}.so-preview{max-height:460px;overflow:auto;margin-top:16px;padding:4px 20px 4px 4px;border-top:1px solid var(--so-line);padding-top:18px}.so-earlier{padding:9px 0;border-top:1px solid var(--so-line);font-size:13px}.so-wait{padding:22px 0}
.so-quiz{display:flex;flex-direction:column;gap:14px;max-width:760px;width:100%;margin:0 auto}.so-quiztop{display:flex;gap:12px;align-items:center}.so-q h2{font-size:23px;line-height:1.35;margin:12px 0 20px}.so-qmeta{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.so-opts{display:flex;flex-direction:column;gap:9px}.so-opt{display:flex!important;gap:13px;align-items:center;padding:13px 16px!important;border:1px solid var(--so-line)!important;border-radius:15px;transition:border-color .2s,background .2s,transform .18s var(--so-ease)}.so-opt span:nth-child(2){flex:1}.so-opt:hover:not(:disabled){border-color:var(--so-a)!important;transform:translateX(3px)}.so-optn{display:grid;place-items:center;width:27px;height:27px;flex:none;border-radius:9px;background:color-mix(in srgb,var(--so-ink) 8%,transparent);font-size:12px;font-weight:700}.so-opt.right{border-color:var(--so-good)!important;background:color-mix(in srgb,var(--so-good) 14%,transparent)}.so-opt.miss{border-color:color-mix(in srgb,var(--so-bad) 55%,transparent)!important;opacity:.6}
.so-result{margin-top:18px;padding:17px 19px;border-radius:16px;animation:so-up .4s var(--so-ease) both}.so-result.good{background:color-mix(in srgb,var(--so-good) 13%,transparent)}.so-result.bad{background:color-mix(in srgb,var(--so-bad) 11%,transparent)}.so-result .so-bar{margin:12px 0}.so-result p+p{margin-top:8px}.so-done{display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;padding:50px 20px}.so-done .so-ring-in{font-size:24px}
.so-drop{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:38px;border:1.5px dashed var(--so-line);border-radius:20px;transition:border-color .2s,background .2s}.so-drop svg{color:var(--so-a)}.so-drop.over{border-color:var(--so-a);background:color-mix(in srgb,var(--so-a) 9%,transparent)}
.so-link{font-size:17px!important;font-weight:650;letter-spacing:-.01em}.so-link:hover{color:var(--so-a)}.so-goals{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.so-goal{display:inline-flex;gap:9px;align-items:center;padding:7px 13px;border-radius:99px;border:1px solid var(--so-line);font-size:13px}.so-goal i{width:13px;height:13px;flex:none;border-radius:99px;background:conic-gradient(var(--so-a) calc(var(--m)*1%),color-mix(in srgb,var(--so-ink) 14%,transparent) 0)}.so-goal.mastered i{background:var(--so-good)}.so-goal.new{color:var(--so-3)}.so-goal.due{border-color:var(--ui-orange,#f08a3c)}
.so-in{animation:so-up .5s var(--so-ease) both;animation-delay:calc(var(--i,0)*45ms)}.so-spin{animation:so-turn 1s linear infinite}
.so-tabs{display:flex;gap:4px;padding:5px;border:1px solid var(--so-line);border-radius:16px;align-self:flex-start;margin-bottom:16px;width:fit-content;max-width:100%;overflow-x:auto}.so-tabs button{display:flex;gap:7px;align-items:center;padding:8px 16px;border-radius:12px;font-size:13.5px;color:var(--so-2);transition:background .2s,color .2s}.so-tabs [aria-selected=true]{background:var(--so-ink);color:var(--ui-bg-editor,Canvas);font-weight:600}
.so-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:16px 0 20px}.so-tiles button{display:flex;flex-direction:column;gap:5px;padding:15px;border:1px solid var(--so-line);border-radius:16px;transition:border-color .2s,background .2s,transform .2s var(--so-ease)}.so-tiles button:hover{border-color:var(--so-a);transform:translateY(-2px)}.so-tiles [aria-pressed=true]{background:color-mix(in srgb,var(--so-a) 15%,transparent);border-color:color-mix(in srgb,var(--so-a) 60%,transparent)}.so-tiles svg{color:var(--so-a)}
.so-makebox{padding:26px 0 8px;display:flex;flex-direction:column;gap:12px;align-items:center}
.so-playbig{display:grid;place-items:center;width:58px;height:58px;border-radius:99px;background:var(--so-a);color:var(--so-on);flex:none;transition:transform .2s var(--so-ease)}.so-playbig:hover{transform:scale(1.06)}
.so-wave{display:flex;gap:3px;align-items:center;height:22px;margin-top:4px}.so-wave i{width:3px;height:5px;border-radius:9px;background:color-mix(in srgb,var(--so-a) 60%,transparent)}.so-wave.on i{animation:so-eq .9s ease-in-out infinite alternate;animation-delay:calc(var(--i)*-73ms)}@keyframes so-eq{from{height:4px}to{height:20px}}
.so-turns{display:flex;flex-direction:column;gap:4px;margin-top:16px;max-height:380px;overflow:auto}.so-turns button{padding:11px 15px;border-radius:14px;color:var(--so-3);line-height:1.5;transition:background .25s,color .25s}.so-turns button:hover{color:var(--so-ink)}.so-turns .on{background:color-mix(in srgb,var(--so-a) 12%,transparent);color:var(--so-ink);font-size:15.5px}.so-turns .b.on{background:color-mix(in srgb,var(--ui-orange,#f08a3c) 14%,transparent)}.so-who{display:block;font-size:11px;color:var(--so-a);font-weight:600}.so-turns .b .so-who{color:var(--ui-orange,#f08a3c)}.so-who:empty{display:none}.so-turns .hide{font-style:italic}
.so-stage{position:relative;width:100%;overflow:hidden;border-radius:20px;background:#000;outline-offset:3px}.so-film.tall .so-stage{max-width:330px;margin:0 auto}.so-stage:fullscreen{border-radius:0;display:grid;place-items:center;max-width:none}.so-filmplay{position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:flex-end;padding:4%;color:#fff;width:100%}.so-filmplay svg{padding:18px;width:74px;height:74px;border-radius:99px;background:rgb(0 0 0/.45);backdrop-filter:blur(8px);transition:transform .2s var(--so-ease)}.so-filmplay:hover svg{transform:scale(1.08)}
.so-filmbar{margin-top:10px;flex-wrap:nowrap!important}.so-chapters{display:flex;gap:3px;flex:6}.so-chapters button{height:22px;display:flex;align-items:center}.so-chapters button::before{content:'';display:none}.so-chapters button{position:relative}.so-chapters button::after{content:'';position:absolute;inset:8px 0;border-radius:9px;background:color-mix(in srgb,var(--so-ink) 14%,transparent)}.so-chapters i{position:absolute;z-index:1;left:0;top:8px;bottom:8px;border-radius:9px;background:var(--so-a)}.so-notes{margin-top:12px!important;padding:14px 18px;border-radius:14px;background:color-mix(in srgb,var(--so-ink) 5%,transparent)}.so-export{margin-top:18px;padding-top:16px;border-top:1px solid var(--so-line)}
.so-talk{display:flex!important;flex-direction:column;gap:18px}.so-talktop{display:flex;gap:24px;align-items:center}.so-orb{position:relative;display:grid;place-items:center;width:118px;height:118px;border-radius:50%;flex:none;color:var(--so-on);background:var(--so-a);transition:transform .15s;transform:scale(calc(1 + var(--l,0)*.16))}.so-orb i{position:absolute;inset:0;border-radius:50%;border:2px solid var(--so-a);opacity:0}.so-orb.speaking i,.so-orb.hearing i{animation:so-ping 1.7s ease-out infinite}.so-orb i+i{animation-delay:.6s!important}.so-orb.hearing i{border-color:var(--so-good)}.so-orb.thinking{animation:so-breathe 1.3s ease-in-out infinite}@keyframes so-ping{from{opacity:.7;transform:scale(1)}to{opacity:0;transform:scale(1.55)}}@keyframes so-breathe{50%{transform:scale(.93)}}
.so-log{display:flex;flex-direction:column;gap:9px;max-height:340px;overflow:auto;padding:4px}.so-say{max-width:82%;padding:11px 16px;border-radius:18px;line-height:1.5;animation:so-up .35s var(--so-ease) both}.so-say.tutor{align-self:flex-start;background:color-mix(in srgb,var(--so-ink) 7%,transparent);border-bottom-left-radius:5px}.so-say.me{align-self:flex-end;background:var(--so-a);color:var(--so-on);border-bottom-right-radius:5px}.so-dots{display:flex;gap:5px}.so-dots i{width:7px;height:7px;border-radius:9px;background:var(--so-3);animation:so-pulse 1s infinite}.so-dots i:nth-child(2){animation-delay:.2s}.so-dots i:nth-child(3){animation-delay:.4s}
.so-block{display:block;margin-top:16px}.so-cols2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:18px 0}.so-ul{padding-left:18px!important;list-style:disc}.so-ul li{margin-bottom:6px}.so-reads{margin-top:14px}.so-mix{display:flex;height:12px;border-radius:9px;overflow:hidden;gap:2px;margin-bottom:7px}.so-mix .hu{background:var(--so-good)}.so-mix .as{background:var(--ui-orange,#f08a3c)}.so-mix .ai{background:var(--so-bad)}.so-abside{padding:18px;border:1px solid var(--so-line);border-radius:18px;transition:border-color .3s}.so-abside.mine{border-color:var(--so-good)}.so-abside.model{border-color:var(--so-bad)}.so-abside p{white-space:pre-wrap;margin-top:12px;font-size:14px;line-height:1.6;max-height:330px;overflow:auto}
@keyframes so-up{from{opacity:0;transform:translateY(10px)}}@keyframes so-pulse{50%{opacity:.45}}@keyframes so-turn{to{transform:rotate(1turn)}}
@media (prefers-reduced-motion:reduce){.so-root *{animation:none!important;transition:none!important}}
@container (max-width:780px){.so-cols2{grid-template-columns:1fr}.so-top nav{overflow-x:auto;max-width:100%}.so-top nav button{white-space:nowrap}.so-two,.so-grid2,.so-how{grid-template-columns:minmax(0,1fr)}.so-rail{position:static;flex-direction:row;overflow-x:auto;padding-bottom:4px}.so-rail button{min-width:170px}.so-page{padding:24px 16px 60px}.so-top{padding:10px 16px;flex-wrap:wrap}.so-cover-big{width:84px}.so-empty{padding:26px}}
@container (max-width:480px){.so-export .so-grow{flex-basis:100%}.so-coursehead{align-items:flex-start}.so-feedback{flex-direction:column}.so-resume .so-ring{display:none}.so-top .so-grow,.so-top>.so-btn{display:none}}
`

const FONTS = `@font-face{font-family:'SO Inter';src:url(data:font/woff2;base64,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) format('woff2');font-weight:100 900;font-display:swap}@font-face{font-family:'SO Mono';src:url(data:font/woff2;base64,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) format('woff2');font-weight:400;font-display:swap}@font-face{font-family:'SO Mono';src:url(data:font/woff2;base64,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) format('woff2');font-weight:700;font-display:swap}`

const LOOKS = `
.so-prog{display:grid;gap:8px;margin:14px 0 4px}.so-progline{height:16px;border:1.5px solid var(--so-line);border-radius:99px;background:var(--so-paper,var(--so-card));overflow:hidden}.so-progline i{display:block;height:100%;background:var(--so-a);border-radius:99px;transition:width .35s linear}.so-root.sticker .so-progline{border:2px solid #121212;background:#fff}.so-progtext{display:flex;justify-content:space-between;gap:14px;font-size:14px}.so-progtext b{font-weight:650}.so-progtext span{color:var(--so-3);font-variant-numeric:tabular-nums;white-space:nowrap}.so-prog.slim{margin:8px 0 0;gap:5px}.so-prog.slim .so-progline{height:10px}.so-prog.slim .so-progtext{font-size:12.5px}.so-makingbox{padding:26px 4px 8px;max-width:620px}.so-makingbox h3{margin:0;font-size:20px;letter-spacing:-.02em}.so-makingbox p{margin:6px 0 0}.so-courseprog p{margin:8px 0 0}
.so-tray{position:fixed;right:18px;bottom:18px;z-index:40;width:min(330px,calc(100vw - 32px));background:var(--so-card);color:var(--so-ink);border:1.5px solid var(--so-line);border-radius:18px;overflow:hidden}.so-root.sticker .so-tray{border:2px solid #121212;box-shadow:6px 6px 0 #121212;background:#fff}.so-tray button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}.so-trayhead{display:flex;width:100%;align-items:center;gap:9px;padding:11px 15px;font-size:14px!important;min-height:44px}.so-root.sticker .so-trayhead{background:#ffc93c}.so-trayhead span:last-child{font-size:12.5px;text-decoration:underline}.so-traylist{max-height:min(46vh,380px);overflow:auto}.so-trayrow{padding:11px 15px 13px;border-top:1.5px solid var(--so-line)}.so-trayrow>button{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;padding:0}.so-trayrow>button b{font-size:14.5px;white-space:nowrap}.so-trayrow>button span{font-size:13px;color:var(--so-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.so-traydone{margin-top:7px;gap:10px;align-items:center}.so-traydone b{font-size:13.5px;color:var(--so-good)}.so-trayrow.bad .so-traydone b{color:var(--so-bad)}.so-traydone button{border:1.5px solid var(--so-line)!important;border-radius:99px;padding:5px 13px;font-size:13px;font-weight:650;min-height:32px}
@media(max-width:640px){.so-tray{right:12px;bottom:12px}.so-tray:not(:has(.so-traylist)){width:auto}.so-tray:not(:has(.so-traylist)) .so-grow{display:none}}
.so-ab{scroll-margin-top:84px;min-height:min(640px,78vh)}.so-tools{scroll-margin-top:84px}.so-facts{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);border:2.5px solid var(--so-line);margin:18px 0 26px;background:var(--so-paper,#fff);color:var(--so-ink)}.so-factsmain{padding:18px 22px 16px}.so-facts h2{margin:0 0 8px!important;font-size:34px!important;line-height:.95!important;letter-spacing:-.05em!important;font-weight:850!important;padding-bottom:10px;border-bottom:10px solid var(--so-line)}.so-factrow{display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1.5px solid var(--so-line);font-size:14.5px}.so-factrow b{text-align:right;font-weight:750}.so-factrow.big{font-size:21px;font-weight:800;letter-spacing:-.03em}.so-thick{display:block;height:6px;background:var(--so-line);margin-top:-1px}.so-factnote{font-family:'SO Mono',ui-monospace,monospace;font-size:11.5px;margin:10px 0 0!important;color:var(--so-3)}.so-choices{border-left:2.5px solid var(--so-line);padding:18px 22px;background:#ffc93c;color:#121212}.so-choices h2{border-color:#121212!important;color:#121212}.so-choices>div{padding:9px 0;border-bottom:1.5px solid #121212}.so-choices>div:last-child{border:0}.so-choices b{display:block;font-size:16px;letter-spacing:-.02em;line-height:1.2}.so-choices p{margin:3px 0 4px!important;font-size:13.5px;line-height:1.35;color:#363636}.so-choices s{font-size:12.5px;color:#5c4a10}
.so-seam{cursor:pointer;position:relative;outline-offset:4px}.so-prose.seams .so-seam{border-left:5px solid #2f3cdc;padding-left:14px;margin-left:-19px;box-shadow:none}.so-prose.seams .so-seam.own{border-left:5px dotted #d7322a}.so-prose.seams li.so-seam{margin-left:-6px;list-style-position:inside}.so-prose.seams .so-seam:hover{background:color-mix(in srgb,#ffc93c 26%,transparent)}.so-quote{display:block;margin-top:9px;background:#2f3cdc;color:#fff;padding:12px 15px;font-family:'SO Mono',ui-monospace,monospace;font-size:13px;line-height:1.5}.so-quote b{display:block;text-transform:uppercase;letter-spacing:.07em;font-size:10.5px;color:#ffc93c!important;font-weight:400;margin-bottom:3px}.so-seam.own .so-quote{background:#d7322a}.so-seam.own .so-quote b{color:#fff!important}.so-root .so-pressed{background:#121212!important;color:#fff!important}
@container (max-width:700px){.so-facts{grid-template-columns:1fr}.so-choices{border-left:0;border-top:2.5px solid var(--so-line)}}
.so-root{font-family:'SO Inter','Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-.01em}
.so-cover{overflow:hidden;border-radius:5px;font-family:'SO Inter','Helvetica Neue',Arial,sans-serif;font-weight:800;border:1.5px solid #121212;box-shadow:3px 3px 0 #121212}.so-cover-big{width:150px;border-radius:7px;box-shadow:6px 6px 0 #121212;transform:rotate(3deg);transition:transform .5s var(--so-ease)}.so-cover-big:hover{transform:none}
.so-board{margin:0!important}.so-board svg{display:block;width:100%;border-radius:18px;border:1.5px solid var(--so-line);background-color:var(--so-paper,#fff);background-image:radial-gradient(color-mix(in srgb,var(--so-ink) 13%,transparent) 1.1px,transparent 1.2px);background-size:24px 24px}.so-board figcaption{display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13px;color:var(--so-3);min-height:20px}
.so-stroke{stroke-dasharray:1;stroke-dashoffset:1;animation:so-draw var(--d) cubic-bezier(.4,.1,.3,1) var(--s) forwards}.so-tint{opacity:0;stroke:none;animation:so-fill .4s ease var(--s) forwards}.so-ink{font-family:'Bradley Hand','Segoe Print','Chalkboard SE','Comic Sans MS',cursive;font-weight:700;clip-path:inset(-20% 100% -20% 0);animation:so-write var(--d) linear var(--s) forwards}
@keyframes so-draw{to{stroke-dashoffset:0}}@keyframes so-fill{to{opacity:.2}}@keyframes so-write{to{clip-path:inset(-20% -5% -20% 0)}}
.so-root.sticker{--so-a:#2f3cdc;--so-ink:#121212;--so-2:#363636;--so-3:#5c5b57;--so-line:#121212;--so-card:#fff;--so-good:#176f3d;--so-bad:#cc2b22;--so-on:#fff;--so-paper:#fff;--ui-bg-editor:#faf8f3;--ui-bg-input:#fff;--ui-orange:#f26b2e;background:#faf8f3;color-scheme:light}
.so-root.studio{--so-a:#c6f432;--so-ink:#f2efe8;--so-2:#c9c6bd;--so-3:#97948b;--so-line:#2b2b28;--so-card:#141413;--so-good:#7fd88f;--so-bad:#ff7a6b;--so-on:#10110a;--so-paper:#0f0f0e;--ui-bg-editor:#0b0b0a;--ui-bg-input:#0f0f0e;--ui-orange:#f0934d;background:#0b0b0a;color-scheme:dark}
.so-root.studio .so-cover{border:0;box-shadow:0 10px 26px -12px #000}
.so-root.sticker em,.so-root.studio em{font-family:inherit;font-style:normal;font-weight:400}.so-root.sticker h1 em{color:#d7322a}.so-root.studio h1 em{color:var(--so-a)}.so-root.sticker .so-prose em,.so-root.studio .so-prose em{font-style:italic;color:inherit}
.so-root.sticker h1,.so-root.studio h1,.so-root.sticker .so-title,.so-root.studio .so-title,.so-root.sticker .so-sec h2,.so-root.studio .so-sec h2,.so-root.sticker .so-resume h2,.so-root.studio .so-resume h2{text-transform:uppercase;letter-spacing:-.05em!important;line-height:.9!important;font-weight:750}.so-root.sticker h1,.so-root.studio h1{font-size:clamp(38px,7.6cqw,84px)}.so-root.sticker .so-title,.so-root.studio .so-title{font-size:clamp(32px,5.2cqw,56px)!important}.so-root.sticker .so-sec h2,.so-root.studio .so-sec h2{font-size:34px}.so-root.sticker .so-resume h2,.so-root.studio .so-resume h2{font-size:30px}
.so-root.sticker .so-card>h2,.so-root.sticker .so-cta h2{text-transform:uppercase;letter-spacing:-.04em;font-size:26px;font-weight:750}
.so-root.sticker .so-eyebrow,.so-root.sticker .so-label,.so-root.sticker .so-tag,.so-root.studio .so-eyebrow,.so-root.studio .so-label,.so-root.studio .so-tag,.so-root.sticker .so-who,.so-root.sticker .so-week span,.so-root.sticker .so-filmbar .so-dim{font-family:'SO Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em;font-size:11px;font-weight:400}.so-root.sticker .so-tag{border:1.2px solid #121212;background:#ffc93c}
.so-root.sticker .so-top{padding:14px 24px;border-bottom:1.5px solid #121212}.so-root.sticker .so-top nav{border:1.5px solid #121212;border-radius:99px;background:#fff;padding:3px}.so-root.sticker .so-top nav button{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:500;color:#363636}.so-root.sticker .so-top nav [aria-current]{background:#121212!important;color:#fff!important}.so-root.sticker .so-logo{border:1.5px solid #121212;padding:4px 11px!important;background:#fff;text-transform:uppercase;letter-spacing:.06em;font-size:14px!important;font-weight:800}.so-root.sticker .so-logo em{color:#2f3cdc;text-transform:none;font-weight:500}
.so-root.sticker .so-card{border:1.5px solid #121212;box-shadow:5px 5px 0 #121212}.so-root.sticker .so-lesson .so-card{box-shadow:3px 3px 0 #121212}.so-root.sticker .so-btn{border:1.5px solid #121212!important;background:#fff;border-radius:99px;padding:9px 17px!important;box-shadow:2px 2px 0 #121212}.so-root.sticker .so-btn:hover:not(:disabled){transform:translate(-1px,-1px);box-shadow:3px 3px 0 #121212}.so-root.sticker .so-btn:active:not(:disabled){transform:translate(2px,2px);box-shadow:none}.so-root.sticker .so-btn.so-primary{border-color:#121212!important;box-shadow:3px 3px 0 #121212}.so-root.sticker .so-btn:disabled{box-shadow:none}
.so-root.sticker .so-input{border:1.5px solid #121212;border-radius:16px}.so-root.sticker .so-chips button,.so-root.sticker .so-seg,.so-root.sticker .so-tabs,.so-root.sticker .so-tiles button,.so-root.sticker .so-opt,.so-root.sticker .so-goal,.so-root.sticker .so-drop,.so-root.sticker .so-streak,.so-root.sticker .so-book,.so-root.sticker .so-visual,.so-root.sticker .so-vcard,.so-root.sticker .so-abside,.so-root.sticker .so-compare,.so-root.sticker .so-board svg,.so-root.sticker .so-stage{border:1.5px solid #121212!important;background-color:#fff}.so-root.sticker .so-tabs,.so-root.sticker .so-seg{border-radius:18px;box-shadow:4px 4px 0 #121212}.so-root.sticker .so-tabs [aria-selected=true]{background:#121212;color:#fff}.so-root.sticker .so-streak,.so-root.sticker .so-stage{box-shadow:5px 5px 0 #121212}.so-root.sticker .so-book{box-shadow:4px 4px 0 #121212}.so-root.sticker .so-tiles [aria-pressed=true]{background:#ffc93c!important;box-shadow:4px 4px 0 #121212}.so-root.sticker .so-tiles svg{color:#121212}.so-root.sticker .so-chips [aria-pressed=true]{background:#121212!important;color:#fff}
.so-root.sticker .so-resume{background:#2f3cdc;color:#fff}.so-root.sticker .so-resume .so-eyebrow,.so-root.sticker .so-resume .so-dim{color:#ffd34d}.so-root.sticker .so-resume .so-bar{background:rgb(255 255 255/.25)}.so-root.sticker .so-resume .so-bar i{background:#ffd34d}.so-root.sticker .so-resume .so-ring-bg{stroke:rgb(255 255 255/.25)}.so-root.sticker .so-resume .so-ring-fg{stroke:#ffd34d}.so-root.sticker .so-due,.so-root.sticker .so-due.hot{background:#ffc93c;color:#121212}.so-root.sticker .so-due .so-dim{color:#363636}.so-root.sticker .so-streak{background:#f39ac3}.so-root.sticker .so-streak .so-dim{color:#121212}.so-root.sticker .so-week span{background:#fff;border:1.2px solid #121212;color:#121212}.so-root.sticker .so-week .on{background:#f26b2e;color:#121212}.so-root.sticker .so-flame{color:#121212}
.so-root.sticker .so-cta{background:#ffc93c}.so-root.sticker .so-cta .so-dim{color:#363636}.so-root.sticker .so-bar{height:6px;background:#e6e2d8}.so-root.sticker .so-bar i{background:#2f3cdc}.so-root.sticker .so-num{border:1.5px solid #121212;background:#fff}.so-root.sticker .so-rail .on{background:#fff;border:1.5px solid #121212!important;box-shadow:4px 4px 0 #121212}.so-root.sticker .so-rail button{border:1.5px solid transparent}.so-root.sticker .so-rail .on .so-num{background:#121212;color:#fff}.so-root.sticker .so-num.done{background:#176f3d;color:#fff}.so-root.sticker .so-note{border:1.5px solid #121212;background:#e9ebff}.so-root.sticker .so-note-bad{background:#ffe1de}.so-root.sticker .so-optn,.so-root.sticker .so-vdot{background:#121212;color:#fff}.so-root.sticker .so-visual{background-color:#eef0ff}.so-root.sticker .so-result.good{background:#d9f2e1;border:1.5px solid #121212}.so-root.sticker .so-result.bad{background:#ffe1de;border:1.5px solid #121212}.so-root.sticker .so-building{border:1.5px solid #121212;background:#ffc93c}
.so-root.sticker .so-orb{background:#2f3cdc;color:#fff;border:2px solid #121212;box-shadow:5px 5px 0 #121212}.so-root.sticker .so-orb.hearing{background:#1a7748}.so-root.sticker .so-orb.thinking{background:#ffc93c;color:#121212}.so-root.sticker .so-orb i{border-color:#121212}.so-root.sticker .so-say{border:1.5px solid #121212}.so-root.sticker .so-say.tutor{background:#fff}.so-root.sticker .so-say.me{background:#2f3cdc;color:#fff}.so-root.sticker .so-turns .on{background:#e9ebff}.so-root.sticker .so-turns .b.on{background:#ffe9d6}.so-root.sticker .so-turns .b .so-who{color:#b3440d}.so-root.sticker .so-playbig{border:1.5px solid #121212;box-shadow:3px 3px 0 #121212}.so-root.sticker .so-notes{background:#f1eee5}.so-root.sticker .so-terms,.so-root.sticker .so-export{border-color:#121212}

.so-painted{white-space:pre-wrap;line-height:1.85;margin-top:12px!important;max-height:360px;overflow:auto}.so-painted span{border-radius:4px;padding:1px 0;-webkit-box-decoration-break:clone;box-decoration-break:clone}.so-painted .ai{background:color-mix(in srgb,var(--so-bad) 24%,transparent);box-shadow:inset 0 -2px 0 var(--so-bad)}.so-painted .assisted{background:color-mix(in srgb,#f2a03d 26%,transparent);box-shadow:inset 0 -2px 0 #f2a03d}.so-painted .human{background:color-mix(in srgb,var(--so-good) 13%,transparent)}
.so-mix.small{width:74px;height:8px;margin:0}.so-source2{display:flex!important;gap:13px;align-items:center;width:100%;margin-top:14px;padding:14px 18px!important;border-radius:16px;border:1.5px solid var(--so-line)!important;background:var(--so-card)!important}.so-source2 .so-mix{margin:6px 0 0}.so-source2.good>svg{color:var(--so-good)}.so-source2.bad>svg{color:var(--so-bad)}
.so-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}.so-day{min-height:74px;padding:8px;border:1px solid var(--so-line);border-radius:14px;background:var(--so-card);display:flex;flex-direction:column;gap:4px;overflow:hidden}.so-day>span{font-family:'SO Mono',ui-monospace,monospace;font-size:11px;color:var(--so-3)}.so-day.past{opacity:.5}.so-day.now{box-shadow:inset 0 0 0 2px var(--so-a)}.so-day i{font-style:normal;font-size:11px;font-weight:600;padding:2px 7px;border-radius:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#8f9cff;color:#121212}.so-day .exam{background:#f26b2e}.so-day .assignment{background:#ffc93c}
.so-task{padding:22px!important;transition:transform .2s var(--so-ease)}.so-task:hover:not(:disabled){transform:translateY(-3px)}.so-task h2{font-size:22px;margin-bottom:16px}.so-shelf.wide{grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}.so-root.sticker .so-task.assignment{background:#ffc93c}.so-root.sticker .so-task.exam{background:#f39ac3}.so-root.sticker .so-task .so-eyebrow,.so-root.sticker .so-task .so-dim{color:#121212}.so-root.sticker .so-task .so-tag{background:#fff}
.so-root .so-q h2{text-transform:none!important;letter-spacing:-.015em!important;font-size:23px!important;font-weight:650!important}.so-work{max-width:860px}.so-qh{font-size:18px!important;text-transform:none!important;letter-spacing:-.01em!important}.so-work .so-card .so-input,.so-work .so-opts{margin:14px 0 10px}.so-opt.picked{background:color-mix(in srgb,var(--so-a) 16%,transparent)!important;border-color:var(--so-a)!important}.so-clock{font-family:'SO Mono',ui-monospace,monospace;font-size:20px;padding:4px 12px;border-radius:12px;border:1.5px solid var(--so-line)}.so-clock.low{background:var(--so-bad);color:#fff}label.so-btn{cursor:pointer}
.so-meetform{margin-top:14px}.so-meet{display:flex;gap:14px;align-items:center;padding:13px 0;border-top:1px solid color-mix(in srgb,var(--so-ink) 14%,transparent)}.so-meet b,.so-meet .so-dim{display:block}.so-when{font-family:'SO Mono',ui-monospace,monospace;font-size:12px;width:150px;flex:none}.so-tag.ok{background:color-mix(in srgb,var(--so-good) 24%,transparent)!important}.so-root .so-card>.so-row+.so-meet{margin-top:12px}
.so-signals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.so-big2{display:block;font-size:44px;line-height:1.05;letter-spacing:-.04em;font-weight:780;margin-bottom:8px}.so-big2 span{font-size:16px;letter-spacing:0;font-weight:500;color:var(--so-3)}.so-spark{display:block;width:100%;height:40px}.so-spark path{fill:color-mix(in srgb,var(--so-a) 30%,transparent);stroke:var(--so-a);stroke-width:2;vector-effect:non-scaling-stroke}.so-spark .bad{fill:color-mix(in srgb,var(--so-bad) 25%,transparent);stroke:var(--so-bad)}.so-mid{font-size:clamp(30px,5cqw,48px)!important}.so-pts{width:74px!important;text-align:center;padding:7px!important}.so-ans{white-space:pre-wrap;margin-top:12px!important;line-height:1.7}
.so-grid{border-collapse:separate;border-spacing:0;width:100%;margin-top:14px}.so-grid th{text-align:left;font-weight:500;padding:9px 14px 9px 0;vertical-align:middle}.so-grid thead b,.so-grid thead .so-dim{display:block;max-width:190px}.so-grid td{padding:6px 14px 6px 0}.so-grid tbody tr>*{border-top:1px solid color-mix(in srgb,var(--so-ink) 12%,transparent)}.so-grid tbody th{display:flex;gap:11px;align-items:center;font-weight:600}.so-face{display:grid;place-items:center;width:34px;height:34px;border-radius:99px;background:#f39ac3;color:#121212;border:1.5px solid var(--so-line);font-weight:700}.so-grid tr:nth-child(2n) .so-face{background:#8f9cff}.so-grid tr:nth-child(3n) .so-face{background:#ffc93c}.so-dot2{display:block;width:16px;height:16px;border-radius:99px;border:1.5px dashed var(--so-3)}.so-dot2.half{border-style:solid;background:linear-gradient(90deg,var(--so-a) 50%,transparent 0)}.so-dot2.late{border:1.5px solid var(--so-bad)}.so-cell{display:inline-flex!important;gap:10px;align-items:center;padding:8px 14px!important;border-radius:12px;border:1.5px solid var(--so-line)!important;background:var(--so-card)!important;font-size:13px;font-weight:600}.so-cell:hover{box-shadow:3px 3px 0 var(--so-line)}.so-cell.back{opacity:.75}.so-qs{margin-top:14px;list-style:decimal}
@container (max-width:780px){.so-signals{grid-template-columns:1fr}.so-cal{grid-template-columns:repeat(7,minmax(44px,1fr))}.so-day{min-height:58px;padding:5px}.so-day i{font-size:0;height:8px;padding:0}.so-when{width:auto}}
.so-game{width:100%;aspect-ratio:16/10;margin-top:16px;border-radius:20px;overflow:hidden;border:1.5px solid var(--so-line);background:#faf8f3}.so-root.sticker .so-game{box-shadow:5px 5px 0 #121212}.so-game:fullscreen{border-radius:0;border:0}.so-levels{display:flex;gap:6px}.so-levels i{display:grid;place-items:center;width:28px;height:28px;border-radius:99px;border:1.5px solid var(--so-line);font-style:normal;font-size:12px;font-weight:700;transition:background .3s}.so-levels .on{background:var(--so-good);color:#fff}@container (max-width:520px){.so-game{aspect-ratio:9/13}}.so-scanbar{height:12px;border-radius:9px;margin-top:8px;overflow:hidden;background:color-mix(in srgb,var(--so-ink) 10%,transparent)}.so-scanbar i{display:block;height:100%;background:var(--so-a);animation:so-scan .9s cubic-bezier(.4,0,.2,1) both}@keyframes so-scan{from{width:0}to{width:100%}}.so-mix i{animation:so-grow .9s var(--so-ease) both;transform-origin:0 50%}@keyframes so-grow{from{transform:scaleX(0)}}.so-painted span{animation:so-paint .5s ease both;animation-delay:calc(var(--i,0)*70ms)}@keyframes so-paint{from{background-color:transparent;box-shadow:none}}.so-setup{display:grid;grid-template-columns:1fr 1.5fr;gap:18px;align-items:start}.so-setup .here{display:flex!important;flex-direction:column;gap:14px;align-items:flex-start}.so-root.sticker .so-setup .here{background:#ffc93c}.so-svc{display:flex;gap:14px;align-items:center;padding:14px 0;border-top:1px solid color-mix(in srgb,var(--so-ink) 14%,transparent)}.so-svc:first-of-type{margin-top:14px}.so-svc b,.so-svc .so-dim{display:block}.so-dotbig{display:grid;place-items:center;width:40px;height:40px;border-radius:99px;border:1.5px solid var(--so-line);flex:none}.so-svc.on .so-dotbig{background:var(--so-good);color:#fff;border-color:transparent}@container (max-width:780px){.so-setup{grid-template-columns:1fr}}.so-showgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:26px;align-items:start}.so-paper{container-type:inline-size;position:relative;aspect-ratio:8.5/11;max-height:640px;width:100%;max-width:495px;margin:0 auto;background:#fffef9;color:#26241f;border:1.5px solid var(--so-line);border-radius:10px;overflow:hidden;box-shadow:6px 6px 0 var(--so-line)}.so-empty2{display:grid;place-items:center;color:#2f3cdc}.so-blk{position:absolute;font-family:Georgia,serif;line-height:1.28;border-radius:4px;opacity:.12;transition:opacity .35s,background .6s,box-shadow .35s;overflow:hidden}.so-blk.on{opacity:1;box-shadow:0 0 0 1.5px #2f3cdc}.so-blk.human{background:rgb(23 111 61/.16);box-shadow:0 0 0 1.5px #176f3d}.so-blk.ai{background:rgb(204 43 34/.2);box-shadow:0 0 0 1.5px #cc2b22}.so-blk.assisted{background:rgb(242 160 61/.25);box-shadow:0 0 0 1.5px #f2a03d}.so-steps{display:flex;flex-direction:column;gap:12px}.so-step{display:flex;gap:16px;padding:18px 20px;border:1.5px solid var(--so-line);border-radius:18px;background:var(--so-card);transition:opacity .3s,transform .3s var(--so-ease)}.so-step.wait{opacity:.35}.so-step.now{box-shadow:5px 5px 0 var(--so-line);transform:translate(-2px,-2px)}.so-step b{font-size:17px}.so-step .so-mix{margin:10px 0 6px}.so-step.done .so-num{background:var(--so-good);color:#fff;border-color:transparent}.so-step .so-num{width:30px;height:30px}.so-pops{display:flex;flex-direction:column;gap:7px;margin-top:8px}.so-pops span{display:flex;gap:9px;align-items:center;opacity:0;transform:translateX(-10px);transition:opacity .35s,transform .35s var(--so-ease)}.so-pops .on{opacity:1;transform:none}.so-pops svg{color:var(--so-good)}.so-pops em{font-style:normal!important;font-family:'SO Mono',monospace!important;font-size:11px;color:var(--so-3)!important;margin-left:auto}.so-bigdrop{padding:70px 30px;background:var(--so-card)}.so-bigdrop .so-row{justify-content:center}.so-root.sticker .so-bigdrop{box-shadow:6px 6px 0 #121212;border-style:dashed!important}.so-bigdrop h2{font-size:34px;text-transform:uppercase;letter-spacing:-.04em}.so-stop{padding:26px;border:1.5px solid var(--so-line);border-radius:20px;background:#cc2b22;color:#fff;box-shadow:6px 6px 0 #121212}.so-stop h2{font-size:30px;text-transform:uppercase;letter-spacing:-.04em;margin-bottom:8px}.so-stop .so-row{margin-top:16px}.so-stop .so-btn{color:#121212}.so-stop .so-primary{color:#fff}.so-ab .so-abside .so-mix{margin-top:12px}@container (max-width:780px){.so-showgrid{grid-template-columns:1fr}}.so-samples{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px}.so-samples .so-label{margin:0 4px 0 0}.so-samples button{display:inline-flex;gap:8px;align-items:center;padding:7px 14px;border-radius:99px;border:1.5px dashed var(--so-line);font-size:13px;font-weight:600;transition:background .2s}.so-samples button:hover:not(:disabled){border-style:solid}.so-samples .ai svg{color:var(--so-bad)}.so-samples .hu svg{color:var(--so-good)}.so-talkgrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:18px;align-items:start}.so-talkgrid.solo{grid-template-columns:1fr}@container (max-width:900px){.so-talkgrid{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.so-stroke{stroke-dashoffset:0}.so-tint{opacity:.2}.so-ink{clip-path:none}}
`

export default {
  id: ID,
  name: 'Study OS Solo',
  register(ctx) {
    const style = document.createElement('style')
    style.dataset.plugin = ID
    style.textContent = FONTS + CSS + LOOKS
    document.head.append(style)
    if (ctx.onDispose) ctx.onDispose(() => style.remove())
    ctx.registerMany([
      { id: 'page', area: ROUTES_AREA, data: { path: ROUTE }, render: () => h(Page, { ctx }) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: ROUTE, label: 'Study OS', codicon: 'mortar-board' } },
      { id: 'teacher', area: ROUTES_AREA, data: { path: `${ROUTE}-teacher` }, render: () => h(Desk, { ctx }) },
      { id: 'teachernav', area: SIDEBAR_NAV_AREA, data: { path: `${ROUTE}-teacher`, label: 'Study OS Teacher', codicon: 'checklist' } },
      { id: 'open', area: PALETTE_AREA, data: { id: 'study-os-solo.open', label: 'Open Study OS Solo', keywords: ['study', 'learn', 'quiz', 'course'], run: () => host.navigate(ROUTE) } }
    ])
  }
}
