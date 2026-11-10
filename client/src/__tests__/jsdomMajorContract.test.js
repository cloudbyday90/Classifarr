/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { afterEach, expect, test } from 'vitest'
import { createServer } from 'node:http'
import { JSDOM, VirtualConsole } from 'jsdom'
import { waitForJsdomReadiness } from './fixtures/jsdomReadiness.mjs'

const windows = [], servers = [], sockets = new Set()
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const bounded = promise => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('jsdom_fixture_transport_deadline')), 2000)
  promise.then(value => { clearTimeout(timer); resolve(value) }, error => { clearTimeout(timer); reject(error) })
})
function documentFor(html, options = {}) {
  const dom = new JSDOM(html, { virtualConsole: new VirtualConsole(), ...options })
  windows.push(dom.window)
  return dom.window
}
async function listen(handler) {
  const server = createServer(handler); servers.push(server)
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}`
}
afterEach(async () => {
  for (const window of windows.splice(0)) window.close()
  for (const socket of sockets) socket.destroy()
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
})

test('cascade layers preserve declared priority and ordinary selectors', () => {
  const window = documentFor('<style>@layer first, second; @layer first { button { color: red } } @layer second { button { color: blue } }</style><button id="save">Save</button>')
  expect(window.document.querySelectorAll('button:not(:disabled)')).toHaveLength(1)
  expect(window.getComputedStyle(window.document.getElementById('save')).color).toBe('rgb(0, 0, 255)')
})

test('custom properties substitute inherited values instead of returning unresolved var text', () => {
  const window = documentFor('<style>section { --tone: rgb(0, 0, 255) } button { color: var(--tone) }</style><section><button>Save</button></section>')
  expect(window.getComputedStyle(window.document.querySelector('button')).color).toBe('rgb(0, 0, 255)')
})

test('a retained computed declaration stays live after a DOM style change', () => {
  const window = documentFor('<button style="color: red">Save</button>')
  const button = window.document.querySelector('button'), computed = window.getComputedStyle(button)
  expect(computed.color).toBe('rgb(255, 0, 0)')
  button.style.color = 'blue'
  expect(computed.color).toBe('rgb(0, 0, 255)')
})

test('focus leaves a newly hidden control asynchronously without losing document focus', async () => {
  const window = documentFor('<div><button>Save</button></div>', { pretendToBeVisual: true })
  const button = window.document.querySelector('button')
  expect(window.document.hasFocus()).toBe(true)
  button.focus(); expect(window.document.activeElement).toBe(button)
  button.parentElement.style.display = 'none'
  await bounded(new Promise(resolve => window.requestAnimationFrame(resolve)))
  expect(window.document.activeElement).toBe(window.document.body)
  expect(window.document.hasFocus()).toBe(true)
})

test('blocking loopback scripts pause parsing and standard readiness exposes the complete tree once', async () => {
  const requested = deferred(); let held
  const origin = await listen((_request, reply) => { held = reply; requested.resolve() })
  const window = documentFor('<script src="/pause.js"></script><p id="after">Complete</p>', {
    url: origin, resources: {}, runScripts: 'dangerously',
  })
  const events = []
  window.document.addEventListener('DOMContentLoaded', () => events.push('parsed'))
  window.document.addEventListener('load', () => events.push('document-load'))
  window.addEventListener('load', () => events.push('window-load'))
  try {
    await bounded(requested.promise)
    expect(window.document.readyState).toBe('loading')
    expect(window.document.getElementById('after')).toBeNull()
    held.writeHead(200, { 'Content-Type': 'text/javascript' }).end('globalThis.fixtureScriptRan = true')
    await waitForJsdomReadiness(window)
    expect(window.document.getElementById('after').textContent).toBe('Complete')
    expect(window.fixtureScriptRan).toBe(true)
    await waitForJsdomReadiness(window, 'load')
    expect(events).toEqual(['parsed', 'window-load'])
    await waitForJsdomReadiness(window, 'load')
    expect(events).toEqual(['parsed', 'window-load'])
  } finally { held?.end() }
})

test('window.stop cancels a descendant XHR and permits a later request', async () => {
  const requested = deferred(), closed = deferred()
  const origin = await listen((request, reply) => {
    if (request.url === '/frame') reply.writeHead(200, { 'Content-Type': 'text/html' }).end('<p>Frame</p>')
    else if (request.url === '/hold') { reply.once('close', closed.resolve); requested.resolve() }
    else reply.end('usable')
  })
  const window = documentFor('<iframe src="/frame"></iframe>', { url: origin, resources: {} })
  await waitForJsdomReadiness(window, 'load')
  const frame = window.document.querySelector('iframe').contentWindow
  const request = new frame.XMLHttpRequest(), completions = []
  request.open('GET', '/hold'); request.onload = () => completions.push('load'); request.send()
  await bounded(requested.promise); window.stop(); await bounded(closed.promise)
  expect(request.status).toBe(0); expect(completions).toEqual([])
  const usable = new frame.XMLHttpRequest()
  const completed = new Promise((resolve, reject) => { usable.onload = resolve; usable.onerror = reject })
  usable.open('GET', '/okay'); usable.send(); await bounded(completed)
  expect(usable.status).toBe(200); expect(usable.responseText).toBe('usable')
})
