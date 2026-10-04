/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { beforeAll, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { ESLint } from 'eslint'

const linter = new ESLint({ cwd: resolve(import.meta.dirname, '../..') })
const vueFile = 'src/components/LintContractFixture.vue'
const lint = async (code, filePath = vueFile) => (await linter.lintText(code, { filePath }))[0].messages

beforeAll(async () => {
  // Plugin/config initialization belongs to suite setup, not the first case.
  await linter.calculateConfigForFile(vueFile)
})

it('keeps browser globals separate from Node tooling globals', async () => {
  expect(await lint('export const title = window.document.title', 'src/utils/lintContractFixture.js')).toEqual([])
  expect(await lint('export const value = process.env.NODE_ENV', 'src/utils/lintContractFixture.js'))
    .toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'no-undef', severity: 2 })]))
})

it('accepts a native button without requiring an ARIA role', async () => {
  expect(await lint('<template>\n  <button type="button">\n    Save\n  </button>\n</template>')).toEqual([])
})

it('continues to reject undefined Vue components', async () => {
  expect(await lint('<template>\n  <MissingWidget />\n</template>'))
    .toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'vue/no-undef-components', severity: 2 })]))
})

it('keeps focused tests prohibited', async () => {
  expect(await lint("test.only('synthetic', () => {})", 'src/__tests__/lintContractFixture.test.js'))
    .toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'no-restricted-syntax', severity: 2 })]))
})
