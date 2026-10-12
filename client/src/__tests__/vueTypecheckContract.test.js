/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import compiler from 'typescript'
import { expectVueDiagnostic, typecheck } from './helpers/vueTypecheck.js'

describe('installed Vue typechecker contract', () => {
  test('uses the client compiler API, not the native root compiler', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    const compilerManifestUrl = import.meta.resolve('typescript/package.json')
    expect(fileURLToPath(compilerManifestUrl)).toBe(fileURLToPath(
      new URL('../../node_modules/typescript/package.json', import.meta.url),
    ))
    const installed = JSON.parse(readFileSync(new URL(compilerManifestUrl), 'utf8'))
    expect(installed.version).toBe(manifest.devDependencies.typescript)
    // vue-tsc consumes the legacy API/entrypoint; a broad peer range is not proof.
    expect(compiler.createProgram).toBeTypeOf('function')
    expect(compiler.parseJsonConfigFileContent).toBeTypeOf('function')
    expect(compiler.ScriptTarget.ESNext).toBeTypeOf('number')
    expect(readFileSync(new URL(import.meta.resolve('typescript/lib/tsc.js')), 'utf8').length).toBeGreaterThan(0)
  })

  test('checks setup macros without explicit Vue imports', () => {
    const result = typecheck(`<script setup>
const props = defineProps({ count: { type: Number, required: true } })
const emit = defineEmits({ change: (/** @type {number} */ value) => Number.isFinite(value) })
defineExpose({ reset: () => emit('change', 0) })
</script>
<template><button @click="emit('change', props.count + 1)">{{ props.count.toFixed(0) }}</button></template>
`)
    expect(result.output).toBe('')
    expect(result.status).toBe(0)
  }, 35_000)

  test('checks real shared components and workspace aliases', () => {
    const result = typecheck(`<script setup>
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import Spinner from '@/components/common/Spinner.vue'
import Input from '@/components/common/Input.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'
import TagInput from '@/components/common/TagInput.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import Slider from '@/components/common/Slider.vue'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'
import Toast from '@/components/common/Toast.vue'
import ArrConfigWarning from '@/components/settings/ArrConfigWarning.vue'
import PgvectorVariantBanner from '@/components/PgvectorVariantBanner.vue'
import { useToastStore } from '@/stores/toast'
const toast = useToastStore()
toast.success('Saved')
toast.warning('Check the host', 'Connection')
const id = toast.addToast({ type: 'info', message: 'Ready', duration: 0 })
toast.removeToast(id)
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
  <Input label="Name" :on-update:model-value.camel="acceptText" />
  <PasswordInput label="API key" hint="Provider credential" :on-update:model-value.camel="acceptText" />
  <TagInput label="Keywords" :model-value="['example']" :readonly="false" />
  <Select :options="[{ value: 1, label: 'One' }]" :on-update:model-value.camel="acceptText" />
  <Toggle :model-value="true" :on-update:model-value.camel="acceptBoolean" />
  <Slider :model-value="50" :on-update:model-value.camel="acceptNumber" />
  <ConnectionStatus status="success" details="Connected!" :last-checked="new Date()" />
  <ConnectionStatus status="success" :details="{ serverName: 'Example', version: '1', additionalInfo: { Libraries: 10 } }" />
  <ConnectionStatus status="warning" error="Check the host" />
  <ConnectionStatus status="error" :error="{ code: 'REFUSED', message: 'Unavailable', troubleshooting: ['Check the port'] }" />
  <ConnectionStatus :details="null" :error="null" />
  <Toast />
  <ArrConfigWarning :load-status="async () => ({ incompleteConfigs: [] })" />
  <PgvectorVariantBanner :load-status="async () => ({ enabled: true, pgvectorVariant: 'generic' })" />
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
      name: 'pgvector banner required loader', code: '2345',
      source: `<script setup>
import PgvectorVariantBanner from '@/components/PgvectorVariantBanner.vue'
</script><template><PgvectorVariantBanner /></template>
`,
    },
    {
      name: 'pgvector banner async loader', code: '2739',
      source: `<script setup>
import PgvectorVariantBanner from '@/components/PgvectorVariantBanner.vue'
</script><template><PgvectorVariantBanner :load-status="() => ({})" /></template>
`,
    },
    {
      name: 'Arr warning async loader', code: '2739',
      source: `<script setup>
import ArrConfigWarning from '@/components/settings/ArrConfigWarning.vue'
</script>
<template><ArrConfigWarning :load-status="() => ({ incompleteConfigs: [] })" /></template>
`,
    },
    {
      name: 'Arr warning required loader', code: '2345',
      source: `<script setup>
import ArrConfigWarning from '@/components/settings/ArrConfigWarning.vue'
</script>
<template><ArrConfigWarning /></template>
`,
    },
    {
      name: 'connection troubleshooting shape', code: '2322',
      source: `<script setup>
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'
</script>
<template><ConnectionStatus status="error" :error="{ troubleshooting: [42] }" /></template>
`,
    },
    {
      name: 'connection server name shape', code: '2322',
      source: `<script setup>
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'
</script>
<template><ConnectionStatus :details="{ serverName: 42 }" /></template>
`,
    },
    {
      name: 'connection timestamp', code: '2322',
      source: `<script setup>
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'
</script>
<template><ConnectionStatus last-checked="2026-10-12" /></template>
`,
    },
    {
      name: 'toast kind', code: '2322',
      source: `<script setup>
import { useToastStore } from '@/stores/toast'
useToastStore().addToast({ type: 'danger' })
</script><template><span>Toast</span></template>
`,
    },
    {
      name: 'toast removal ID', code: '2345',
      source: `<script setup>
import { useToastStore } from '@/stores/toast'
useToastStore().removeToast('1')
</script><template><span>Toast</span></template>
`,
    },
    {
      name: 'toast convenience message', code: '2345',
      source: `<script setup>
import { useToast } from '@/stores/toast'
useToast().error({ message: 'No raw error objects' })
</script><template><span>Toast</span></template>
`,
    },
    {
      name: 'setup macro prop without explicit Vue imports', code: '2339',
      source: `<script setup>
const props = defineProps({ count: { type: Number, required: true } })
</script>
<template><span>{{ props.count.toUpperCase() }}</span></template>
`,
    },
    {
      name: 'tab label shape', code: '2322',
      source: `<script setup>
import Tabs from '@/components/common/Tabs.vue'
</script>
<template><Tabs model-value="one" :tabs="[{ id: 'one', label: 2 }]" /></template>
`,
    },
    {
      name: 'tab string model', code: '2322',
      source: `<script setup>
import Tabs from '@/components/common/Tabs.vue'
</script>
<template><Tabs :model-value="42" :tabs="[]" /></template>
`,
    },
    {
      name: 'tag string-array model', code: '2322',
      source: `<script setup>
import TagInput from '@/components/common/TagInput.vue'
</script>
<template><TagInput :model-value="[42]" /></template>
`,
    },
    {
      name: 'password-manager hint expression', code: '2339',
      source: `<script setup>
const flag = true
</script>
<template><input :data-lpignore="flag.toUpperCase()" /></template>
`,
    },
    {
      name: 'unknown native attribute beside password-manager hints', code: '2561',
      source: `<template><input data-lpignore="true" data-1pass-no-save="true" spellchek="false" /></template>
`,
    },
    {
      name: 'password string model', code: '2322',
      source: `<script setup>
import PasswordInput from '@/components/common/PasswordInput.vue'
</script>
<template><PasswordInput :model-value="42" /></template>
`,
    },
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
      name: 'modal boolean model', code: '2322',
      source: `<script setup>
import Modal from '@/components/common/Modal.vue'
</script>
<template><Modal model-value="true" /></template>
`,
    },
    {
      name: 'modal fallback element resolver', code: '2322',
      source: `<script setup>
import Modal from '@/components/common/Modal.vue'
</script>
<template><Modal :model-value="false" :fallback-focus-target="() => '#search'" /></template>
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
    expectVueDiagnostic(typecheck(source), code)
  }, 35_000)
})
