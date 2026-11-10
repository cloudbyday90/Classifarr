/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout, clearTimeout } from 'node:timers'
/** Owned asynchronous fixtures only: standard parsing/load events, never a global shim. */
export function waitForJsdomReadiness(window, event = 'DOMContentLoaded') {
  const ready = () => event === 'load'
    ? window.document.readyState === 'complete' : window.document.readyState !== 'loading'
  if (ready()) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const target = event === 'load' ? window : window.document
    const cleanup = () => { clearTimeout(timer); target.removeEventListener(event, complete) }
    const complete = () => { cleanup(); resolve() }
    const timer = setTimeout(() => { cleanup(); reject(new Error('jsdom_fixture_readiness_deadline')) }, 2000)
    target.addEventListener(event, complete, { once: true })
    if (ready()) complete()
  })
}
