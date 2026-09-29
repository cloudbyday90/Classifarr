/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { findPackageJSON } from 'node:module';
import { test } from 'node:test';
import { CORE_SCHEMA, load, mergeTag, YAML11_SCHEMA } from 'js-yaml';
import parseLinterYaml from 'markdownlint-cli2/parsers/yaml';
import { lint } from 'markdownlint-cli2/markdownlint/promise';

// This file lives outside server/ so it exercises the vulnerable root tooling
// boundary, not the independently installed (already patched) server dependency.
test('the root regression and Markdown linter resolve the same YAML package', () => {
  assert.equal(
    findPackageJSON('js-yaml', import.meta.url),
    findPackageJSON('js-yaml', import.meta.resolve('markdownlint-cli2/parsers/yaml')),
  );
});

const schemas = [
  ['YAML 1.1', YAML11_SCHEMA],
  ['core with merge tag', CORE_SCHEMA.withTags(mergeTag)],
];

const budgetCases = [
  {
    name: 'direct empty mapping consumes budget',
    yaml: 'empty: &empty {}\ntarget: { <<: *empty }\n',
    limit: 0,
  },
  {
    name: 'aliased sequence of empty sources consumes budget',
    yaml: 'sources: &sources [{}, {}, {}]\ntarget: { <<: *sources }\n',
    limit: 2,
  },
  {
    name: 'repeated empty alias is charged on every use',
    yaml: 'empty: &empty {}\ntarget: { <<: [*empty, *empty, *empty] }\n',
    limit: 2,
  },
  {
    name: 'merge budget accumulates across targets',
    yaml: 'sources: &sources [{}, {}]\ntargets:\n  - <<: *sources\n  - <<: *sources\n',
    limit: 3,
  },
];

for (const [schemaName, schema] of schemas) {
  for (const { name, yaml, limit } of budgetCases) {
    test(`${schemaName}: ${name}`, () => {
      assert.throws(
        () => load(yaml, { schema, maxTotalMergeKeys: limit }),
        /merge keys exceeded maxTotalMergeKeys/,
      );
    });
  }

  test(`${schemaName}: an empty merge within the budget remains valid`, () => {
    const result = load('empty: &empty {}\ntarget: { <<: *empty }\n', {
      schema,
      maxTotalMergeKeys: 1,
    });
    assert.deepEqual(result.target, {});
  });

  test(`${schemaName}: valid merges preserve explicit and first-source precedence`, () => {
    const result = load([
      'first: &first { enabled: true, limit: 4 }',
      'second: &second { enabled: false, limit: 8, label: movies }',
      'target: { <<: [*first, *second], limit: 2 }',
      '',
    ].join('\n'), { schema, maxTotalMergeKeys: 32 });
    assert.deepEqual(result.target, { enabled: true, limit: 2, label: 'movies' });
  });
}

const linterConfigYaml = 'default: false\nMD012:\n  maximum: 1\nMD047: true\n';

test('the public linter parser preserves ordinary YAML configuration values', () => {
  assert.deepEqual(parseLinterYaml(linterConfigYaml), {
    default: false,
    MD012: { maximum: 1 },
    MD047: true,
  });
});

for (const prefix of ['', '%YAML 1.1\n---\n']) {
  test(`the linter keeps default-schema merge keys literal (${prefix ? 'directive' : 'plain'})`, () => {
    const result = parseLinterYaml(`${prefix}source: &source {}\ntarget: { <<: *source }\n`);
    assert.deepEqual(result.target, { '<<': {} });
  });
}

test('the public linter parser still rejects malformed configuration', () => {
  assert.throws(() => parseLinterYaml('MD012: [\n'), { name: 'YAMLException' });
});

test('YAML-derived linter rules still accept valid Markdown and report invalid Markdown', async () => {
  const result = await lint({
    config: parseLinterYaml(linterConfigYaml),
    strings: { valid: '# Title\n\nText.\n', invalid: '# Title\n\n\nText.' },
  });
  assert.deepEqual(result.valid, []);
  assert.deepEqual(result.invalid.map(({ ruleNames }) => ruleNames[0]).sort(), ['MD012', 'MD047']);
});
