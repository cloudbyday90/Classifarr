import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  POLICY_EVIDENCE_BUCKET_IDS,
  buildPolicyEvidenceProjection,
} from '../../services/policyEvidenceEngine.mjs';
import {
  POLICY_EVIDENCE_QUALITY_AUDIT_RISK_IDS,
  POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS,
  POLICY_EVIDENCE_QUALITY_REASON_IDS,
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
  buildPolicyEvidenceQualityAssessment,
  validatePolicyEvidenceQualityAssessment,
} from '../../services/policyEvidenceQuality.mjs';

const qualityOptions = {
  bucketIds: POLICY_EVIDENCE_BUCKET_IDS,
  authoritySourceIds: AUTHORITY_SOURCE_IDS,
};

describe('policyEvidenceQuality', () => {
  test('builds compact quality for usable observed and declared identity evidence', () => {
    const projection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: [{ label: 'Animation', count: 12 }],
        compatibilityCandidates: ['Family'],
      },
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        routingTargets: ['Radarr Animated Movies'],
      },
      profileFreshness: {
        stale: false,
        updatedAt: '2026-06-30T12:00:00.000Z',
      },
    });

    const quality = buildPolicyEvidenceQualityAssessment(
      projection,
      qualityOptions
    );

    expect(quality).toEqual(expect.objectContaining({
      statusId: POLICY_EVIDENCE_QUALITY_STATUS_IDS.USABLE,
      nextActionId: POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS.PROCEED_TO_INTENT,
      hasIdentityEvidence: true,
      hasObservedIdentityEvidence: true,
      hasDeclaredIdentityEvidence: true,
      hasRoutingEvidence: true,
      hasFreshnessEvidence: true,
    }));
    expect(quality.score).toBe(1);
    expect(quality.reasonIds).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_QUALITY_REASON_IDS.OBSERVED_IDENTITY_PRESENT,
      POLICY_EVIDENCE_QUALITY_REASON_IDS.DECLARED_IDENTITY_PRESENT,
      POLICY_EVIDENCE_QUALITY_REASON_IDS.COMPATIBILITY_PRESENT,
      POLICY_EVIDENCE_QUALITY_REASON_IDS.ROUTING_PRESENT,
      POLICY_EVIDENCE_QUALITY_REASON_IDS.FRESHNESS_PRESENT,
    ]));
    expect(JSON.stringify(quality)).not.toContain('Animation');
    expect(JSON.stringify(quality)).not.toContain('Animated Movies');
  });

  test('marks missing identity as insufficient instead of inferring destination meaning', () => {
    const projection = buildPolicyEvidenceProjection({
      metadataEvidence: ['Family'],
      profileFreshness: {
        stale: false,
      },
    });

    expect(projection.quality).toEqual(expect.objectContaining({
      statusId: POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT,
      nextActionId:
        POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS.CONFIRM_DESTINATION_IDENTITY,
      hasIdentityEvidence: false,
    }));
    expect(projection.quality.reasonIds).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_QUALITY_REASON_IDS.MISSING_IDENTITY,
    ]));
    expect(projection.quality.score).toBeLessThanOrEqual(0.35);
  });

  test('routes stale profile evidence to review with refresh as the next action', () => {
    const projection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
      },
      profileFreshness: {
        stale: true,
        updatedAt: '2026-05-01T12:00:00.000Z',
      },
    });

    expect(projection.quality).toEqual(expect.objectContaining({
      statusId: POLICY_EVIDENCE_QUALITY_STATUS_IDS.NEEDS_REVIEW,
      nextActionId: POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS.REFRESH_PROFILE,
      hasStaleProfileEvidence: true,
    }));
    expect(projection.quality.reasonIds).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_QUALITY_REASON_IDS.STALE_PROFILE,
      POLICY_EVIDENCE_QUALITY_REASON_IDS.REVIEW_EVIDENCE_PRESENT,
    ]));
  });

  test('validates quality against projection counts and rejects label leakage', () => {
    const projection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
      },
    });

    expect(validatePolicyEvidenceQualityAssessment(
      projection,
      qualityOptions
    )).toEqual(expect.objectContaining({
      ok: true,
      issues: [],
    }));

    projection.quality = {
      ...projection.quality,
      score: 0.99,
      leakedLabel: 'Animation',
    };

    const audit = validatePolicyEvidenceQualityAssessment(
      projection,
      qualityOptions
    );

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_EVIDENCE_QUALITY_AUDIT_RISK_IDS.QUALITY_MISMATCH,
      }),
      expect.objectContaining({
        riskId:
          POLICY_EVIDENCE_QUALITY_AUDIT_RISK_IDS.QUALITY_EXPOSES_ENTRY_LABELS,
      }),
    ]));
  });
});
