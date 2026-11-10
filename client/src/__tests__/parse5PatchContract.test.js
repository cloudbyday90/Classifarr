/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url), run = promisify(execFile)
const consumer = createRequire(require.resolve('jsdom'))
const target = pathToFileURL(consumer.resolve('parse5')).href
const probe = fileURLToPath(new URL('./fixtures/parse5PatchProbe.mjs', import.meta.url))
describe('JSDOM-owned parser compatibility', () => {
  test.each(['surrogates', 'formatting', 'deep-serialize', 'template-eof'])(
    'preserves bounded real %s controls', async mode => {
      const { stdout, stderr } = await run(process.execPath, ['--max-old-space-size=128', probe, mode, target], {
        timeout: 10000, maxBuffer: 32768, windowsHide: true,
        env: { SystemRoot: process.env.SystemRoot, NODE_ENV: 'test' },
      })
      expect(JSON.parse(stdout)).toEqual({ mode, passed: true })
      expect(stderr).toBe('')
    }, 12000)
})
