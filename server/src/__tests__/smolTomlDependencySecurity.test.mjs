/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'smol-toml';

describe('TOML dependency security and compatibility', () => {
  test('valid tables retain values, dates, arrays and own keys without inherited properties', () => {
    const data = parse('title = "example"\nwhen = 2026-10-05T12:30:00Z\n[test]\npreload = ["./setup.mjs"]\n[table]\n"key.with.dot" = 2\n__proto__ = "literal"\n');
    expect(Object.getPrototypeOf(data)).toBeNull();
    expect(Object.getPrototypeOf(data.test)).toBeNull();
    expect(data.when.toISOString()).toBe('2026-10-05T12:30:00.000Z');
    expect(data.test.preload).toEqual(['./setup.mjs']);
    expect(Object.hasOwn(data.table, '__proto__')).toBe(true);
    expect(data.table.__proto__).toBe('literal');
    expect(data.table['key.with.dot']).toBe(2);
    expect(parse(stringify(data))).toEqual(data);
  });

  test.each(['a = 1\na = 2', '[table\na = 1', 'a = "unterminated'])('invalid TOML fails closed: %s', document => {
    expect(() => parse(document)).toThrow();
  });

  test('dot-free plain keys, quoted keys and array tables do not rescan the remaining document', () => {
    // Isolated built-in instrumentation measures work, not noisy timing. Small
    // valid inputs plus hard process/heap limits avoid a resource-exhaustion PoC.
    const script = `
      import assert from 'node:assert/strict';
      import { parse } from 'smol-toml';
      const original = String.prototype.indexOf;
      const counts = [];
      for (const kind of ['plain', 'quoted', 'tables']) {
        const input = Array.from({length: 500}, (_, i) => kind === 'tables'
          ? '[[items]]\\nvalue = 1\\n' : (kind === 'quoted' ? '"k' + i + '"' : 'k' + i) + ' = 1\\n').join('');
        let work = 0;
        String.prototype.indexOf = function (needle, start = 0) {
          if (needle === '.' && String(this) === input) work += this.length - start;
          return original.call(this, needle, start);
        };
        try {
          const data = parse(input);
          if (kind === 'tables') { assert.equal(data.items.length, 500); assert.equal(data.items[499].value, 1); }
          else { assert.equal(Object.keys(data).length, 500); assert.equal(data.k499, 1); }
        } finally { String.prototype.indexOf = original; }
        counts.push({work, length: input.length});
      }
      console.log(JSON.stringify(counts));
    `;
    const result = spawnSync(process.execPath, ['--max-old-space-size=128', '--input-type=module', '--eval', script], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)), shell: false, windowsHide: true,
      encoding: 'utf8', timeout: 5000, maxBuffer: 4096,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const counts = JSON.parse(result.stdout);
    expect(counts).toHaveLength(3);
    for (const { work, length } of counts) expect(work).toBeLessThan(length * 8);
  });
});
