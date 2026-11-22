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
const Note = ({ children, bad }) => h('div', { className: cls('so-note', bad && 'so-note-bad'), role: bad ? 'alert' : undefined }, children)

/** A cover drawn from the title, in the theme's own colours. */
function Cover({ course, big }) {
  const n = hash(course.id)
  const shapes = [
    () => [h('circle', { key: 1, cx: 78, cy: 34, r: 30, className: 'c2' }), h('circle', { key: 2, cx: 40, cy: 92, r: 18, className: 'c3' })],
    () => [0, 1, 2, 3].map(i => h('circle', { key: i, cx: 60, cy: 62, r: 12 + i * 13, fill: 'none', className: 'l2', strokeWidth: 5 })),
    () => [0, 1, 2, 3, 4].map(i => h('rect', { key: i, x: 14 + i * 20, y: 96 - ((n >> (i * 3)) % 6) * 13, width: 13, height: 60, rx: 6, className: i % 2 ? 'c2' : 'c3' })),
    () => [h('path', { key: 1, d: 'M0 110 Q30 60 60 92 T120 70 V160 H0Z', className: 'c2' }), h('path', { key: 2, d: 'M0 130 Q36 92 70 118 T120 104 V160 H0Z', className: 'c3' })],
    () => [h('path', { key: 1, d: 'M60 18 L104 96 H16Z', className: 'c2' }), h('circle', { key: 2, cx: 60, cy: 76, r: 16, className: 'c3' })],
    () => [0, 1, 2].flatMap(y => [0, 1, 2].map(x => h('rect', { key: `${x}${y}`, x: 18 + x * 30, y: 16 + y * 30, width: 22, height: 22, rx: (n >> (x + y)) % 2 ? 11 : 4, className: (n >> (x * 2 + y)) % 2 ? 'c2' : 'c3' })))
  ]
  return h('svg', { className: cls('so-cover', big && 'so-cover-big', `h${n % 5}`), viewBox: '0 0 120 150', 'aria-hidden': true }, h('rect', { width: 120, height: 150, className: 'c1' }), shapes[n % shapes.length]())
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
function Markdown({ text }) {
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
      out.push(h(ordered ? 'ol' : 'ul', { key: i }, items.map((t, k) => h('li', { key: k }, inline(t)))))
      continue
    }
    const p = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*>|\s*```)/.test(lines[i]) && !li.test(lines[i])) p.push(lines[i++])
    out.push(h('p', { key: i }, inline(p.join(' '))))
  }
  return h('div.so-prose', out)
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
    data && data.writing && h('div.so-row.so-wait', h(Icon, { n: 'spin' }), h('span', 'Writing it the new way. Usually under a minute; you can keep reading.')),
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
function Making({ m, what, onMake }) {
  if (m && m.status === 'making') return h('div.so-row.so-wait', h(Icon, { n: 'spin' }), h('span', `Writing ${what}. Usually under a minute.`))
  return h('div.so-makebox',
    m && m.error && h(Note, { bad: true }, m.error),
    h(Btn, { kind: 'main', onClick: onMake }, m ? `Make ${what} again` : `Make ${what}`))
}
function Listen({ ctx, section }) {
  const { data, refetch } = useMedia(ctx, section.id)
  const [kind, setKind] = useState('podcast')
  const [ear, setEar] = useState(null)
  const [error, setError] = useState(null)
  const m = data && data.media.find(x => x.kind === kind)
  const make = async () => { setError(null); try { await ctx.rest(`/sections/${section.id}/media`, { method: 'POST', body: { kind } }); refetch() } catch (err) { setError(msg(err)) } }
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

function Film({ ctx, sid, kind }) {
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
    const ready = e => { if (frame.current && e.source === frame.current.contentWindow && e.data && e.data.film) draw(slides ? hold(0) : 0.9) }
    window.addEventListener('message', ready)
    return () => { window.removeEventListener('message', ready); run.current++ }
  }, [f])
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
      draw(starts[i])
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
function Watch({ ctx, section }) {
  const client = useQueryClient()
  const { data, refetch } = useMedia(ctx, section.id)
  const [kind, setKind] = useState('explainer')
  const [error, setError] = useState(null)
  const m = data && data.media.find(x => x.kind === kind)
  const make = async () => { setError(null); try { await ctx.rest(`/sections/${section.id}/media`, { method: 'POST', body: { kind } }); client.removeQueries({ queryKey: [ID, 'film', section.id, kind] }); refetch() } catch (err) { setError(msg(err)) } }
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
function Talk({ ctx, section, onChange }) {
  const sp = useSpeaker(ctx)
  const [log, setLog] = useState([])
  const [state, setState] = useState('idle')
  const [mic, setMic] = useState(false)
  const [text, setText] = useState('')
  const [visual, setVisual] = useState(null)
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
      if (r.visual) setVisual(r.visual)
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
    visual && h(Visual, { v: visual }),
    log.length > 0 && h('div.so-log', log.map((t, i) => h('div', { key: i, className: cls('so-say', t.who) }, t.text)), state === 'thinking' && h('div.so-say.tutor.so-dots', h('i'), h('i'), h('i')), h('span', { ref: end })),
    quiz && h(Quiz, { ctx, scope: { section_id: section.id }, title: 'Show me', onClose: () => setQuiz(false), onChange }),
    h('form.so-row', { onSubmit: e => { e.preventDefault(); const t = text.trim(); if (t) { setText(''); answer(t) } } },
      h('input.so-input.so-grow', { value: text, placeholder: 'Or type it', 'aria-label': 'Say something', maxLength: 1000, onChange: e => setText(e.target.value) }),
      h(Btn, { kind: 'main', type: 'submit', disabled: !text.trim() || state === 'thinking' }, 'Send'),
      !log.length && h(Btn, { onClick: () => answer('') }, 'You start'),
      state === 'speaking' && h(Btn, { icon: 'stop', onClick: () => { run.current++; sp.stop(); setState('idle') } }, 'Quiet')))
}

/* ---- essay check --------------------------------------------------------------------------------------------------------- */

const Reads = ({ v, note }) => v
  ? h('div.so-reads', h('div.so-mix', { role: 'img', 'aria-label': `${pct(v.human)}% human, ${pct(v.assisted)}% assisted, ${pct(v.ai)}% AI` }, h('i.hu', { style: { flex: v.human } }), h('i.as', { style: { flex: v.assisted } }), h('i.ai', { style: { flex: v.ai } })), h('div.so-dim', h('b', `Reads as ${v.label}. `), `${pct(v.human)}% human-written, ${pct(v.assisted)}% assisted, ${pct(v.ai)}% AI, by Pangram`))
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
        h('p', s.text), guess !== null && h(Reads, { v: s.authorship, note: s.note })))),
      guess !== null && h('p.so-dim', 'A detector can be wrong both ways. Use it to start a conversation, never to decide one.')))
}

/* ---- a course -------------------------------------------------------------------------------------------------------- */

function Course({ ctx, id, home, go }) {
  const client = useQueryClient()
  const [at, setAt] = useState(0)
  const [quiz, setQuiz] = useState(false)
  const [reword, setReword] = useState(false)
  const [sure, setSure] = useState(false)
  const top = useRef(null)
  const { data: c, error, refetch } = useQuery({ queryKey: [ID, 'course', id], queryFn: () => ctx.rest(`/courses/${id}`), refetchInterval: q => (q.state.data && ['planning', 'writing'].includes(q.state.data.status) ? 3000 : false) })
  const [tab, setTab] = useState('learn')
  const s = c && c.list[at]
  useEffect(() => { if (s && s.body && !s.read) ctx.rest(`/courses/${id}?section=${s.id}`).then(() => client.invalidateQueries({ queryKey: [ID, 'home'] })).catch(() => {}) }, [s && s.id, s && !!s.body])
  const open = i => { setAt(i); setQuiz(false); setReword(false); top.current && top.current.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }) }
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
    busy && h('div.so-building', h(Icon, { n: 'spin' }), h('span', c.status === 'planning' ? 'Planning your course' : `Writing it: ${c.written} of ${c.sections} sections ready`), h('div.so-barwide', h(Bar, { value: c.sections ? c.written / c.sections : 0.04 }))),
    c.error && !busy && h(Note, { bad: true }, h('span.so-grow', c.error), h(Btn, { icon: 'redo', onClick: async () => { await ctx.rest(`/courses/${id}/retry`, { method: 'POST' }); refetch() } }, 'Try again')),
    c.list.length > 0 && h('div.so-two',
      h('nav.so-rail', { 'aria-label': 'Sections' }, c.list.map((x, i) => {
        const known = x.goals.length ? x.goals.reduce((a, g) => a + g.mastery, 0) / x.goals.length : 0
        return h('button', { key: x.id, type: 'button', 'aria-current': i === at ? 'true' : undefined, className: cls(i === at && 'on'), onClick: () => open(i) },
          h('span', { className: cls('so-num', x.goals.length && x.goals.every(g => g.mastered) && 'done') }, x.status === 'writing' ? h(Icon, { n: 'spin', size: 14 }) : x.goals.length && x.goals.every(g => g.mastered) ? h(Icon, { n: 'check', size: 14 }) : i + 1),
          h('span.so-grow', x.title, h(Bar, { value: known })))
      })),
      s && h('div.so-main', { key: s.id },
        s.body && !quiz && h('div.so-tabs', { role: 'tablist' }, [['learn', 'Learn', 'book'], ['watch', 'Watch', 'play'], ['listen', 'Listen', 'sound'], ['talk', 'Talk', 'mic']].map(([k, t, i]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': tab === k, onClick: () => { setTab(k); setReword(false) } }, h(Icon, { n: i, size: 16 }), t))),
        s.body && !quiz && tab === 'watch' ? h(Watch, { key: `w${s.id}`, ctx, section: s }) : s.body && !quiz && tab === 'listen' ? h(Listen, { key: `l${s.id}`, ctx, section: s }) : s.body && !quiz && tab === 'talk' ? h(Talk, { key: `t${s.id}`, ctx, section: s, onChange: changed }) : quiz ? h(Quiz, { ctx, scope: { course_id: id, section_id: s.id }, title: s.title, onClose: () => { setQuiz(false); changed() }, onChange: changed })
          : h('div.so-in',
            h('article.so-card.so-lesson',
              h('div.so-eyebrow', `Section ${at + 1} of ${c.list.length}`),
              h('h2.so-title', s.title),
              s.goal && h('p.so-lead', s.goal),
              s.body && h('div.so-row.so-tools', h(Btn, { icon: 'sliders', 'aria-expanded': reword, onClick: () => setReword(!reword) }, 'Change how it’s explained')),
              reword && h(Rewording, { ctx, section: s, meta: home, onClose: () => setReword(false), onChange: changed }),
              s.body ? h(Markdown, { text: s.body }) : s.error ? h(Note, { bad: true }, s.error) : h('div.so-writing', [92, 100, 84, 96, 70].map(w => h('i', { key: w, style: { width: `${w}%` } }))),
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
  const pick = useRef(null)
  const add = async file => {
    if (!file) return
    setBusy(true); setError(null)
    try { setUp(await ctx.rest('/upload', { method: 'POST', upload: { filename: file.name, contentType: file.type || 'application/octet-stream', bytes: new Uint8Array(await file.arrayBuffer()) }, timeoutMs: 300000 })) } catch (err) { setError(msg(err)) }
    setBusy(false)
  }
  const make = async () => {
    setBusy(true); setError(null)
    try {
      const body = { how, topic: mode === 'topic' ? topic : null, text: mode === 'text' ? text : null, upload_id: mode === 'file' && up ? up.id : null }
      const r = await ctx.rest('/courses', { method: 'POST', body })
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
    !cs.length && h('div.so-card.so-empty.so-in', h(Icon, { n: 'book', size: 44 }), h('h2', 'Make your first course'), h('p.so-dim', 'Give it a topic, a PDF or your notes. It writes short lessons, quizzes you, and brings things back before you forget them. All on this computer, with no account.'), h(Btn, { kind: 'main', icon: 'plus', onClick: () => go('new') }, 'Make a course')),
    cs.length > 0 && h('div.so-grid2.so-in',
      h('button.so-card.so-resume', { type: 'button', onClick: () => go('course', last.id) }, h(Cover, { course: last }), h('div.so-grow', h('div.so-eyebrow', last.status === 'ready' ? 'Keep going' : last.status === 'failed' ? 'Needs another try' : 'Being written'), h('h2', last.title), h('p.so-dim', last.status === 'ready' ? `${last.read} of ${last.sections} sections read` : last.status === 'failed' ? last.error : `${last.written} of ${last.sections || '…'} sections ready`), h(Bar, { value: last.mastery })), h(Ring, { value: last.mastery, size: 72 }, h('b', `${pct(last.mastery)}%`))),
      h('button', { type: 'button', className: cls('so-card so-due', home.due && 'hot'), disabled: !home.due, onClick: () => go('review') }, h(Icon, { n: 'redo', size: 26 }), h('div', h('b.so-count', home.due), h('div', home.due === 1 ? 'goal to review' : 'goals to review')), h('span.so-dim', home.due ? 'A few minutes keeps it fresh' : 'Nothing due right now'))),
    cs.length > 0 && h('div.so-row.so-sec', h('h2.so-grow', 'Your courses'), h(Btn, { kind: 'main', icon: 'plus', onClick: () => go('new') }, 'New course')),
    h('div.so-shelf', cs.map((c, i) => h('button.so-book.so-in', { key: c.id, type: 'button', style: { '--i': i }, onClick: () => go('course', c.id) }, h(Cover, { course: c }), h('div', h('b', c.title), h('span.so-dim', c.status === 'ready' ? `${c.mastered} of ${c.goals} known` : c.status === 'failed' ? 'Needs another try' : `Writing ${c.written}/${c.sections || '…'}`), c.due > 0 && h('span.so-tag', `${c.due} due`))))))
}

function Page({ ctx }) {
  const saved = ctx.storage ? ctx.storage.get('view', { name: 'home' }) : { name: 'home' }
  const [view, setView] = useState(saved || { name: 'home' })
  const client = useQueryClient()
  const { data: home, error, refetch } = useQuery({ queryKey: [ID, 'home'], queryFn: () => ctx.rest('/home'), refetchInterval: q => (q.state.data && q.state.data.courses.some(c => ['planning', 'writing'].includes(c.status)) ? 4000 : 60000), retry: 1 })
  const go = useCallback((name, id) => {
    const v = { name, id }
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
  else if (name === 'essay') body = h(Essay, { ctx, home })
  else if (name === 'known') body = h(Known, { ctx, go })
  else if (name === 'review') body = h('div.so-page', h(Quiz, { ctx, scope: { due_only: true }, title: 'Review', onClose: () => { refetch(); go('home') }, onChange: () => client.invalidateQueries({ queryKey: [ID, 'progress'] }) }))
  else if (name === 'course') body = h(Course, { key: view.id, ctx, id: view.id, home, go })
  else body = h(Home, { home, go })
  return h('div.so-root',
    h('div.so-top', h('button.so-logo', { type: 'button', onClick: () => go('home') }, 'Study', h('em', 'OS')),
      h('nav', { 'aria-label': 'Study OS' }, [['home', 'Courses'], ['known', 'What you know'], ['essay', 'Essay check']].map(([k, t]) => h('button', { key: k, type: 'button', 'aria-current': name === k ? 'page' : undefined, onClick: () => go(k) }, t)), home && home.due > 0 && h('button', { type: 'button', 'aria-current': name === 'review' ? 'page' : undefined, onClick: () => go('review') }, 'Review', h('span.so-badge', home.due))),
      h('span.so-grow'), h(Btn, { icon: 'plus', onClick: () => go('new') }, 'New')),
    h('div.so-body', { key: `${name}:${view.id || ''}` }, body))
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
.so-bar{height:5px;border-radius:9px;background:color-mix(in srgb,var(--so-ink) 10%,transparent);overflow:hidden}.so-bar i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,var(--so-a),oklch(from var(--so-a) l c calc(h + 50)));transition:width .7s var(--so-ease)}.so-barwide{width:180px}
.so-ring{position:relative;display:grid;place-items:center;flex:none}.so-ring svg{position:absolute;inset:0}.so-ring circle{fill:none;stroke-width:6;stroke-linecap:round}.so-ring-bg{stroke:color-mix(in srgb,var(--so-ink) 10%,transparent)}.so-ring-fg{stroke:var(--so-a);transition:stroke-dashoffset .9s var(--so-ease)}.so-ring-in{position:relative;font-size:15px}
.so-note{display:flex;gap:10px;align-items:center;padding:12px 16px;border-radius:14px;margin-top:12px;background:color-mix(in srgb,var(--so-a) 11%,transparent);font-size:13.5px}.so-note-bad{background:color-mix(in srgb,var(--so-bad) 13%,transparent)}
.so-skel{height:170px;border-radius:22px;background:color-mix(in srgb,var(--so-ink) 6%,transparent);animation:so-pulse 1.5s ease-in-out infinite}
.so-cover{display:block;width:74px;aspect-ratio:4/5;border-radius:12px;flex:none;box-shadow:0 8px 22px -10px rgb(0 0 0/.5)}.so-cover-big{width:128px;border-radius:18px;transform:rotate(-2.5deg)}
.so-cover .c1{fill:oklch(from var(--so-a) .46 .12 calc(h + var(--hh)))}.so-cover .c2{fill:oklch(from var(--so-a) .76 .15 calc(h + var(--hh) + 30))}.so-cover .c3{fill:oklch(from var(--so-a) .9 .08 calc(h + var(--hh) - 60))}.so-cover .l2{stroke:oklch(from var(--so-a) .8 .13 calc(h + var(--hh) + 30))}
.h0{--hh:0}.h1{--hh:48}.h2{--hh:310}.h3{--hh:200}.h4{--hh:275}
.so-hero{display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap}.so-streak{border:1px solid var(--so-line);border-radius:20px;padding:14px 18px;background:var(--so-card)}.so-streak b{font-size:24px;letter-spacing:-.03em}.so-flame{color:var(--ui-orange,#f08a3c);display:grid}
.so-week{display:flex;gap:5px;margin-top:8px}.so-week span{width:22px;height:22px;border-radius:8px;display:grid;place-items:center;font-size:10.5px;color:var(--so-3);background:color-mix(in srgb,var(--so-ink) 7%,transparent)}.so-week .on{background:color-mix(in srgb,var(--ui-orange,#f08a3c) 80%,transparent);color:#fff;font-weight:700}
.so-grid2{display:grid;grid-template-columns:2fr 1fr;gap:16px}.so-resume{display:flex!important;gap:20px;align-items:center;transition:border-color .25s,transform .25s var(--so-ease)}.so-resume:hover,.so-book:hover{transform:translateY(-3px)}.so-resume:hover{border-color:color-mix(in srgb,var(--so-a) 60%,transparent)}.so-resume h2{font-size:23px}.so-resume .so-bar{margin-top:12px}
.so-due{display:flex!important;flex-direction:column;gap:10px;justify-content:space-between}.so-due.hot{background:linear-gradient(150deg,color-mix(in oklab,var(--so-a),transparent 62%),color-mix(in oklab,var(--so-a),transparent 88%));border-color:color-mix(in srgb,var(--so-a) 45%,transparent)}.so-count{font-size:40px;line-height:1;letter-spacing:-.04em}
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
.so-cta{display:flex!important;gap:18px;align-items:center;flex-wrap:wrap;flex-direction:row!important;background:linear-gradient(120deg,color-mix(in oklab,var(--so-a),transparent 78%),transparent 70%)}.so-feedback{display:flex;gap:22px;margin-top:22px;align-items:flex-start}.so-feedback ul{padding-left:18px;margin-bottom:12px;list-style:disc}
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
.so-talk{display:flex!important;flex-direction:column;gap:18px}.so-talktop{display:flex;gap:24px;align-items:center}.so-orb{position:relative;display:grid;place-items:center;width:118px;height:118px;border-radius:50%;flex:none;color:var(--so-on);background:radial-gradient(circle at 32% 28%,oklch(from var(--so-a) calc(l + .14) c h),var(--so-a) 55%,oklch(from var(--so-a) calc(l - .18) c calc(h + 40)));transition:transform .15s;transform:scale(calc(1 + var(--l,0)*.16))}.so-orb i{position:absolute;inset:0;border-radius:50%;border:2px solid var(--so-a);opacity:0}.so-orb.speaking i,.so-orb.hearing i{animation:so-ping 1.7s ease-out infinite}.so-orb i+i{animation-delay:.6s!important}.so-orb.hearing i{border-color:var(--so-good)}.so-orb.thinking{animation:so-breathe 1.3s ease-in-out infinite}@keyframes so-ping{from{opacity:.7;transform:scale(1)}to{opacity:0;transform:scale(1.55)}}@keyframes so-breathe{50%{transform:scale(.93)}}
.so-log{display:flex;flex-direction:column;gap:9px;max-height:340px;overflow:auto;padding:4px}.so-say{max-width:82%;padding:11px 16px;border-radius:18px;line-height:1.5;animation:so-up .35s var(--so-ease) both}.so-say.tutor{align-self:flex-start;background:color-mix(in srgb,var(--so-ink) 7%,transparent);border-bottom-left-radius:5px}.so-say.me{align-self:flex-end;background:var(--so-a);color:var(--so-on);border-bottom-right-radius:5px}.so-dots{display:flex;gap:5px}.so-dots i{width:7px;height:7px;border-radius:9px;background:var(--so-3);animation:so-pulse 1s infinite}.so-dots i:nth-child(2){animation-delay:.2s}.so-dots i:nth-child(3){animation-delay:.4s}
.so-block{display:block;margin-top:16px}.so-cols2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:18px 0}.so-ul{padding-left:18px!important;list-style:disc}.so-ul li{margin-bottom:6px}.so-reads{margin-top:14px}.so-mix{display:flex;height:12px;border-radius:9px;overflow:hidden;gap:2px;margin-bottom:7px}.so-mix .hu{background:var(--so-good)}.so-mix .as{background:var(--ui-orange,#f08a3c)}.so-mix .ai{background:var(--so-bad)}.so-abside{padding:18px;border:1px solid var(--so-line);border-radius:18px;transition:border-color .3s}.so-abside.mine{border-color:var(--so-good)}.so-abside.model{border-color:var(--so-bad)}.so-abside p{white-space:pre-wrap;margin-top:12px;font-size:14px;line-height:1.6;max-height:330px;overflow:auto}
@keyframes so-up{from{opacity:0;transform:translateY(10px)}}@keyframes so-pulse{50%{opacity:.45}}@keyframes so-turn{to{transform:rotate(1turn)}}
@media (prefers-reduced-motion:reduce){.so-root *{animation:none!important;transition:none!important}}
@container (max-width:780px){.so-cols2{grid-template-columns:1fr}.so-top nav{overflow-x:auto;max-width:100%}.so-top nav button{white-space:nowrap}.so-two,.so-grid2,.so-how{grid-template-columns:minmax(0,1fr)}.so-rail{position:static;flex-direction:row;overflow-x:auto;padding-bottom:4px}.so-rail button{min-width:170px}.so-page{padding:24px 16px 60px}.so-top{padding:10px 16px;flex-wrap:wrap}.so-cover-big{width:84px}.so-empty{padding:26px}}
@container (max-width:480px){.so-export .so-grow{flex-basis:100%}.so-coursehead{align-items:flex-start}.so-feedback{flex-direction:column}.so-resume .so-ring{display:none}.so-top .so-grow,.so-top>.so-btn{display:none}}
`

export default {
  id: ID,
  name: 'Study OS Solo',
  register(ctx) {
    const style = document.createElement('style')
    style.dataset.plugin = ID
    style.textContent = CSS
    document.head.append(style)
    if (ctx.onDispose) ctx.onDispose(() => style.remove())
    ctx.registerMany([
      { id: 'page', area: ROUTES_AREA, data: { path: ROUTE }, render: () => h(Page, { ctx }) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: ROUTE, label: 'Study OS Solo', codicon: 'mortar-board' } },
      { id: 'open', area: PALETTE_AREA, data: { id: 'study-os-solo.open', label: 'Open Study OS Solo', keywords: ['study', 'learn', 'quiz', 'course'], run: () => host.navigate(ROUTE) } }
    ])
  }
}
