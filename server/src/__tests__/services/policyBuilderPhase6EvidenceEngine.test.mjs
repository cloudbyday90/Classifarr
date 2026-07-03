import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  POLICY_UX_TERM_IDS,
} from '../../services/policyUserMentalModel.mjs';
import {
  PHASE6R_EVIDENCE_AUDIT_RISK_IDS,
  PHASE6R_EVIDENCE_BUCKET_IDS,
  PHASE6R_EVIDENCE_BUCKET_READINESS_IDS,
  PHASE6R_EVIDENCE_PROHIBITED_PAYLOAD_IDS,
  PHASE6R_EVIDENCE_REDUCER_CUTLINE_IDS,
  PHASE6R_EVIDENCE_SOURCE_IDS,
  buildPolicyBuilderPhase6EvidenceEngineAudit,
  buildPolicyBuilderPhase6EvidenceProjection,
  buildPolicyBuilderPhase6EvidenceProjectionAudit,
  getPolicyBuilderPhase6EvidenceBucket,
  getPolicyBuilderPhase6EvidenceSource,
  listPolicyBuilderPhase6EvidenceBuckets,
  listPolicyBuilderPhase6EvidenceReducerCutlines,
  listPolicyBuilderPhase6EvidenceSources,
  summarizePolicyBuilderPhase6EvidenceProjection,
  validatePolicyBuilderPhase6EvidenceBucket,
  validatePolicyBuilderPhase6EvidenceProjectionEntry,
  validatePolicyBuilderPhase6EvidenceSource,
} from '../../services/policyBuilderPhase6EvidenceEngine.mjs';

