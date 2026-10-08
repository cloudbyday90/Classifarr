/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { load, loadAll } from 'js-yaml';

// Exercise the installed dependency, including both parser changes in 5.4.3.
for (const style of ['|', '|-', '|+', '>', '>-', '>+']) {
  test(`empty-only ${style} preserves chomping and the following nested sibling`, () => {
    const source = [
      'schema:',
      `  example: ${style}`,
      ' '.repeat(6),
      '  enabled: true',
      '',
    ].join('\n');
    assert.deepEqual(load(source), {
      schema: { example: style.endsWith('+') ? '\n' : '', enabled: true },
    });
  });
}

test('empty block scalar does not swallow the next sequence item', () => {
  const source = [
    'alternatives:',
    '  - type: string',
    '    example: |+',
    ' '.repeat(6),
    '  - type: array',
    '',
  ].join('\n');
  assert.deepEqual(load(source), {
    alternatives: [{ type: 'string', example: '\n' }, { type: 'array' }],
  });
});

test('nonempty literal and folded scalars preserve their distinct semantics', () => {
  assert.deepEqual(load('literal: |\n  first\n  second\nfolded: >\n  first\n  second\n'), {
    literal: 'first\nsecond\n', folded: 'first second\n',
  });
});

test('an over-indented empty line before a nonempty scalar remains invalid', () => {
  assert.throws(() => load('example: |\n   \n value\n'), /bad indentation/);
});

test('first mapping keys retain tags, anchors, quoting and explicit values', () => {
  assert.deepEqual(load('!!str 12: tagged\n"quoted:key": value\n? &key first\n: anchored\ncopy: *key\n'), {
    12: 'tagged', 'quoted:key': 'value', first: 'anchored', copy: 'first',
  });
});

test('mapping anchors and document boundaries remain independent', () => {
  const [first, second] = loadAll('---\n&root\nname: first\nself: *root\n---\nname: second\n');
  assert.equal(first.name, 'first');
  assert.equal(first.self, first);
  assert.deepEqual(second, { name: 'second' });
});

test('duplicate keys, extra documents and executable tags remain rejected', () => {
  assert.throws(() => load('first: 1\nfirst: 2\n'), /duplicat/i);
  assert.throws(() => load('first: 1\n---\nsecond: 2\n'), /single document/i);
  assert.throws(() => load('first: !!js/function "function() {}"\n'), /unknown scalar tag/i);
});

test('default schema does not silently opt into merge keys', () => {
  assert.deepEqual(load('first: { <<: { enabled: true } }\n'), {
    first: { '<<': { enabled: true } },
  });
});
