/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { mergeConfig } from 'vite'
import { Linter } from 'eslint'
import vue from 'eslint-plugin-vue'

describe('frontend tooling patch regressions', () => {
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