describe('policyBuilderPhase6EvidenceEngine', () => {
  test('defines stable Phase 6R evidence buckets in roadmap order', () => {
    expect(listPolicyBuilderPhase6EvidenceBuckets().map(bucket => bucket.id)).toEqual([
      PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
      PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
      PHASE6R_EVIDENCE_BUCKET_IDS.AVOID,
      PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
      PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING,
      PHASE6R_EVIDENCE_BUCKET_IDS.FRESHNESS,
      PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ]);

    const identity = getPolicyBuilderPhase6EvidenceBucket(PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY);
    expect(identity.phase0TermIds).toEqual([POLICY_UX_TERM_IDS.BELONGS_HERE]);
    expect(identity.authoritySourceIds).toEqual([
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(identity.traceAttribute).toBe('classifarr.policy.evidence.identity');
  });

  test('defines evidence sources without live lookups, raw payloads, UI language, or transient quota state', () => {
    listPolicyBuilderPhase6EvidenceSources().forEach(source => {
      expect(source.liveLookupAllowed).toBe(false);
      expect(source.exposesRawPayload).toBe(false);
      expect(source.exposesUiLanguage).toBe(false);
      expect(source.transientStateAllowed).toBe(false);
      expect(source.prohibitedPayloadIds).toEqual(expect.arrayContaining([
        PHASE6R_EVIDENCE_PROHIBITED_PAYLOAD_IDS.RAW_PROVIDER_PAYLOAD,
        PHASE6R_EVIDENCE_PROHIBITED_PAYLOAD_IDS.LIVE_PROVIDER_LOOKUP,
        PHASE6R_EVIDENCE_PROHIBITED_PAYLOAD_IDS.PROVIDER_QUOTA_STATE,
        PHASE6R_EVIDENCE_PROHIBITED_PAYLOAD_IDS.UI_CHIP_LANGUAGE,
        PHASE6R_EVIDENCE_PROHIBITED_PAYLOAD_IDS.REPLAY_PREVIEW_PAYLOAD,
        PHASE6R_EVIDENCE_PROHIBITED_PAYLOAD_IDS.IMPACT_PREVIEW_PAYLOAD,
      ]));
    });

    expect(getPolicyBuilderPhase6EvidenceSource(PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT)
      .allowedBucketIds)
      .not.toContain(PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY);
  });

  test('keeps hard limits and avoid evidence tied to operator-declared intent only', () => {
    const hardLimit = getPolicyBuilderPhase6EvidenceBucket(PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT);
    const avoid = getPolicyBuilderPhase6EvidenceBucket(PHASE6R_EVIDENCE_BUCKET_IDS.AVOID);

    expect(hardLimit.authoritySourceIds).toEqual([AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT]);
    expect(hardLimit.allowedSourceIds).toEqual([
      PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(avoid.authoritySourceIds).toEqual([AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT]);
    expect(avoid.allowedSourceIds).toEqual([
      PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
  });

  test('builds a deterministic offline evidence projection and strips raw provider payloads', () => {
    const projection = buildPolicyBuilderPhase6EvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { key: 'genre:animation', label: 'Animation', count: 12, confidence: 0.91 },
        ],
        compatibilityCandidates: ['Family'],
        outliers: [{ label: 'R-rated outlier', confidence: 35 }],
      },
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        hardLimits: [{ label: 'No NC-17', reasonCode: 'operator_declared_rating_limit' }],
        avoid: ['Live-action remakes'],
        routingTargets: ['Radarr Animated Movies'],
      },
      metadataEvidence: [
        {
          label: 'TMDB genre: Animation',
          confidence: 0.8,
          raw: { providerPayload: { id: 16 } },
          quotaState: 'ignored',
          uiChipLabel: 'Animation chip',
        },
      ],
      profileFreshness: {
        stale: false,
        updatedAt: '2026-06-30T12:00:00.000Z',
      },
    });

    expect(projection.generatedFromLiveProvider).toBe(false);
    expect(projection.exposesRawProviderPayloads).toBe(false);
    expect(projection.exposesUiChipLanguage).toBe(false);
    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Animation',
          sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
          authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
          includesRawPayload: false,
          liveLookupPerformed: false,
        }),
        expect.objectContaining({
          label: 'Animated Movies',
          sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
          authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        }),
      ]));
    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT][0])
      .toEqual(expect.objectContaining({
        label: 'No NC-17',
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      }));
    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'TMDB genre: Animation',
          sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
          authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
          includesRawPayload: false,
        }),
      ]));
    expect(JSON.stringify(projection)).not.toContain('providerPayload');
    expect(JSON.stringify(projection)).not.toContain('quotaState');
    expect(JSON.stringify(projection)).not.toContain('uiChipLabel');
    expect(projection.summary).toEqual(expect.objectContaining({
      version: 'phase6r.evidence.summary.v1',
      totalEntryCount: 9,
      hasBlockingEvidence: true,
      hasReviewEvidence: true,
    }));
    expect(projection.quality).toEqual(expect.objectContaining({
      version: 'phase6r.evidence.quality.v1',
      statusId: 'needs_review',
      nextActionId: 'review_evidence',
      hasIdentityEvidence: true,
      hasObservedIdentityEvidence: true,
      hasDeclaredIdentityEvidence: true,
    }));
    expect(JSON.stringify(projection.quality)).not.toContain('Animation');
    expect(JSON.stringify(projection.quality)).not.toContain('Animated Movies');
    expect(projection.summary.bucketSummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
        entryCount: 1,
        readinessId: PHASE6R_EVIDENCE_BUCKET_READINESS_IDS.BLOCKING,
      }),
      expect.objectContaining({
        bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
        entryCount: 1,
        readinessId: PHASE6R_EVIDENCE_BUCKET_READINESS_IDS.REVIEW,
      }),
    ]));
  });

  test('builds a bounded evidence summary for downstream engines', () => {
    const projection = buildPolicyBuilderPhase6EvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
        compatibilityCandidates: ['Family'],
      },
      operatorIntent: {
        hardLimits: ['No NC-17'],
      },
    });

    const summary = summarizePolicyBuilderPhase6EvidenceProjection(projection);

    expect(summary).toEqual(projection.summary);
    expect(summary.sourceIds).toEqual([
      PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(summary.authoritySourceIds).toEqual([
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(summary.blockingBucketIds).toEqual([
      PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
    ]);
  });

  test('treats stale profiles and missing input as insufficient evidence instead of exclusions', () => {
    const staleProjection = buildPolicyBuilderPhase6EvidenceProjection({
      profileFreshness: {
        stale: true,
        updatedAt: '2026-05-01T12:00:00.000Z',
      },
    });

    expect(staleProjection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT][0])
      .toEqual(expect.objectContaining({
        label: 'Profile is stale',
        reasonCode: 'stale_profile',
        stale: true,
      }));
    expect(staleProjection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.AVOID]).toEqual([]);

    const emptyProjection = buildPolicyBuilderPhase6EvidenceProjection();
    expect(emptyProjection.warnings).toEqual([
      expect.objectContaining({
        bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
        reasonCode: 'no_evidence_inputs',
      }),
    ]);
  });

  test('passes the default evidence engine audit', () => {
    const audit = buildPolicyBuilderPhase6EvidenceEngineAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedBucketCount).toBe(8);
    expect(audit.checkedSourceCount).toBe(8);
    expect(audit.checkedReducerCutlineCount).toBe(4);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '6r_2',
      label: 'Intent Engine',
    }));
  });

  test('tracks replay and impact reducers as rewrite or deletion candidates outside normal flow', () => {
    const cutlines = listPolicyBuilderPhase6EvidenceReducerCutlines();

    expect(cutlines.map(cutline => cutline.dispositionId)).toEqual(expect.arrayContaining([
      PHASE6R_EVIDENCE_REDUCER_CUTLINE_IDS.DELETE_DIAGNOSTIC_SURFACE,
      PHASE6R_EVIDENCE_REDUCER_CUTLINE_IDS.REWRITE_AS_EVIDENCE_REDUCER,
      PHASE6R_EVIDENCE_REDUCER_CUTLINE_IDS.KEEP_OUT_OF_NORMAL_FLOW,
    ]));
    cutlines.forEach(cutline => {
      expect(cutline.normalFlowAllowed).toBe(false);
      expect(cutline.replacementTarget).toEqual(expect.any(String));
      expect(cutline.reason).toEqual(expect.any(String));
    });
  });

  test('audits generated evidence projections as safe contract instances', () => {
    const projection = buildPolicyBuilderPhase6EvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
        compatibilityCandidates: ['Family'],
      },
      operatorIntent: {
        hardLimits: ['No NC-17'],
      },
    });

    const audit = buildPolicyBuilderPhase6EvidenceProjectionAudit(projection);

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      checkedEntryCount: 3,
      issues: [],
    }));
  });

  test('rejects tampered projections that leak payloads, live lookups, or invalid authority', () => {
    const projection = buildPolicyBuilderPhase6EvidenceProjection({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
    });
    projection.generatedFromLiveProvider = true;
    projection.exposesRawProviderPayloads = true;
    projection.exposesUiChipLanguage = true;
    projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY].push({
      label: 'Provider gate identity chip',
      sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      includesRawPayload: true,
      liveLookupPerformed: true,
      raw: { providerPayload: { id: 16 } },
    });
    projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT].push({
      label: 'Provider hard limit',
      sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    });
    projection.summary.totalEntryCount = 1;

    const riskIds = buildPolicyBuilderPhase6EvidenceProjectionAudit(projection)
      .issues
      .map(issue => issue.riskId);

    expect(riskIds).toEqual(expect.arrayContaining([
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_USED_LIVE_PROVIDER,
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_EXPOSES_RAW_PAYLOAD,
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_EXPOSES_UI_LANGUAGE,
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_SOURCE_NOT_ALLOWED,
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_AUTHORITY_NOT_ALLOWED,
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_RAW_PAYLOAD,
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_LIVE_LOOKUP,
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_HARD_LIMIT_WITHOUT_OPERATOR_AUTHORITY,
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_METADATA_OWNS_IDENTITY,
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_SUMMARY_COUNT_MISMATCH,
    ]));
  });

  test('rejects projections without generated summaries', () => {
    const projection = buildPolicyBuilderPhase6EvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
      },
    });
    delete projection.summary;

    expect(buildPolicyBuilderPhase6EvidenceProjectionAudit(projection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_MISSING_SUMMARY,
        }),
      ]));
  });

  test('rejects projections with stale quality assessments', () => {
    const projection = buildPolicyBuilderPhase6EvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
      },
    });
    projection.quality = {
      ...projection.quality,
      statusId: 'usable',
      counts: {
        ...projection.quality.counts,
        identity: 99,
      },
    };

    expect(buildPolicyBuilderPhase6EvidenceProjectionAudit(projection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_QUALITY_MISMATCH,
        }),
      ]));
  });

  test('rejects individual projection entries with unknown source or authority', () => {
    const result = validatePolicyBuilderPhase6EvidenceProjectionEntry({
      label: 'Mystery signal',
      sourceId: 'unknown_source',
      authoritySourceId: 'unknown_authority',
    }, PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY);

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_UNKNOWN_SOURCE,
      PHASE6R_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_UNKNOWN_AUTHORITY_SOURCE,
    ]));
  });

  test('rejects metadata evidence as destination identity authority', () => {
    const metadataSource = {
      ...getPolicyBuilderPhase6EvidenceSource(PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT),
      allowedBucketIds: [
        ...getPolicyBuilderPhase6EvidenceSource(PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT)
          .allowedBucketIds,
        PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
      ],
    };

    expect(validatePolicyBuilderPhase6EvidenceSource(metadataSource).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.METADATA_OWNS_POLICY_MEANING,
        }),
      ]));
  });

  test('rejects hard-limit authority that does not come from declared operator intent', () => {
    const hardLimitBucket = {
      ...getPolicyBuilderPhase6EvidenceBucket(PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT),
      authoritySourceIds: [
        AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      ],
    };

    expect(validatePolicyBuilderPhase6EvidenceBucket(hardLimitBucket).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.HARD_LIMIT_WITHOUT_OPERATOR_AUTHORITY,
        }),
      ]));
  });

  test('rejects final-outcome sources that try to learn directly before the learning guard', () => {
    const manualCorrections = {
      ...getPolicyBuilderPhase6EvidenceSource(PHASE6R_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS),
      directLearningAllowed: true,
    };

    expect(validatePolicyBuilderPhase6EvidenceSource(manualCorrections).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.FINAL_OUTCOME_LEARNS_DIRECTLY,
        }),
      ]));
  });

  test('exposes immutable evidence bucket and source contracts', () => {
    const buckets = listPolicyBuilderPhase6EvidenceBuckets();
    const sources = listPolicyBuilderPhase6EvidenceSources();

    expect(Object.isFrozen(buckets)).toBe(true);
    expect(Object.isFrozen(buckets[0])).toBe(true);
    expect(Object.isFrozen(buckets[0].allowedSourceIds)).toBe(true);
    expect(Object.isFrozen(sources)).toBe(true);
    expect(Object.isFrozen(sources[0])).toBe(true);
    expect(Object.isFrozen(sources[0].prohibitedPayloadIds)).toBe(true);
  });
});
