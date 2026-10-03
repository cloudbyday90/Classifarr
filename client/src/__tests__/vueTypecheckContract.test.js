/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const clientRoot = fileURLToPath(new URL('../../', import.meta.url))
const scratchRoot = resolve(clientRoot, '.tmp')
const compilerPath = resolve(clientRoot, 'node_modules/vue-tsc/bin/vue-tsc.js')
const childComponent = `<script setup>
defineProps({ count: { type: Number, required: true } })
</script>
<template><span>{{ count.toFixed(0) }}</span></template>
`

// Use the real workspace options and dependency resolution. A startup failure or
// silently disabled checking must not satisfy a negative diagnostic assertion.
function typecheck(source) {
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
    // directory is created by mkdtemp inside the fixed scratchRoot, never supplied
    // by configuration, fixture source or a compiler response.
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('installed Vue typechecker contract', () => {
  test('checks real shared components and workspace aliases', () => {
    const result = typecheck(`<script setup>
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import Spinner from '@/components/common/Spinner.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import Slider from '@/components/common/Slider.vue'
/** @param {string} value */
function acceptText(value) { return value.toUpperCase() }
/** @param {boolean} value */
function acceptBoolean(value) { return value.valueOf() }
/** @param {number} value */
function acceptNumber(value) { return value.toFixed(0) }
</script>
<template>
  <Card title="Status"><Badge variant="success">Ready</Badge></Card>
  <Button type="button" :loading="false">Refresh</Button>
  <Spinner size="sm" text="Loading" />
  <Input label="Name" @update:model-value="acceptText" />
  <Select :options="[{ value: 1, label: 'One' }]" @update:model-value="acceptText" />
  <Toggle :model-value="true" @update:model-value="acceptBoolean" />
  <Slider :model-value="50" @update:model-value="acceptNumber" />
</template>
`)
    expect(result.output).toBe('')
    expect(result.status).toBe(0)
  }, 35_000)

  test('accepts valid JavaScript SFC imports, refs, templates and props', () => {
    const result = typecheck(`<script setup>
import { ref } from 'vue'
import CounterValue from './CounterValue.vue'
const count = ref(3)
</script>
<template><CounterValue :count="count" /><span>{{ count.toFixed(0) }}</span></template>
`)
    expect(result.output).toBe('')
    expect(result.status).toBe(0)
  }, 35_000)

  test.each([
    {
      name: 'input public emit payload in a typed consumer', code: '2345',
      source: `<script setup lang="ts">
import Input from '@/components/common/Input.vue'
function emitWrongType(control: InstanceType<typeof Input>) { control.$emit('update:modelValue', 42) }
</script>
<template><Input /></template>
`,
    },
    {
      name: 'select option shape', code: '2322',
      source: `<script setup>
import Select from '@/components/common/Select.vue'
</script>
<template><Select :options="[{ value: 1, label: 2 }]" /></template>
`,
    },
    {
      name: 'toggle boolean model', code: '2322',
      source: `<script setup>
import Toggle from '@/components/common/Toggle.vue'
</script>
<template><Toggle model-value="true" /></template>
`,
    },
    {
      name: 'slider numeric model', code: '2322',
      source: `<script setup>
import Slider from '@/components/common/Slider.vue'
</script>
<template><Slider model-value="50" /></template>
`,
    },
    {
      name: 'real shared component prop', code: '2322',
      source: `<script setup>
import Badge from '@/components/common/Badge.vue'
</script>
<template><Badge :variant="42">Status</Badge></template>
`,
    },
    {
      name: 'implicitly untyped script parameter', code: '7006',
      source: `<script setup>
function double(value) { return value * 2 }
</script>
<template><span>{{ double(3) }}</span></template>
`,
    },
    {
      name: 'JSDoc script assignment', code: '2322',
      source: `<script setup>
/** @type {number} */
const count = 'not a number'
</script>
<template><span>{{ count }}</span></template>
`,
    },
    {
      name: 'template expression', code: '2339',
      source: `<script setup>
import { ref } from 'vue'
const count = ref(3)
</script>
<template><span>{{ count.toUpperCase() }}</span></template>
`,
    },
    {
      name: 'cross-component prop', code: '2322',
      source: `<script setup>
import CounterValue from './CounterValue.vue'
</script>
<template><CounterValue count="not a number" /></template>
`,
    },
  ])('rejects an invalid $name with a source-mapped diagnostic', ({ source, code }) => {
    const result = typecheck(source)
    expect(result.status).toBe(2)
    expect(result.output).toMatch(new RegExp(`ContractFixture\\.vue\\(\\d+,\\d+\\): error TS${code}:`))
    const diagnostics = result.output.match(/: error TS\d+:/g)
    expect(diagnostics).toHaveLength(1)
  }, 35_000)
})
