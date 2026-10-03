/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, test } from 'vitest'
import checkedComponents from '../../tsconfig.components.json' with { type: 'json' }

const eslint = new ESLint({ cwd: fileURLToPath(new URL('../../', import.meta.url)) })
const ruleId = 'vue/no-restricted-syntax'

async function check(binding, filePath = 'src/components/common/Input.vue') {
  const [result] = await eslint.lintText(`<template><button ${binding}>Test</button></template>`, { filePath })
  expect(result.fatalErrorCount).toBe(0)
  return result.messages.filter(message => message.ruleId === ruleId)
}

describe('strict component event lint scope', () => {
  test.each(checkedComponents.include)('protects the enrolled path %s', async file => {
    const messages = await check('@click="() => {}"', file)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ severity: 2, message: expect.stringContaining('vue-tsc misses v-on payload errors') })
  })

  test.each([
    'v-on:click="() => {}"',
    'v-on="{ click: () => {} }"',
    '@click.stop="() => {}"',
    '@[\'click\']="() => {}"',
    '@update:model-value="() => {}"',
  ])('rejects unsupported checked-scope binding %s without autofix', async binding => {
    const messages = await check(binding)
    expect(messages).toHaveLength(1)
    expect(messages[0].fix).toBeUndefined()
  })

  test('allows checked listener props', async () => {
    expect(await check(':onClick="() => {}"')).toEqual([])
  })

  test.each([':on-click', ':on-update:model-value'])('requires runtime camelization for %s', async binding => {
    const messages = await check(`${binding}="() => {}"`)
    expect(messages).toHaveLength(1)
    expect(messages[0].message).toContain('require .camel for runtime delivery')
    expect(await check(`${binding}.camel="() => {}"`)).toEqual([])
  })

  test('does not impose the new restriction on unreviewed screens', async () => {
    expect(await check('@click="() => {}"', 'src/views/settings/AI.vue')).toEqual([])
  })
})
