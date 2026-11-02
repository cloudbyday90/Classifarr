/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { expectVueDiagnostic, typecheck } from './helpers/vueTypecheck.js'

const literals = ['https://example.invalid/library', 'example.invalid/library']
const modelCompanion = `<script setup lang="ts">
defineProps<{ hint?: string }>()
const text = defineModel<string>({ required: true })
</script>
<template><input v-model="text" :placeholder="hint" /></template>`
const eventCompanion = `<script setup lang="ts">
defineProps<{ url?: string }>()
defineEmits<{ finished: [count: number] }>()
</script>
<template><div><slot /></div></template>`
const slotCompanion = `<script setup lang="ts">
defineSlots<{ toolbar(props: { label: string }): unknown; secondary(): unknown }>()
</script>
<template><slot name="toolbar" label="sample" /><slot name="secondary" /></template>`
const slotSource = (parameter, read) => `<script setup lang="ts">
import SlotValue from './SlotValue.vue'
import { FixtureKeys } from './FixtureKeys'
</script>
<template><SlotValue>
  <template #toolbar="${parameter}">{{ ${parameter.startsWith('{') ? 'label' : 'slotState'} }}</template>
  <template #secondary>{{ ${read} }}</template>
</SlotValue></template>`
const slotFiles = { 'SlotValue.vue': slotCompanion,
  'FixtureKeys.ts': "export const FixtureKeys = { TOOLBAR: 'toolbar' }" }

describe('compiler semantic regression controls', () => {
  test.each(literals)('preserves a reactive model with literal %s', hint => {
    expect(typecheck(`<script setup lang="ts">
import { reactive } from 'vue'
import ModelValue from './ModelValue.vue'
const state = reactive({ search: '' })
</script>
<template><ModelValue v-model="state.search" hint="${hint}" /></template>`,
    { 'ModelValue.vue': modelCompanion })).toEqual({ status: 0, output: '' })
  }, 35_000)

  test.each(literals)('preserves contextual event inference with literal %s', url => {
    expect(typecheck(`<script setup lang="ts">
import EventValue from './EventValue.vue'
</script>
<template><EventValue url="${url}" @finished="count => count.toFixed(1)" /></template>`,
    { 'EventValue.vue': eventCompanion })).toEqual({ status: 0, output: '' })
  }, 35_000)

  test.each(literals)('still rejects an invalid inferred event operation with literal %s', url => {
    expectVueDiagnostic(typecheck(`<script setup lang="ts">
import EventValue from './EventValue.vue'
</script>
<template><EventValue url="${url}" @finished="count => count.toUpperCase()" /></template>`,
    { 'EventValue.vue': eventCompanion }), '2339')
  }, 35_000)

  const slots = [
    ['whole parameter default and imported property', 'slotState = {}', 'FixtureKeys.TOOLBAR'],
    ['inner destructuring default', '{ label = FixtureKeys.TOOLBAR }', 'FixtureKeys.TOOLBAR'],
    ['whole parameter default without property read', 'slotState = {}', 'FixtureKeys'],
  ]
  test.each(slots)('accepts valid slots: %s', (_name, parameter, read) => {
    expect(typecheck(slotSource(parameter, read), slotFiles)).toEqual({ status: 0, output: '' })
  }, 35_000)

  test.each(slots)('retains unrelated semantic checking with slots: %s', (_name, parameter, read) => {
    const result = typecheck(slotSource(parameter, read), { ...slotFiles,
      'SemanticSentinel.ts': "export const attempts: number = 'synthetic mismatch'" })
    expect(result.status).toBe(2)
    expect(result.output).toMatch(/SemanticSentinel\.ts\(1,14\): error TS2322:/)
    expect(result.output.match(/: error TS\d+:/g)).toHaveLength(1)
  }, 35_000)
})
