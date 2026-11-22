/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { join, relative, resolve } from 'node:path'

const scratchRoot = resolve(import.meta.dirname, '../.tmp')
const fixtureNamePrefix = 'vue-typecheck-'

export const vueCompilerFixturePrefix = join(scratchRoot, fixtureNamePrefix)

export function isVueCompilerFixturePath(path) {
  return relative(scratchRoot, path).startsWith(fixtureNamePrefix)
}
