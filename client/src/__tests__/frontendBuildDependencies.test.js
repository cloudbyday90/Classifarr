/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import postcss from 'postcss'
import { init, parse } from 'es-module-lexer'

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const manifest = readJson('../../package.json')
const lock = readJson('../../package-lock.json')

test.each([
  ['@rolldown/pluginutils', '@vitejs/plugin-vue', '1.0.1'],
  ['es-module-lexer', 'vitest', '2.3.2'],
])('reviewed %s override satisfies the installed %s parent contract', (name, parent, version) => {
  // Explicit reviewed boundaries, not a home-grown general semver evaluator.
  // A parent requirement change intentionally asks for another compatibility review.
  const parentManifest = readJson(`../../node_modules/${parent}/package.json`)
  expect(parentManifest.dependencies[name]).toBe(`^${version}`)
  expect(manifest.overrides[name]).toBe(version)
  expect(lock.packages[`node_modules/${name}`].version).toBe(version)
  expect(readJson(`../../node_modules/${name}/package.json`).version).toBe(version)
})

test('lexer preserves the v2 static/dynamic import and export records used by Vitest', async () => {
  await init
  const [imports, exports] = parse('import x from "./entry.js"; export { x }; const lazy = import("./lazy.js")')
  expect(imports.map(({ n, d }) => [n, d === -1 ? 'static' : 'dynamic']))
    .toEqual([['./entry.js', 'static'], ['./lazy.js', 'dynamic']])
  expect(exports.map(({ n, ln }) => [n, ln])).toEqual([['x', 'x']])
})

test('CSS list separators inside comments do not split values', () => {
  expect(postcss.list.comma('red/* comma, inside */, blue')).toEqual(['red/* comma, inside */', 'blue'])
  expect(postcss.list.space('red/* space inside */ blue')).toEqual(['red/* space inside */', 'blue'])
})

test('CSS custom properties retain semicolons within balanced blocks', () => {
  const css = '.fixture { --theme: { color: red; background: blue; }; color: var(--color); }'
  const root = postcss.parse(css)
  expect(root.first.nodes.map(({ prop, value }) => [prop, value])).toEqual([
    ['--theme', '{ color: red; background: blue; }'], ['color', 'var(--color)'],
  ])
  expect(root.toString()).toBe(css)
  expect(() => postcss.parse('.fixture { color: "unfinished }')).toThrow()
})
