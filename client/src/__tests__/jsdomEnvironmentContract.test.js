/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { afterEach, expect, it } from 'vitest'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { JSDOM } from 'jsdom'

const windows = []
function documentFor(html) {
  const { window } = new JSDOM(html)
  windows.push(window)
  return window
}

afterEach(() => {
  for (const window of windows.splice(0)) window.close()
})

it('does not focus a control hidden by an ancestor display rule', () => {
  const { document } = documentFor('<button id="visible">Open</button><div style="display:none"><button id="hidden">Hidden</button></div>')
  document.getElementById('visible').focus()
  document.getElementById('hidden').focus()
  expect(document.activeElement.id).toBe('visible')
})

it('keeps a retained selectedOptions collection live through selection and reset', () => {
  const { document } = documentFor('<form><select><option selected>A</option><option>B</option></select></form>')
  const select = document.querySelector('select')
  const selected = select.selectedOptions
  select.options[1].selected = true
  expect([...selected].map(option => option.text)).toEqual(['B'])
  document.querySelector('form').reset()
  expect([...selected].map(option => option.text)).toEqual(['A'])
})

it('invalidates computed style after an existing stylesheet rule changes', () => {
  const window = documentFor('<style>button { color: rgb(255, 0, 0) }</style><button>Save</button>')
  const button = window.document.querySelector('button')
  expect(window.getComputedStyle(button).color).toBe('rgb(255, 0, 0)')
  window.document.styleSheets[0].cssRules[0].style.setProperty('color', 'rgb(0, 0, 255)')
  expect(window.getComputedStyle(button).color).toBe('rgb(0, 0, 255)')
})

it('invalidates computed styles after a checked property changes', () => {
  const window = documentFor('<style>input { color: rgb(255, 0, 0) } input:checked { color: rgb(0, 0, 255) }</style><input type="checkbox">')
  const input = window.document.querySelector('input')
  expect(window.getComputedStyle(input).color).toBe('rgb(255, 0, 0)')
  input.checked = true
  expect(window.getComputedStyle(input).color).toBe('rgb(0, 0, 255)')
})

it('loads and rejects real loopback HTTP responses after built-in fetch has run', { timeout: 5000 }, async () => {
  const requests = []
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`)
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/document' }).end()
    } else if (req.url === '/document') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        .end('<title>Local contract</title><script>globalThis.contractScriptRan = true</script>')
    } else res.writeHead(404).end('Not found')
  })
  server.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const origin = `http://127.0.0.1:${server.address().port}`
    const response = await globalThis.fetch(`${origin}/document`, { signal: AbortSignal.timeout(2000) })
    expect(await response.text()).toContain('Local contract')
    const dom = await JSDOM.fromURL(`${origin}/redirect`)
    windows.push(dom.window)
    expect(dom.window.document.title).toBe('Local contract')
    expect(dom.window.location.href).toBe(`${origin}/document`)
    expect(dom.window.contractScriptRan).toBeUndefined()
    await expect(JSDOM.fromURL(`${origin}/missing`)).rejects.toThrow('404')
    expect(requests).toEqual(['GET /document', 'GET /redirect', 'GET /document', 'GET /missing'])
  } finally {
    server.closeAllConnections()
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
