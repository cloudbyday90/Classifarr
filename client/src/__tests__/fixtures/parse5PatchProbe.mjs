/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict'
import process from 'node:process'
import { URL } from 'node:url'
const [mode, target] = process.argv.slice(2)
assert.equal(new URL(target).protocol, 'file:')
const { parseFragment, serialize, defaultTreeAdapter } = await import(target)
const equalText = (actual, expected) => {
  assert.equal(actual.length, expected.length, 'serialized_length_differs')
  assert.ok(actual === expected, 'serialized_tree_differs')
}
if (mode === 'surrogates') {
  const name = 'a\uDC00\uDC00\uD83D\uDE00\uDFFF', errors = []
  const tree = parseFragment(`<${name}>`, { onParseError: error => errors.push(error.code) })
  assert.equal(tree.childNodes[0].tagName, name)
  assert.equal(errors.filter(code => code === 'surrogate-in-input-stream').length, 3)
  equalText(serialize(parseFragment('<p>plain 😀</p>')), '<p>plain 😀</p>')
} else if (mode === 'formatting') {
  for (const size of [3, 256]) {
    let reads = 0
    const adapter = { ...defaultTreeAdapter,
      getTagName(node) { reads++; return defaultTreeAdapter.getTagName(node) },
      getAttrList(node) { reads++; return defaultTreeAdapter.getAttrList(node) },
    }
    const opening = Array.from({ length: size }, (_, index) => `<b a=${index}>`).join('')
    const tree = parseFragment(opening + 'x' + '</b>'.repeat(size), { treeAdapter: adapter })
    assert.ok(reads <= 64 * size, 'formatting_adapter_work_exceeds_bound')
    equalText(serialize(tree), Array.from({ length: size }, (_, index) => `<b a="${index}">`).join('') + 'x' + '</b>'.repeat(size))
  }
} else if (mode === 'deep-serialize' || mode === 'template-eof') {
  const tag = mode === 'deep-serialize' ? 'div' : 'template'
  for (const size of [3, 4096]) {
    const opening = `<${tag}>`.repeat(size), closing = `</${tag}>`.repeat(size)
    equalText(serialize(parseFragment(opening + 'x' + (mode === 'template-eof' ? '' : closing))), opening + 'x' + closing)
  }
} else throw new Error('unknown_parser_probe')
process.stdout.write(JSON.stringify({ mode, passed: true }) + '\n')
