import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS,
  POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_CONFIDENCE,
  POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_ITEM_COUNT,
  POLICY_BROAD_GENRE_IDENTITY_SUPPORT_TYPE_IDS,
  evaluatePolicyBroadGenreIdentityEligibility,
  isPolicyBroadGenreEvidence,
} from '../../services/policyBroadGenreIdentityEligibility.mjs';
import {
  POLICY_EVIDENCE_SOURCE_IDS,
} from '../../services/policyEvidenceEngine.mjs';

function observedSpecificIdentity(overrides = {}) {
  return {
    key: 'studio:ghibli',
    label: 'Studio Ghibli',
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    count: POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_ITEM_COUNT,
    confidence: POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_CONFIDENCE,
    stale: false,
    ...overrides,
  };
}

describe('policyBroadGenreIdentityEligibility', () => {
  test('recognizes only broad generic genre evidence', () => {
    expect(isPolicyBroadGenreEvidence({ key: 'genre:animation', label: 'Animation' })).toBe(true);
    expect(isPolicyBroadGenreEvidence({ key: 'studio:ghibli', label: 'Studio Ghibli' })).toBe(false);
  });

  test('requires trusted observed source, count, confidence, and freshness', () => {
    expect(evaluatePolicyBroadGenreIdentityEligibility([
      observedSpecificIdentity(),
    ])).toEqual(expect.objectContaining({
      eligible: true,
      supportTypeId: POLICY_BROAD_GENRE_IDENTITY_SUPPORT_TYPE_IDS.OBSERVED_SPECIFIC_IDENTITY,
      qualifiedObservedSpecificIdentityCount: 1,
    }));

    const weakCount = evaluatePolicyBroadGenreIdentityEligibility([
      observedSpecificIdentity({ count: 1 }),
    ]);
    expect(weakCount).toEqual(expect.objectContaining({ eligible: false }));
    expect(weakCount.reasonIds).toContain(
      POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS
        .OBSERVED_SPECIFIC_IDENTITY_COUNT_BELOW_MINIMUM
    );

    const weakConfidence = evaluatePolicyBroadGenreIdentityEligibility([
      observedSpecificIdentity({ confidence: 0.69 }),
    ]);
    expect(weakConfidence).toEqual(expect.objectContaining({ eligible: false }));
    expect(weakConfidence.reasonIds).toContain(
      POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS
        .OBSERVED_SPECIFIC_IDENTITY_CONFIDENCE_BELOW_MINIMUM
    );

    const stale = evaluatePolicyBroadGenreIdentityEligibility([
      observedSpecificIdentity({ stale: true }),
    ]);
    expect(stale).toEqual(expect.objectContaining({ eligible: false }));
    expect(stale.reasonIds).toContain(
      POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS
        .OBSERVED_SPECIFIC_IDENTITY_STALE
    );
  });

  test('rejects metadata and malformed sources as specific identity support', () => {
    const eligibility = evaluatePolicyBroadGenreIdentityEligibility([
      observedSpecificIdentity({
        sourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
        authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      }),
      observedSpecificIdentity({
        sourceId: null,
        authoritySourceId: null,
      }),
    ]);

    expect(eligibility).toEqual(expect.objectContaining({
      eligible: false,
      supportTypeId: POLICY_BROAD_GENRE_IDENTITY_SUPPORT_TYPE_IDS.NONE,
    }));
    expect(eligibility.reasonIds).toEqual([
      POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS.NO_SPECIFIC_IDENTITY_SUPPORT,
    ]);
  });

  test('accepts explicit operator-declared specific identity without inferred thresholds', () => {
    const eligibility = evaluatePolicyBroadGenreIdentityEligibility([
      observedSpecificIdentity({
        sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        count: null,
        confidence: null,
        operatorDeclared: true,
      }),
    ]);

    expect(eligibility).toEqual(expect.objectContaining({
      eligible: true,
      supportTypeId:
        POLICY_BROAD_GENRE_IDENTITY_SUPPORT_TYPE_IDS.OPERATOR_DECLARED_SPECIFIC_IDENTITY,
      reasonIds: [
        POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS
          .OPERATOR_DECLARED_SPECIFIC_IDENTITY,
      ],
    }));
  });

  test('does not treat a relabeled entry as an operator-declared override', () => {
    const eligibility = evaluatePolicyBroadGenreIdentityEligibility([
      observedSpecificIdentity({
        sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        operatorDeclared: false,
      }),
    ]);

    expect(eligibility).toEqual(expect.objectContaining({
      eligible: false,
      supportTypeId: POLICY_BROAD_GENRE_IDENTITY_SUPPORT_TYPE_IDS.NONE,
    }));
  });

  test('is deterministic when candidate order changes', () => {
    const candidates = [
      observedSpecificIdentity({ key: 'studio:ghibli', label: 'Studio Ghibli' }),
      observedSpecificIdentity({ key: 'studio:pixar', label: 'Pixar' }),
    ];

    expect(evaluatePolicyBroadGenreIdentityEligibility(candidates))
      .toEqual(evaluatePolicyBroadGenreIdentityEligibility([...candidates].reverse()));
  });
});
