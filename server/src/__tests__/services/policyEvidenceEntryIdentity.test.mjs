import {
  buildPolicyEvidenceEntrySemanticKey,
  findPolicyEvidenceEntryDuplicateIndexes,
} from '../../services/policyEvidenceEntryIdentity.mjs';

function buildEntry(overrides = {}) {
  return {
    bucketId: 'identity_evidence',
    sourceId: 'media_server_library_profile',
    authoritySourceId: 'media_server_contents',
    key: 'genre:animation',
    label: 'Animation',
    value: null,
    count: 1,
    confidence: null,
    reasonCode: 'observed_library_profile',
    observedAt: null,
    stale: null,
    ...overrides,
  };
}

describe('policyEvidenceEntryIdentity', () => {
  test('uses normalized evidence fields to identify exact duplicates', () => {
    const entry = buildEntry();

    expect(buildPolicyEvidenceEntrySemanticKey(entry))
      .toBe(buildPolicyEvidenceEntrySemanticKey({ ...entry }));
    expect(findPolicyEvidenceEntryDuplicateIndexes([
      entry,
      { ...entry },
      buildEntry({ authoritySourceId: 'operator_declared_intent' }),
    ])).toEqual([1]);
  });

  test('keeps different normalized facts distinct', () => {
    expect(findPolicyEvidenceEntryDuplicateIndexes([
      buildEntry(),
      buildEntry({ count: 2 }),
      buildEntry({ observedAt: '2026-07-12T12:00:00.000Z' }),
      buildEntry({ reasonCode: 'manual_correction_observed' }),
    ])).toEqual([]);
  });
});
