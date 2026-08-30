/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, test } from '@jest/globals';

import {
  validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocumentForScript,
} from '../../../../scripts/lib/policyCandidateEvidenceOfflineEvaluationFixtureDocument.mjs';

const FIXTURE_DOCUMENT_URL = new URL(
  '../../../../scripts/fixtures/policy-candidate-evidence-offline-evaluation.fixtures.json',
  import.meta.url,
);

describe('policyCandidateEvidenceOfflineEvaluationFixtureDocument', () => {
  test('keeps the committed offline corpus valid and bounded', async () => {
    const document = JSON.parse(await readFile(FIXTURE_DOCUMENT_URL, 'utf8'));

    expect(validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocumentForScript(document)).toEqual({
      ok: true,
      fixtureCount: 8,
      issues: [],
    });
    expect(document.map((fixture) => fixture.id)).toEqual([
      'katrina-like-documentary-ambiguity',
      'comedy-and-standup-overlap',
      'clear-documentary-destination',
      'inventory-unavailable-documentary',
      'declared-scope-semantic-conflict',
      'alternative-semantic-overreach',
      'clear-series-destination',
      'low-margin-semantic-uncertainty',
    ]);
  });
});
