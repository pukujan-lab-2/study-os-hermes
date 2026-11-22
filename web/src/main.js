import { createRoot } from 'react-dom/client'
import { createElement as h, useCallback, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@hermes/plugin-sdk'
import plugin from '../../desktop/plugin.js'

const items = []
const keep = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('so:' + k) || 'null') ?? d } catch { return d } }, set: (k, v) => { try { localStorage.setItem('so:' + k, JSON.stringify(v)) } catch { /* private window */ } } }
const call = async (url, o = {}) => {
  let body
  const headers = {}
  if (o.upload) { const f = new FormData(); f.append('file', new Blob([o.upload.bytes], { type: o.upload.contentType }), o.upload.filename); body = f } else if (o.body) { body = JSON.stringify(o.body); headers['content-type'] = 'application/json' }
  const r = await fetch(url, { method: o.method || 'GET', body, headers })
  const t = await r.text()
  if (r.status === 401) location.reload()
  if (!r.ok) throw new Error(`${r.status}: ${t}`)
  return t ? JSON.parse(t) : {}
}
const said = e => { try { return JSON.parse(String(e.message).replace(/^\d+:\s*/, '')).detail } catch { return 'That didn’t work. Try again.' } }
const ctx = { web: true, registerMany: x => items.push(...x), onDispose() {}, os: { openExternal: u => window.open(u, '_blank', 'noopener') }, onEvent: () => () => {}, storage: keep, rest: (p, o) => call('/api/plugins/study-os-solo' + p, o) }
ctx.openTeacher = () => window.dispatchEvent(new CustomEvent('so-role', { detail: 'teacher' }))
ctx.openStudy = () => window.dispatchEvent(new CustomEvent('so-role', { detail: 'student' }))
plugin.register(ctx)
const route = end => items.find(i => i.area === 'routes' && i.data.path.endsWith('teacher') === end)
const client = new QueryClient()

function Bar({ info, role, setRole, load, say }) {
  const [code, setCode] = useState('')
  const [open, setOpen] = useState(false)
  const go = async (url, then) => { try { await call(url, { method: 'POST' }); await client.invalidateQueries(); await load(); if (then) then() } catch (e) { say(said(e)) } }
  const teacher = role === 'teacher'
  return h('div', { className: 'wb' },
    h('div', { className: 'wb-seg', role: 'group', 'aria-label': 'Who are you here' }, [['student', 'Student'], ['teacher', 'Teacher']].map(([k, t]) => h('button', { key: k, type: 'button', 'aria-pressed': role === k, onClick: () => { if (k === 'teacher' && info.joined) return say('You joined a class as a student. Leave it to run your own.'); setRole(k) } }, t))),
    teacher
      ? (info.code ? h('button', { className: 'wb-chip y', type: 'button', onClick: () => setOpen(!open), 'aria-expanded': open }, 'Class ', h('b', null, info.code), h('span', null, 'Show the QR')) : h('button', { className: 'wb-chip y', type: 'button', onClick: () => go('/api/space/open', () => setOpen(true)) }, 'Open a class for students'))
      : info.joined ? h('span', { className: 'wb-chip' }, 'In class ', h('b', null, info.code), h('button', { type: 'button', onClick: () => go('/api/space/leave') }, 'Leave'))
        : h('form', { className: 'wb-join', onSubmit: e => { e.preventDefault(); if (code.trim()) go(`/api/space/join/${encodeURIComponent(code.trim())}`, () => { keep.set('view', { name: 'class' }); location.reload() }) } }, h('input', { value: code, maxLength: 8, placeholder: 'Class code', 'aria-label': 'Class code', autoCapitalize: 'characters', onChange: e => setCode(e.target.value.toUpperCase()) }), h('button', { type: 'submit' }, 'Join')),
    h('span', { className: 'wb-grow' }),
    h('span', { className: 'wb-dev', title: 'Your own space on this device. No sign-in.' }, 'Device ', info.device, h('span', { className: 'wb-note' }, ' · kept 3 days, so nothing private')),
    h('button', { className: 'wb-x', type: 'button', onClick: () => { if (confirm('Delete everything in your space on this device?')) go('/api/space/forget', () => { try { localStorage.clear() } catch { /* none */ } location.href = '/app' }) } }, 'Delete my space'),
    open && info.code && teacher && h('div', { className: 'wb-panel' },
      h('img', { src: `/app/qr.svg?${info.code}`, alt: `QR code for class ${info.code}`, width: 260, height: 260 }),
      h('div', null, h('h2', null, info.code), h('p', null, 'Students scan this or open the link. Each device is its own student. Their work lands here.'),
        h('button', { type: 'button', onClick: () => navigator.clipboard ? navigator.clipboard.writeText(info.link).then(() => say('Link copied'), () => say(info.link)) : say(info.link) }, 'Copy the link'), h('button', { type: 'button', onClick: () => setOpen(false) }, 'Close'))))
}

function App() {
  const [info, setInfo] = useState(null)
  const [role, setRoleRaw] = useState(keep.get('role', 'student'))
  const [toast, setToast] = useState('')
  const setRole = r => { keep.set('role', r); setRoleRaw(r) }
  const say = useCallback(t => { setToast(t); clearTimeout(window.__t); window.__t = setTimeout(() => setToast(''), 3800) }, [])
  const load = useCallback(() => call('/api/space').then(i => { setInfo(i); if (i.joined) setRoleRaw('student') }).catch(() => say('Can’t reach Study OS. Trying again.')), [])
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const code = q.get('class')
    const as = q.get('as')
    if (as === 'teacher' || as === 'student') { setRole(as); history.replaceState(null, '', '/app') }
    const first = async () => {
      if (code) {
        try { await call(`/api/space/join/${encodeURIComponent(code)}`, { method: 'POST' }); keep.set('view', { name: 'class' }); keep.set('role', 'student') } catch (e) { say(said(e)) }
        history.replaceState(null, '', '/app')
      }
      await load()
    }
    first()
    const t = setInterval(load, 15000)
    const turn = e => setRole(e.detail)
    window.addEventListener('so-role', turn)
    return () => { clearInterval(t); window.removeEventListener('so-role', turn) }
  }, [])
  if (!info) return h('div', { className: 'wb-wait' }, 'Study ', h('b', null, 'os'))
  return h('div', { className: 'wb-all' }, h(Bar, { info, role, setRole, load, say }), h('main', { key: `${role}${info.joined}${info.code}` }, route(role === 'teacher' && !info.joined).render()), toast && h('div', { className: 'wb-toast', role: 'status' }, toast))
}
createRoot(document.getElementById('root')).render(h(QueryClientProvider, { client }, h(App)))
