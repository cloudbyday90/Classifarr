/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { expect, test, vi } from 'vitest'
import { createServer, normalizePath } from 'vite'

const clientRoot = resolve(import.meta.dirname, '../..')
const scratchRoot = join(clientRoot, '.tmp')

test('Vite skips compiler fixtures and still reloads for other TypeScript configs', async () => {
  await mkdir(scratchRoot, { recursive: true })
  const generated = await mkdtemp(join(scratchRoot, 'vue-typecheck-'))
  let control, server
  try {
    control = await mkdtemp(join(tmpdir(), 'classifarr-vite-watcher-control-'))
    const watched = join(control, basename(generated))
    await mkdir(watched)
    const generatedConfig = join(generated, 'tsconfig.json')
    const watchedConfig = join(watched, 'tsconfig.json')
    const events = []

    server = await createServer({
      root: clientRoot,
      configFile: join(clientRoot, 'vite.config.js'),
      envDir: false,
      logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0 },
      optimizeDeps: { noDiscovery: true, include: [] },
    })
    // An external control belongs only to this watcher and cannot reload another test's server.
    server.watcher.add(watched)
    const send = vi.spyOn(server.environments.client.hot, 'send')
    server.watcher.on('all', (kind, path) => events.push([kind, normalizePath(path)]))
    await server.listen()

    const watchedDirectories = () => Object.keys(server.watcher.getWatched()).map(normalizePath)
    await vi.waitFor(() => {
      expect(watchedDirectories()).toEqual(expect.arrayContaining([normalizePath(scratchRoot), normalizePath(watched)]))
    }, { timeout: 2000 })

    await writeFile(generatedConfig, '{}')
    await writeFile(generatedConfig, '{"include":[]}')
    await writeFile(watchedConfig, '{}')

    await vi.waitFor(() => {
      expect(events).toContainEqual(['add', normalizePath(watchedConfig)])
      expect(send).toHaveBeenCalledWith({ type: 'full-reload', path: '*' })
    }, { timeout: 2000 })
    expect(watchedDirectories()).not.toContain(normalizePath(generated))
    await unlink(generatedConfig)
    expect(events.some(([, path]) => path === normalizePath(generatedConfig))).toBe(false)
  } finally {
    try { await server?.close() }
    finally {
      // Remove only this test's two owned mkdtemp directories.
      await Promise.all([
        rm(generated, { recursive: true, force: true }),
        control && rm(control, { recursive: true, force: true }),
      ])
    }
  }
})
