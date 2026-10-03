/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'

const clientRoot = fileURLToPath(new URL('../../../', import.meta.url))
const scratchRoot = resolve(clientRoot, '.tmp')
const compilerPath = resolve(clientRoot, 'node_modules/vue-tsc/bin/vue-tsc.js')
const childComponent = `<script setup>
defineProps({ count: { type: Number, required: true } })
</script>
<template><span>{{ count.toFixed(0) }}</span></template>
`

// Check actual workspace options with the installed CLI, never a shell or npx.
export function typecheck(source) {
  mkdirSync(scratchRoot, { recursive: true })
  const directory = mkdtempSync(resolve(scratchRoot, 'vue-typecheck-'))
  try {
    writeFileSync(resolve(directory, 'tsconfig.json'), JSON.stringify({
      extends: resolve(clientRoot, 'tsconfig.components.json'),
      include: ['./*.vue'],
      exclude: [],
    }))
    writeFileSync(resolve(directory, 'CounterValue.vue'), childComponent)
    writeFileSync(resolve(directory, 'ContractFixture.vue'), source)
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE)$/i.test(key)))
    const result = spawnSync(process.execPath, [
      '--max-old-space-size=384', compilerPath, '--project', resolve(directory, 'tsconfig.json'),
      '--noEmit', '--pretty', 'false',
    ], {
      cwd: clientRoot, env, shell: false, windowsHide: true, encoding: 'utf8',
      timeout: 30_000, maxBuffer: 1024 * 1024,
    })
    expect(result.error).toBeUndefined()
    expect(result.signal).toBeNull()
    expect(result.stderr).toBe('')
    return { status: result.status, output: result.stdout }
  } finally {
    // Only remove the mkdtemp-owned child of the fixed scratchRoot, never a
    // directory supplied by fixture source, configuration or compiler output.
    rmSync(directory, { recursive: true, force: true })
  }
}

export function expectVueDiagnostic(result, code) {
  // Startup failures and unrelated diagnostics cannot satisfy a negative test.
  expect(result.status).toBe(2)
  expect(result.output).toMatch(new RegExp(`ContractFixture\\.vue\\(\\d+,\\d+\\): error TS${code}:`))
  expect(result.output.match(/: error TS\d+:/g)).toHaveLength(1)
}
