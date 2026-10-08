/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createServer, normalizePath } from 'vite'

let directory, server, origin
const marker = 'synthetic-file-boundary-marker'

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'classifarr-vite-boundary-'))
  const root = join(directory, 'allowed')
  await mkdir(root)
  await writeFile(join(root, '.env'), `SYNTHETIC_ONLY=${marker}`)
  await writeFile(join(root, 'allowed.js'), 'export const fixture = true')
  await writeFile(join(directory, 'outside.json'), JSON.stringify({ marker }))
  server = await createServer({
    configFile: false, envDir: false, root, publicDir: false, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, ws: false, fs: { strict: true, allow: [root] } },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  await server.listen()
  origin = `http://127.0.0.1:${server.httpServer.address().port}`
})

afterAll(async () => {
  try { await server?.close() }
  finally {
    if (directory) {
      // Remove only this generated synthetic fixture, even when an assertion fails.
      expect(dirname(directory)).toBe(resolve(tmpdir()))
      expect(basename(directory)).toMatch(/^classifarr-vite-boundary-/)
      await rm(directory, { recursive: true, force: true })
    }
  }
})

test('ordinary allowed module remains loadable', async () => {
  const response = await fetch(`${origin}/allowed.js`, { signal: AbortSignal.timeout(2000) })
  expect(response.status).toBe(200)
  expect(await response.text()).toContain('fixture = true')
})

test.each(['?raw', '?import&vite-wasm-instance'])('outside file stays denied with %s', async query => {
  const path = normalizePath(join(directory, 'outside.json'))
  const response = await fetch(`${origin}/@fs/${path}${query}`, { signal: AbortSignal.timeout(2000) })
  expect(response.status).toBe(403)
  expect(await response.text()).not.toContain(marker)
})

test.each(['?raw', '?vite-wasm-instance'])('synthetic dotenv stays denied with %s', async query => {
  const response = await fetch(`${origin}/.env${query}`, { signal: AbortSignal.timeout(2000) })
  expect(response.status).toBe(403)
  expect(await response.text()).not.toContain(marker)
})
