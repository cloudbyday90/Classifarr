/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { CORE_SCHEMA, load, mergeTag, YAML11_SCHEMA } from 'js-yaml';

// Keep merge-budget regressions on the surviving application YAML dependency.

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
