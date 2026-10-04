/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { expectVueDiagnostic, typecheck } from './helpers/vueTypecheck.js'

describe('installed Vue typechecker contract', () => {
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
