import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  PHASE6R_EVIDENCE_BUCKET_IDS,
  buildPolicyBuilderPhase6EvidenceProjection,
} from '../../services/policyBuilderPhase6EvidenceEngine.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
} from '../../services/policyEvidenceBoundary.mjs';
import {
  PHASE6R_INTENT_AUDIT_RISK_IDS,
  PHASE6R_INTENT_BOUNDARY_STATUS_IDS,
  PHASE6R_INTENT_CONFIDENCE_LEVEL_IDS,
  PHASE6R_INTENT_FIELD_IDS,
  PHASE6R_INTENT_WARNING_IDS,
  buildPolicyBuilderPhase6IntentDraft,
  buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence,
  buildPolicyBuilderPhase6IntentEngineAudit,
  getPolicyBuilderPhase6IntentField,
  listPolicyBuilderPhase6IntentFields,
  validatePolicyBuilderPhase6IntentDraft,
} from '../../services/policyBuilderPhase6IntentEngine.mjs';

describe('policyBuilderPhase6IntentEngine', () => {
  test('defines the destination intent fields in Phase 6R order', () => {
    expect(listPolicyBuilderPhase6IntentFields().map(field => field.id)).toEqual([
      PHASE6R_INTENT_FIELD_IDS.BELONGS_HERE,
      PHASE6R_INTENT_FIELD_IDS.HELPFUL_MATCHES,
      PHASE6R_INTENT_FIELD_IDS.HARD_LIMITS,
      PHASE6R_INTENT_FIELD_IDS.AVOID,
      PHASE6R_INTENT_FIELD_IDS.ASK_WHEN,
      PHASE6R_INTENT_FIELD_IDS.ROUTING_TARGET,
    ]);

    expect(getPolicyBuilderPhase6IntentField(PHASE6R_INTENT_FIELD_IDS.HARD_LIMITS))
      .toEqual(expect.objectContaining({
        durableAuthorityRequired: true,
        evidenceBucketIds: [PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT],
      }));
  });

  test('builds proposed destination intent from evidence projection', () => {
    const projection = buildPolicyBuilderPhase6EvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { key: 'studio:pixar', label: 'Pixar', confidence: 0.94, count: 18 },
        ],
        compatibilityCandidates: [
          { key: 'genre:family', label: 'Family', confidence: 0.86, count: 20 },
        ],
      },
      operatorIntent: {
        hardLimits: ['No NC-17'],
        avoid: ['Live-action remakes'],
        routingTargets: ['Radarr Animated Movies'],
      },
      routingOutcomes: ['Recent route succeeded'],
    });

    const intent = buildPolicyBuilderPhase6IntentDraft(projection);

    expect(intent.version).toBe('phase6r.intent.v1');
    expect(intent.belongs_here).toEqual([
      expect.objectContaining({
        label: 'Pixar',
        evidenceBucketId: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
        authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
        inferred: true,
      }),
    ]);
    expect(intent.helpful_matches).toEqual([
      expect.objectContaining({
        label: 'Family',
        evidenceBucketId: PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      }),
    ]);
    expect(intent.hard_limits).toEqual([
      expect.objectContaining({
        label: 'No NC-17',
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        operatorDeclared: true,
      }),
    ]);
    expect(intent.avoid).toEqual([
      expect.objectContaining({
        label: 'Live-action remakes',
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        operatorDeclared: true,
      }),
    ]);
    expect(intent.routing_target).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Radarr Animated Movies' }),
      expect.objectContaining({ label: 'Recent route succeeded' }),
    ]));
    expect(intent.confidence.level).toBe(PHASE6R_INTENT_CONFIDENCE_LEVEL_IDS.HIGH);
  });

  test('builds bounded intent only from a successful evidence boundary result', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        libraryProfile: {
          identityCandidates: [
            { key: 'studio:pixar', label: 'Pixar', confidence: 0.94, count: 18 },
          ],
        },
        operatorIntent: {
          hardLimits: ['No NC-17'],
        },
      },
    });

    const result = buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: PHASE6R_INTENT_BOUNDARY_STATUS_IDS.READY,
      issueCount: 0,
      nextPhase: expect.objectContaining({
        phaseId: '6r_3',
      }),
    }));
    expect(result.intent).toEqual(expect.objectContaining({
      source: 'phase6r_bounded_evidence_boundary',
      evidenceBoundary: expect.objectContaining({
        boundaryVersion: boundedEvidenceResult.version,
        statusId: boundedEvidenceResult.statusId,
        quality: expect.objectContaining({
          statusId: boundedEvidenceResult.projection.quality.statusId,
          nextActionId: boundedEvidenceResult.projection.quality.nextActionId,
          reasonIds: boundedEvidenceResult.projection.quality.reasonIds,
          counts: boundedEvidenceResult.projection.quality.counts,
        }),
        projectionFingerprint: expect.objectContaining({
          fingerprint: boundedEvidenceResult.projectionFingerprint.fingerprint,
        }),
      }),
    }));
    expect(result.intent.belongs_here).toEqual([
      expect.objectContaining({ label: 'Pixar' }),
    ]);
    expect(JSON.stringify(result.intent.evidenceBoundary)).not.toContain('Pixar');
    expect(result.intentAudit.ok).toBe(true);
  });

  test('blocks bounded intent when evidence quality is insufficient', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        metadataEvidence: ['Family'],
        profileFreshness: {
          stale: false,
        },
      },
    });

    const result = buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });

    expect(boundedEvidenceResult.projection.quality.statusId).toBe('insufficient');
    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_INTENT_BOUNDARY_STATUS_IDS.BLOCKED_BY_EVIDENCE_QUALITY,
      intent: null,
      intentAudit: null,
      nextPhase: null,
    }));
    expect(result.evidenceBoundary).toEqual(expect.objectContaining({
      quality: expect.objectContaining({
        statusId: 'insufficient',
        nextActionId: 'confirm_destination_identity',
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_INTENT_AUDIT_RISK_IDS.INSUFFICIENT_EVIDENCE_QUALITY,
        nextActionId: 'confirm_destination_identity',
      }),
    ]));
    expect(JSON.stringify(result.evidenceBoundary)).not.toContain('Family');
  });

  test('rejects bounded intent drafts that drop the evidence quality snapshot', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        operatorIntent: {
          belongsHere: ['Animated Movies'],
        },
      },
    });
    const result = buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence({
      boundedEvidenceResult,
    });
    const tamperedIntent = {
      ...result.intent,
      evidenceBoundary: {
        ...result.intent.evidenceBoundary,
        quality: null,
      },
    };

    expect(validatePolicyBuilderPhase6IntentDraft(tamperedIntent).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_INTENT_AUDIT_RISK_IDS.MISSING_EVIDENCE_QUALITY,
        }),
      ]));
  });

  test('blocks bounded intent when evidence fingerprint no longer matches the projection', () => {
    const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        libraryProfile: {
          identityCandidates: [
            { key: 'studio:pixar', label: 'Pixar', confidence: 0.94, count: 18 },
          ],
        },
      },
    });
    const tamperedBoundary = {
      ...boundedEvidenceResult,
      projectionFingerprint: {
        ...boundedEvidenceResult.projectionFingerprint,
        fingerprint: 'b'.repeat(64),
      },
    };

    const result = buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence({
      boundedEvidenceResult: tamperedBoundary,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_INTENT_BOUNDARY_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY,
      intent: null,
      intentAudit: null,
      evidenceFingerprintAudit: expect.objectContaining({ ok: false }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_INTENT_AUDIT_RISK_IDS.EVIDENCE_FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('blocks bounded intent when evidence boundary failed or lacks fingerprint', () => {
    const blockedEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        metadataEvidence: [{
          label: 'Unsafe provider evidence',
          providerPayload: { title: 'raw' },
        }],
      },
    });
    const blocked = buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence({
      boundedEvidenceResult: blockedEvidenceResult,
    });

    expect(blocked).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_INTENT_BOUNDARY_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY,
      intent: null,
      intentAudit: null,
    }));
    expect(blocked.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_INTENT_AUDIT_RISK_IDS.MISSING_EVIDENCE_BOUNDARY,
      }),
      expect.objectContaining({
        riskId: PHASE6R_INTENT_AUDIT_RISK_IDS.MISSING_EVIDENCE_FINGERPRINT,
      }),
    ]));

    const validEvidenceResult = buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        operatorIntent: {
          belongsHere: ['Animated Movies'],
        },
      },
    });
    const missingFingerprint = buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence({
      boundedEvidenceResult: {
        ok: true,
        projection: validEvidenceResult.projection,
      },
    });
    expect(missingFingerprint.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_INTENT_AUDIT_RISK_IDS.MISSING_EVIDENCE_FINGERPRINT,
      }),
    ]));
  });

  test('demotes broad genre identity to helpful evidence unless specific support exists', () => {
    const intent = buildPolicyBuilderPhase6IntentDraft({
      libraryProfile: {
        identityCandidates: [
          { key: 'genre:animation', label: 'Animation', confidence: 0.96, count: 50 },
        ],
      },
    });

    expect(intent.belongs_here).toEqual([]);
    expect(intent.helpful_matches).toEqual([
      expect.objectContaining({
        label: 'Animation',
        reasonCode: 'broad_genre_identity_demoted_to_compatibility',
      }),
    ]);
    expect(intent.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: PHASE6R_INTENT_WARNING_IDS.BROAD_GENRE_IDENTITY_NEEDS_SUPPORT,
      }),
    ]));
  });

  test('allows broad genre identity when the operator explicitly declares it', () => {
    const intent = buildPolicyBuilderPhase6IntentDraft({
      operatorIntent: {
        belongsHere: [
          { key: 'genre:animation', label: 'Animation' },
        ],
      },
    });

    expect(intent.belongs_here).toEqual([
      expect.objectContaining({
        label: 'Animation',
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        operatorDeclared: true,
      }),
    ]);
    expect(intent.warnings.map(warning => warning.reasonCode))
      .not.toContain(PHASE6R_INTENT_WARNING_IDS.BROAD_GENRE_IDENTITY_NEEDS_SUPPORT);
  });

  test('keeps metadata as compatibility evidence instead of identity authority', () => {
    const projection = {
      version: 'phase6r.evidence.v1',
      generatedFromLiveProvider: false,
      exposesRawProviderPayloads: false,
      exposesUiChipLanguage: false,
      warnings: [],
      buckets: {
        [PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY]: [
          {
            bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
            sourceId: 'metadata_enrichment',
            authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
            key: 'metadata:genre:animation',
            label: 'Animation',
          },
        ],
        [PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY]: [],
        [PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT]: [],
        [PHASE6R_EVIDENCE_BUCKET_IDS.AVOID]: [],
        [PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER]: [],
        [PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING]: [],
        [PHASE6R_EVIDENCE_BUCKET_IDS.FRESHNESS]: [],
        [PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT]: [],
      },
    };

    const intent = buildPolicyBuilderPhase6IntentDraft(projection);

    expect(intent.belongs_here).toEqual([]);
    expect(intent.helpful_matches).toEqual([
      expect.objectContaining({
        label: 'Animation',
        reasonCode: 'metadata_identity_demoted_to_compatibility',
      }),
    ]);
    expect(intent.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: PHASE6R_INTENT_WARNING_IDS.METADATA_NOT_IDENTITY_AUTHORITY,
      }),
    ]));
  });

  test('turns stale or missing evidence into ask_when warnings, not avoid exclusions', () => {
    const intent = buildPolicyBuilderPhase6IntentDraft({
      profileFreshness: {
        stale: true,
        updatedAt: '2026-05-01T12:00:00.000Z',
      },
    });

    expect(intent.ask_when).toEqual([
      expect.objectContaining({
        label: 'Profile is stale',
        reasonCode: 'stale_profile_needs_review',
      }),
    ]);
    expect(intent.avoid).toEqual([]);
    expect(intent.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: PHASE6R_INTENT_WARNING_IDS.OBSERVED_ABSENCE_NOT_EXCLUSION,
      }),
      expect.objectContaining({
        reasonCode: PHASE6R_INTENT_WARNING_IDS.STALE_PROFILE,
      }),
    ]));
  });

  test('does not create durable learning side effects from intent proposals', () => {
    const intent = buildPolicyBuilderPhase6IntentDraft({
      classificationFinalOutcomes: ['Mulan routed to Animated Movies'],
    });

    expect(intent.learningSideEffects).toEqual([]);
    expect(intent.assumptions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: 'final_outcomes_require_learning_guard',
      }),
    ]));
  });

  test('passes the default intent engine audit', () => {
    const intent = buildPolicyBuilderPhase6IntentDraft({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        hardLimits: ['No NC-17'],
      },
    });
    const audit = buildPolicyBuilderPhase6IntentEngineAudit(intent);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedFieldCount).toBe(6);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '6r_3',
      label: 'Learning Guard',
    }));
  });

  test('rejects metadata promoted into belongs_here', () => {
    const invalidIntent = buildPolicyBuilderPhase6IntentDraft({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
    });
    invalidIntent.belongs_here.push({
      fieldId: PHASE6R_INTENT_FIELD_IDS.BELONGS_HERE,
      key: 'metadata:genre:animation',
      label: 'Animation',
      evidenceBucketId: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
      authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      operatorDeclared: false,
    });

    expect(validatePolicyBuilderPhase6IntentDraft(invalidIntent).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_INTENT_AUDIT_RISK_IDS.METADATA_PROMOTED_TO_IDENTITY,
        }),
      ]));
  });

  test('rejects broad genre identity without support', () => {
    const invalidIntent = buildPolicyBuilderPhase6IntentDraft({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
    });
    invalidIntent.belongs_here = [
      {
        fieldId: PHASE6R_INTENT_FIELD_IDS.BELONGS_HERE,
        key: 'genre:animation',
        label: 'Animation',
        evidenceBucketId: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
        authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
        operatorDeclared: false,
      },
    ];

    expect(validatePolicyBuilderPhase6IntentDraft(invalidIntent).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_INTENT_AUDIT_RISK_IDS.BROAD_GENRE_IDENTITY_WITHOUT_SUPPORT,
        }),
      ]));
  });

  test('rejects non-operator hard limits and direct learning side effects', () => {
    const invalidIntent = buildPolicyBuilderPhase6IntentDraft({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
    });
    invalidIntent.hard_limits.push({
      fieldId: PHASE6R_INTENT_FIELD_IDS.HARD_LIMITS,
      key: 'rating:nc17',
      label: 'No NC-17',
      evidenceBucketId: PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      operatorDeclared: false,
    });
    invalidIntent.learningSideEffects.push({
      type: 'identity_evidence',
    });

    expect(validatePolicyBuilderPhase6IntentDraft(invalidIntent).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_INTENT_AUDIT_RISK_IDS.HARD_LIMIT_WITHOUT_DURABLE_AUTHORITY,
        }),
        expect.objectContaining({
          riskId: PHASE6R_INTENT_AUDIT_RISK_IDS.DIRECT_LEARNING_FROM_INTENT,
        }),
      ]));
  });

  test('exposes immutable intent field contracts', () => {
    const fields = listPolicyBuilderPhase6IntentFields();

    expect(Object.isFrozen(fields)).toBe(true);
    expect(Object.isFrozen(fields[0])).toBe(true);
    expect(Object.isFrozen(fields[0].evidenceBucketIds)).toBe(true);
  });
});
