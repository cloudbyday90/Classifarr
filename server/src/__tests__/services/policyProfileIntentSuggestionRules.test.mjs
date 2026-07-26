import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  POLICY_EVIDENCE_BUCKET_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
  buildPolicyEvidenceProjection,
} from '../../services/policyEvidenceEngine.mjs';
import {
  POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS,
  POLICY_PROFILE_INTENT_SUGGESTION_DESCRIPTOR_VERSION,
  POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS,
  buildPolicyProfileIntentSuggestionPlan,
  buildPolicyProfileIntentSuggestionPlanAudit,
  validatePolicyProfileIntentSuggestionDescriptor,
} from '../../services/policyProfileIntentSuggestionRules.mjs';

function buildPlan(evidenceInput = {}) {
  return buildPolicyProfileIntentSuggestionPlan(
    buildPolicyEvidenceProjection(evidenceInput)
  );
}

describe('policyProfileIntentSuggestionRules', () => {
  test('creates explainable server-owned suggestions from profile evidence', () => {
    const plan = buildPlan({
      libraryProfile: {
        identityCandidates: [
          { key: 'studio:pixar', label: 'Pixar', confidence: 0.94, count: 18 },
        { key: 'genre:animation', label: 'Animation', confidence: 0.91, count: 42 },
      ],
      compatibilityCandidates: [
        { key: 'genre:family', label: 'Family', confidence: 0.81, count: 20 },
      ],
    },
      operatorIntent: {
        hardLimits: ['No NC-17'],
        avoid: ['Live-action remakes'],
      },
    });

    expect(plan.entries.belongs_here).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Pixar',
        reasonCode: 'observed_destination_identity',
        suggestion: {
          version: POLICY_PROFILE_INTENT_SUGGESTION_DESCRIPTOR_VERSION,
          ruleId: POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OBSERVED_IDENTITY,
          explanation: 'Observed library evidence suggests this destination identity and remains inferred until accepted.',
        },
      }),
    ]));
    expect(plan.entries.helpful_matches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Family',
        suggestion: expect.objectContaining({
          ruleId: POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.EVIDENCE_SUPPORTED_HELPFUL_MATCH,
        }),
      }),
    ]));
    expect(plan.entries.hard_limits).toEqual([
      expect.objectContaining({
        label: 'No NC-17',
        operatorDeclared: true,
        suggestion: expect.objectContaining({
          ruleId: POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_HARD_LIMIT,
        }),
      }),
    ]);
    expect(plan.entries.avoid).toEqual([
      expect.objectContaining({
        label: 'Live-action remakes',
        operatorDeclared: true,
        suggestion: expect.objectContaining({
          ruleId: POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_AVOID,
        }),
      }),
    ]);
    expect(plan.appliedRuleIds).toEqual(expect.arrayContaining([
      POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OBSERVED_IDENTITY,
      POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.EVIDENCE_SUPPORTED_HELPFUL_MATCH,
      POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_HARD_LIMIT,
      POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_AVOID,
    ]));
  });

  test('produces the same plan when equivalent projection entries arrive in another order', () => {
    const projection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { key: 'studio:pixar', label: 'Pixar', count: 18, confidence: 0.94 },
          { key: 'studio:ghibli', label: 'Studio Ghibli', count: 12, confidence: 0.89 },
        ],
        compatibilityCandidates: [
          { key: 'genre:family', label: 'Family', count: 20, confidence: 0.81 },
          { key: 'genre:fantasy', label: 'Fantasy', count: 16, confidence: 0.73 },
        ],
      },
    });
    const reorderedProjection = {
      ...projection,
      buckets: {
        ...projection.buckets,
        [POLICY_EVIDENCE_BUCKET_IDS.IDENTITY]: [
          ...projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY],
        ].reverse(),
        [POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY]: [
          ...projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY],
        ].reverse(),
      },
    };

    expect(buildPolicyProfileIntentSuggestionPlan(reorderedProjection))
      .toEqual(buildPolicyProfileIntentSuggestionPlan(projection));
  });

  test('demotes broad genres and metadata while preserving a specific explanation', () => {
    const projection = {
      version: 'policy.evidence.v1',
      warnings: [],
      buckets: {
        [POLICY_EVIDENCE_BUCKET_IDS.IDENTITY]: [
          {
            bucketId: POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
            sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
            authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
            key: 'genre:animation',
            label: 'Animation',
          },
          {
            bucketId: POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
            sourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
            authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
            key: 'metadata:studio:pixar',
            label: 'Pixar',
          },
        ],
      },
    };

    const plan = buildPolicyProfileIntentSuggestionPlan(projection);

    expect(plan.entries.belongs_here).toEqual([]);
    expect(plan.entries.helpful_matches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Animation',
        suggestion: expect.objectContaining({
          ruleId: POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.BROAD_GENRE_IDENTITY_DEMOTED,
        }),
      }),
      expect.objectContaining({
        label: 'Pixar',
        suggestion: expect.objectContaining({
          ruleId: POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.METADATA_IDENTITY_DEMOTED,
        }),
      }),
    ]));
  });

  test('keeps observed absence as review evidence instead of creating avoid rules', () => {
    const plan = buildPlan({
      profileFreshness: {
        stale: true,
        updatedAt: '2026-05-01T12:00:00.000Z',
      },
    });

    expect(plan.entries.avoid).toEqual([]);
    expect(plan.entries.ask_when).toEqual([
      expect.objectContaining({
        suggestion: expect.objectContaining({
          ruleId: POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.STALE_PROFILE_REQUIRES_REVIEW,
        }),
      }),
    ]);
  });

  test('does not turn observed constraint-like values into declared constraints', () => {
    const projection = buildPolicyEvidenceProjection({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
    });
    projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT].push({
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
      sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      key: 'rating:nc_17',
      label: 'No NC-17',
    });

    expect(buildPolicyProfileIntentSuggestionPlan(projection).entries.hard_limits).toEqual([]);
  });

  test('filters object-valued evidence and detects tampered suggestion explanations', () => {
    const projection = {
      version: 'policy.evidence.v1',
      warnings: [],
      buckets: {
        [POLICY_EVIDENCE_BUCKET_IDS.IDENTITY]: [
          {
            bucketId: POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
            sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
            authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
            key: 'studio:pixar',
            label: 'Pixar',
            value: { providerPayload: { apiKey: 'must-not-project' } },
          },
        ],
      },
    };
    const plan = buildPolicyProfileIntentSuggestionPlan(projection);
    const tamperedPlan = JSON.parse(JSON.stringify(plan));
    tamperedPlan.entries.belongs_here[0].suggestion.explanation = 'Trust the client value.';

    expect(plan.entries.belongs_here[0].value).toBeNull();
    expect(JSON.stringify(plan)).not.toContain('must-not-project');
    expect(buildPolicyProfileIntentSuggestionPlanAudit(projection, tamperedPlan))
      .toEqual(expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.SUGGESTION_PLAN_MISMATCH,
          }),
        ]),
      }));
    expect(validatePolicyProfileIntentSuggestionDescriptor(
      tamperedPlan.entries.belongs_here[0].suggestion,
      {
        fieldId: 'belongs_here',
        reasonCode: 'observed_destination_identity',
      }
    )).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.SUGGESTION_EXPLANATION_MISMATCH,
        }),
      ]),
    }));
  });

  test('rejects raw evidence instead of accepting it as a suggestion input', () => {
    const rawEvidence = {
      libraryProfile: {
        identityCandidates: ['Animated Movies'],
      },
    };

    expect(() => buildPolicyProfileIntentSuggestionPlan(rawEvidence))
      .toThrow('requires a policy.evidence.v1 projection');
    expect(buildPolicyProfileIntentSuggestionPlanAudit(rawEvidence))
      .toEqual(expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.INVALID_EVIDENCE_PROJECTION,
          }),
        ]),
      }));
  });
});
