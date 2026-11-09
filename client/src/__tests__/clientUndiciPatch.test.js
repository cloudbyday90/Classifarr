/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, test } from 'vitest'
const require = createRequire(import.meta.url)
const consumer = createRequire(require.resolve('jsdom'))
const target = pathToFileURL(consumer.resolve('undici'))
const run = promisify(execFile)
const probe = fileURLToPath(new URL('../../../server/src/__tests__/fixtures/runtimePatchUndiciProbe.mjs', import.meta.url))
const execute = (file, args) => run(process.execPath, [file, ...args], {
  timeout: 10000, maxBuffer: 32768, windowsHide: true,
  env: { SystemRoot: process.env.SystemRoot, NODE_ENV: 'test' },
})

describe('the JSDOM-owned Undici patch', () => {
  test('is the compatible exact client copy beneath retained JSDOM', () => {
    expect(JSON.parse(readFileSync(new URL('./package.json', target), 'utf8')).version).toBe('8.12.4')
    expect(require('jsdom/package.json').version).toBe('30.1.3')
    expect(consumer.resolve('undici')).toBe(require.resolve('undici'))
  })
  test.each(['integrity', 'headers', 'hops', 'credentials', 'revalidation', 'replay'])(
    'preserves actual %s security and ordinary controls', async mode => {
      const { stdout, stderr } = await execute(probe, [mode, target.href])
      expect(JSON.parse(stdout)).toEqual({ mode, passed: true })
      expect(stderr).toBe('')
    }, 12000)
  test.each(['node-first', 'jsdom-first'])('keeps real JSDOM transport boundaries with %s initialization', async mode => {
    const file = fileURLToPath(new URL('./fixtures/jsdomUndiciProbe.mjs', import.meta.url))
    const { stdout, stderr } = await execute(file, [mode])
    expect(JSON.parse(stdout)).toEqual({ mode, passed: true })
    expect(stderr).toBe('')
  }, 12000)
})
