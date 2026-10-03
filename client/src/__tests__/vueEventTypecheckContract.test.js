/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { expectVueDiagnostic, typecheck } from './helpers/vueTypecheck.js'

const controls = [
  { name: 'Input', props: '', valid: 'toUpperCase()', invalid: 'toFixed(0)', code: '2551', wrongType: 'number' },
  { name: 'PasswordInput', props: '', valid: 'toUpperCase()', invalid: 'toFixed(0)', code: '2551', wrongType: 'number' },
  { name: 'Select', props: ':options="[]"', valid: 'toUpperCase()', invalid: 'toFixed(0)', code: '2551', wrongType: 'number' },
  { name: 'Toggle', props: '', valid: 'valueOf()', invalid: 'toUpperCase()', code: '2339', wrongType: 'string' },
  { name: 'Slider', props: '', valid: 'toFixed(0)', invalid: 'toUpperCase()', code: '2339', wrongType: 'string' },
]

describe('checked JavaScript listener bindings', () => {
  test('infers inline model payloads and native events without parameter annotations', () => {
    const source = `<script setup>
${controls.map(({ name }) => `import ${name} from '@/components/common/${name}.vue'`).join('\n')}
import Button from '@/components/common/Button.vue'
</script>
<template>
${controls.map(({ name, props, valid }) => `<${name} ${props} :on-update:model-value.camel="value => value.${valid}" />`).join('\n')}
<Button :on-click.camel="event => event.preventDefault()">Save</Button>
<button :onClick="event => event.preventDefault()">Native</button>
<input :onInput="event => event.preventDefault()" />
</template>`
    expect(typecheck(source)).toEqual({ status: 0, output: '' })
  }, 35_000)

  test.each(controls)('rejects the wrong $name method-handler payload', ({ name, props, wrongType }) => {
    expectVueDiagnostic(typecheck(`<script setup>
import ${name} from '@/components/common/${name}.vue'
/** @param {${wrongType}} value */
function handle(value) { return value }
</script>
<template><${name} ${props} :on-update:model-value.camel="handle" /></template>`), '2322')
  }, 35_000)

  test.each(controls)('rejects a wrong operation on the inferred $name inline payload', ({ name, props, invalid, code }) => {
    expectVueDiagnostic(typecheck(`<script setup>
import ${name} from '@/components/common/${name}.vue'
</script>
<template><${name} ${props} :on-update:model-value.camel="value => value.${invalid}" /></template>`), code)
  }, 35_000)

  test('rejects a numeric callback for the shared Button mouse event', () => {
    expectVueDiagnostic(typecheck(`<script setup>
import Button from '@/components/common/Button.vue'
/** @param {number} value */
function handle(value) { return value }
</script>
<template><Button :on-click.camel="handle">Save</Button></template>`), '2322')
  }, 35_000)

  test('rejects a string callback for a native input event', () => {
    expectVueDiagnostic(typecheck(`<script setup>
/** @param {string} value */
function handle(value) { return value }
</script>
<template><input :onInput="handle" /></template>`), '2322')
  }, 35_000)

  test('rejects kebab-case listener keys on native DOM elements', () => {
    expectVueDiagnostic(typecheck(`<template><input :on-input="() => {}" /></template>`), '2353')
  }, 35_000)
})
