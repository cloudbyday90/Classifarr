import { readFile } from 'node:fs/promises';

import {
  validateAiPolicySweepFixtureDocument,
} from '../../../../scripts/lib/aiPolicySweepFixtureDocument.mjs';

const DEFAULT_FIXTURE_DOCUMENT_URL = new URL(
  '../../../../scripts/fixtures/ai-policy-sweep.fixtures.json',
  import.meta.url
);

const reviewedFixture = {
  version: 'classifarr.ai_classification_evaluation_fixture.v1',
  id: 'reviewed-fixture',
  name: 'Reviewed fixture',
  tags: ['local-policy-cohort'],
  request: { tmdbId: 42, mediaType: 'movie', title: 'Example' },
  expected: {
    fallbackAllowed: false,
    outcomes: [{
      decisionKind: 'clarification',
      methods: ['ai_analysis'],
      historyStatuses: ['awaiting_decision'],
    }],
  },
};

describe('AI policy sweep fixture document', () => {
  test('keeps the default local cohort valid and reviewed', async () => {
    const document = JSON.parse(await readFile(DEFAULT_FIXTURE_DOCUMENT_URL, 'utf8'));
    const validation = validateAiPolicySweepFixtureDocument(document);
    const evaluatedFixtures = document.filter(fixture => Object.hasOwn(fixture, 'version'));

    expect(validation).toEqual({
      ok: true,
      evaluationFixtureCount: 4,
      issues: [],
    });
    expect(evaluatedFixtures.map(fixture => fixture.id)).toEqual([
      'local-ambiguity-deep-water-2006',
      'local-remake-crash-1996',
      'local-remake-crash-2005',
      'local-name-collision-office-uk',
    ]);
    expect(evaluatedFixtures.map(fixture => fixture.expected.outcomes[0])).toEqual([
      expect.objectContaining({ methods: ['ai_analysis'], historyStatuses: ['awaiting_decision'] }),
      expect.objectContaining({ methods: ['ai_analysis'], historyStatuses: ['awaiting_decision'] }),
      expect.objectContaining({ methods: ['policy_engine'], historyStatuses: ['awaiting_decision'] }),
      expect.objectContaining({ methods: ['policy_engine'], historyStatuses: ['awaiting_decision'] }),
    ]);
  });

  test('rejects a versioned fixture with an unsupported contract version', () => {
    const validation = validateAiPolicySweepFixtureDocument([{
      ...reviewedFixture,
      version: 'classifarr.ai_classification_evaluation_fixture.v0',
    }]);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'invalid_fixture_version',
        path: 'fixtures[0].version',
      }),
    ]));
  });

  test('rejects duplicate versioned fixture IDs before a live request is sent', () => {
    const validation = validateAiPolicySweepFixtureDocument([
      reviewedFixture,
      { ...reviewedFixture, name: 'Duplicate fixture' },
    ]);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'duplicate_evaluation_fixture_id',
        path: 'fixtures[1].id',
      }),
    ]));
  });

  test('rejects an unknown legacy field rather than silently ignoring it', () => {
    const validation = validateAiPolicySweepFixtureDocument([{
      name: 'Legacy fixture',
      tmdb_id: 42,
      media_type: 'movie',
      title: 'Example',
      unexpected: 'value',
    }]);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'unknown_legacy_fixture_field',
        path: 'fixtures[0].unexpected',
      }),
    ]));
  });
});
