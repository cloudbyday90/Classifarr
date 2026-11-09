/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
const run = promisify(execFile)
describe('Vue patch runtime and compiler controls', () => {
  test.each(['dispose', 'booleans', 'catch', 'switch', 'async-unmount', 'directive', 'ssr'])(
    'real Vue preserves %s across the compiler/runtime boundary', async mode => {
      const { stdout, stderr } = await run(process.execPath, [
        fileURLToPath(new URL('./fixtures/vuePatchProbe.mjs', import.meta.url)), mode,
      ], { timeout: 6000, maxBuffer: 32768, windowsHide: true, env: { SystemRoot: process.env.SystemRoot } })
      expect(JSON.parse(stdout)).toEqual({ mode, passed: true })
      expect(stderr).toBe('')
    }, 8000)
})
