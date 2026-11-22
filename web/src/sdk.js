// The little of Hermes' plugin SDK the page uses, for the browser.
import { createElement, useEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
export { useQuery, useQueryClient, QueryClient, QueryClientProvider }
export const PALETTE_AREA = 'palette', ROUTES_AREA = 'routes', SIDEBAR_NAV_AREA = 'nav'
export const haptic = () => {}
// Games and films are whole pages the model or the engine wrote. They run in a sandboxed frame with no origin, loaded
// through an empty page with its own rules: no network, nothing of this page in reach.
export function SandboxedFrame({ ref, title, src, style, className }) {
  const el = useRef(null)
  useEffect(() => {
    const on = e => { if (el.current && e.source === el.current.contentWindow && e.data && e.data.frame === 'ready') el.current.contentWindow.postMessage({ frameHtml: decodeURIComponent(src.slice(src.indexOf(',') + 1)) }, '*') }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [src])
  return createElement('iframe', { ref: x => { el.current = x; if (ref) ref.current = x }, title, src: '/app/static/frame.html', style, className, sandbox: 'allow-scripts', referrerPolicy: 'no-referrer' })
}
export const host = { notify: () => {}, navigate: () => window.open('https://github.com/pukujan-lab-2/study-os-hermes', '_blank', 'noopener'), onEvent: () => () => {} }
