/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it, vi } from 'vitest'
import { mergeConfig } from 'vite'
import { Linter } from 'eslint'
import vue from 'eslint-plugin-vue'
import postcss from 'postcss'

describe('frontend tooling patch regressions', () => {
  it('preserves the PostCSS result and Promise finally callback arguments', async () => {
    const callback = vi.fn(() => 'ignored cleanup value')
    const result = await postcss([]).process('a { color: red }', { from: undefined }).finally(callback)
    expect(result.css).toBe('a { color: red }')
    expect(callback).toHaveBeenCalledExactlyOnceWith()
  })

  it('preserves an actual PostCSS plugin failure through successful finally cleanup', async () => {
    const failure = new Error('synthetic CSS failure')
    const lazy = postcss([{ postcssPlugin: 'synthetic-failure', Once() { throw failure } }])
      .process('a { color: red }', { from: undefined })
    await expect(lazy.finally(() => 'ignored cleanup value')).rejects.toBe(failure)
  })

  it('reports a model/prop name collision while retaining a distinct model control', () => {
    const linter = new Linter()
    const inspect = props => linter.verify(`<script setup>const model = defineModel(); defineProps({ ${props}: String })</script>`, [
      ...vue.configs['flat/base'],
      { files: ['**/*.vue'], rules: { 'vue/no-dupe-keys': 'error' } },
    ], { filename: 'ModelCollisionFixture.vue' })
    expect(inspect('modelValue').map(message => message.ruleId)).toEqual(['vue/no-dupe-keys'])
    expect(inspect('title')).toEqual([])
  })

  it('preserves an explicit disabled WebSocket setting when merging server options', () => {
    const result = mergeConfig({ server: { ws: false } }, { server: { port: 5173 } })
    expect(result.server).toMatchObject({ ws: false, port: 5173 })
  })

  it('does not require a second default for defineModel with its own default', () => {
    const linter = new Linter()
    const messages = linter.verify('<script setup>const model = defineModel({ type: String, default: "" })</script>', [
      ...vue.configs['flat/base'],
      { files: ['**/*.vue'], rules: { 'vue/require-default-prop': 'error' } },
    ], { filename: 'ModelFixture.vue' })
    expect(messages).toEqual([])
  })

  it('continues to reject an optional prop without a default', () => {
    const linter = new Linter()
    const messages = linter.verify('<script setup>defineProps({ title: String })</script>', [
      ...vue.configs['flat/base'],
      { files: ['**/*.vue'], rules: { 'vue/require-default-prop': 'error' } },
    ], { filename: 'PropFixture.vue' })
    expect(messages.map(message => message.ruleId)).toEqual(['vue/require-default-prop'])
  })
})
