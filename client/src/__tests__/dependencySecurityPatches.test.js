/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { SourceMapConsumer, SourceNode } from 'source-map-js'
import selectorParser from 'postcss-selector-parser'

const flatMap = { version: 3, sources: ['input.js'], sourcesContent: ['a'], names: [], mappings: 'AAAA' }
const indexed = (line, map = flatMap) => ({ version: 3, sections: [{ offset: { line, column: 0 }, map }] })

describe('reviewed dependency security patches', () => {
  test.each([10000001, -1, 1.5, '1', Infinity])('rejects unsafe indexed source-map offset %s before expansion', line => {
    expect(() => new SourceMapConsumer(indexed(line))).toThrow()
  })

  test('bounds accumulated nested offsets, not only each section', () => {
    expect(() => new SourceMapConsumer(indexed(6000000, indexed(6000000)))).toThrow(/nested/)
  })

  test('retains ordinary indexed mappings and source content', () => {
    const consumer = new SourceMapConsumer(indexed(1))
    expect(consumer.originalPositionFor({ line: 2, column: 1 })).toMatchObject({ source: 'input.js', line: 1 })
    expect(SourceNode.fromStringWithSourceMap('x\na', consumer).toString()).toBe('x\na')
    expect(consumer.sourceContentFor('input.js')).toBe('a')
  })

  test('nested source lookup reads the leaf once', () => {
    let map = flatMap
    for (let depth = 0; depth < 5; depth++) map = indexed(0, map)
    const consumer = new SourceMapConsumer(map)
    let leaf = consumer
    for (let depth = 0; depth < 5; depth++) leaf = leaf._sections[0].consumer
    let reads = 0
    Object.defineProperty(leaf, 'sources', { get: () => { reads++; return ['input.js'] } })
    expect(consumer.sources).toEqual(['input.js'])
    expect(reads).toBe(1)
  })

  test.each(['.a.b', '#x.y', '.a,|b', '[  *|bar   ]'])('preserves selector syntax: %s', selector => {
    expect(selectorParser().processSync(selector)).toBe(selector)
  })

  test.each(['a[href', 'a('])('rejects malformed selector: %s', selector => {
    expect(() => selectorParser().astSync(selector)).toThrow()
  })

  test('flat class, id and interpolation parsing avoids repeated linear membership scans', () => {
    // Isolate built-in instrumentation. Count work instead of asserting a noisy
    // wall-clock ratio; the child still has a hard deadline and heap bound.
    const script = `
      import assert from 'node:assert/strict';
      import parser from 'postcss-selector-parser';
      const indexOf = Array.prototype.indexOf;
      const counts = [];
      for (const atom of ['.a', '#a', '#{a}']) {
        let work = 0;
        Array.prototype.indexOf = function (...args) { work += this.length; return indexOf.apply(this, args); };
        try {
          const input = atom.repeat(2000);
          const tree = parser().astSync(input);
          assert.equal(tree.toString(), input);
          if (atom !== '#{a}') assert.equal(tree.first.nodes.length, 2000);
          counts.push(work);
        } finally { Array.prototype.indexOf = indexOf; }
      }
      console.log(JSON.stringify(counts));
    `
    const result = spawnSync(process.execPath, ['--max-old-space-size=128', '--input-type=module', '--eval', script], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)), shell: false, windowsHide: true,
      encoding: 'utf8', timeout: 5000, maxBuffer: 4096,
    })
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
    const counts = JSON.parse(result.stdout)
    expect(counts).toHaveLength(3)
    for (const work of counts) expect(work).toBeLessThan(80000)
  })
})
