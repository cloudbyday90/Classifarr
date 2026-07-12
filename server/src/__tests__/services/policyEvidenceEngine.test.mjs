import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  POLICY_UX_TERM_IDS,
} from '../../services/policyUserMentalModel.mjs';
import {
  buildPolicyEvidenceFingerprint,
} from '../../services/policyEvidenceFingerprint.mjs';
import {
  POLICY_EVIDENCE_AUDIT_RISK_IDS,
  POLICY_EVIDENCE_BUCKET_IDS,
  POLICY_EVIDENCE_BUCKET_READINESS_IDS,
  POLICY_EVIDENCE_PROHIBITED_PAYLOAD_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
  buildPolicyEvidenceEngineAudit,
  buildPolicyEvidenceProjection,
  buildPolicyEvidenceProjectionAudit,
  getPolicyEvidenceBucket,
  getPolicyEvidenceSource,
  listPolicyEvidenceBuckets,
  listPolicyEvidenceSources,
  summarizePolicyEvidenceProjection,
  validatePolicyEvidenceBucket,
  validatePolicyEvidenceProjectionEntry,
  validatePolicyEvidenceSource,
} from '../../services/policyEvidenceEngine.mjs';

describe('policyEvidenceEngine', () => {
  test('defines stable policy evidence buckets in roadmap order', () => {
    expect(listPolicyEvidenceBuckets().map(bucket => bucket.id)).toEqual([
      POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
      POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
      POLICY_EVIDENCE_BUCKET_IDS.AVOID,
      POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
      POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS,
      POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ]);

    const identity = getPolicyEvidenceBucket(POLICY_EVIDENCE_BUCKET_IDS.IDENTITY);
    expect(identity.uxTermIds).toEqual([POLICY_UX_TERM_IDS.BELONGS_HERE]);
    expect(identity.authoritySourceIds).toEqual([
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(identity.traceAttribute).toBe('classifarr.policy.evidence.identity');
  });

  test('defines evidence sources without live lookups, raw payloads, UI language, or transient quota state', () => {
    listPolicyEvidenceSources().forEach(source => {
      expect(source.liveLookupAllowed).toBe(false);
      expect(source.exposesRawPayload).toBe(false);
      expect(source.exposesUiLanguage).toBe(false);
      expect(source.transientStateAllowed).toBe(false);
      expect(source.prohibitedPayloadIds).toEqual(expect.arrayContaining([
        POLICY_EVIDENCE_PROHIBITED_PAYLOAD_IDS.RAW_PROVIDER_PAYLOAD,
        POLICY_EVIDENCE_PROHIBITED_PAYLOAD_IDS.LIVE_PROVIDER_LOOKUP,
        POLICY_EVIDENCE_PROHIBITED_PAYLOAD_IDS.PROVIDER_QUOTA_STATE,
        POLICY_EVIDENCE_PROHIBITED_PAYLOAD_IDS.UI_CHIP_LANGUAGE,
        POLICY_EVIDENCE_PROHIBITED_PAYLOAD_IDS.REPLAY_PREVIEW_PAYLOAD,
        POLICY_EVIDENCE_PROHIBITED_PAYLOAD_IDS.IMPACT_PREVIEW_PAYLOAD,
      ]));
    });

    expect(getPolicyEvidenceSource(POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT)
      .allowedBucketIds)
      .not.toContain(POLICY_EVIDENCE_BUCKET_IDS.IDENTITY);
  });

  test('keeps hard limits and avoid evidence tied to operator-declared intent only', () => {
    const hardLimit = getPolicyEvidenceBucket(POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT);
    const avoid = getPolicyEvidenceBucket(POLICY_EVIDENCE_BUCKET_IDS.AVOID);

    expect(hardLimit.authoritySourceIds).toEqual([AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT]);
    expect(hardLimit.allowedSourceIds).toEqual([
      POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(avoid.authoritySourceIds).toEqual([AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT]);
    expect(avoid.allowedSourceIds).toEqual([
      POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
  });

  test('builds a deterministic offline evidence projection and strips raw provider payloads', () => {
    const projection = buildPolicyEvidenceProjection({
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
    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Animation',
          sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
          authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
          includesRawPayload: false,
          liveLookupPerformed: false,
        }),
        expect.objectContaining({
          label: 'Animated Movies',
          sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
          authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        }),
      ]));
    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT][0])
      .toEqual(expect.objectContaining({
        label: 'No NC-17',
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      }));
    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'TMDB genre: Animation',
          sourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
          authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
          includesRawPayload: false,
        }),
      ]));
    expect(JSON.stringify(projection)).not.toContain('providerPayload');
    expect(JSON.stringify(projection)).not.toContain('quotaState');
    expect(JSON.stringify(projection)).not.toContain('uiChipLabel');
    expect(projection.summary).toEqual(expect.objectContaining({
      version: 'policy.evidence.summary.v1',
      totalEntryCount: 9,
      hasBlockingEvidence: true,
      hasReviewEvidence: true,
    }));
    expect(projection.quality).toEqual(expect.objectContaining({
      version: 'policy.evidence.quality.v1',
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
        bucketId: POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
        entryCount: 1,
        readinessId: POLICY_EVIDENCE_BUCKET_READINESS_IDS.BLOCKING,
      }),
      expect.objectContaining({
        bucketId: POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
        entryCount: 1,
        readinessId: POLICY_EVIDENCE_BUCKET_READINESS_IDS.REVIEW,
      }),
    ]));
  });

  test('builds a bounded evidence summary for downstream engines', () => {
    const projection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
        compatibilityCandidates: ['Family'],
      },
      operatorIntent: {
        hardLimits: ['No NC-17'],
      },
    });

    const summary = summarizePolicyEvidenceProjection(projection);

    expect(summary).toEqual(projection.summary);
    expect(summary.sourceIds).toEqual([
      POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(summary.authoritySourceIds).toEqual([
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(summary.blockingBucketIds).toEqual([
      POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
    ]);
  });

  test('consolidates exact duplicate facts without merging distinct provenance', () => {
    const duplicateProjection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation', 'Animation'],
      },
      metadataEvidence: ['Family', 'Family'],
    });
    const uniqueProjection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
      },
      metadataEvidence: ['Family'],
    });
    const distinctProvenanceProjection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
      },
      operatorIntent: {
        belongsHere: ['Animation'],
      },
    });

    expect(duplicateProjection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY]).toHaveLength(1);
    expect(duplicateProjection.buckets[POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY]).toHaveLength(1);
    expect(duplicateProjection.summary.totalEntryCount).toBe(2);
    expect(buildPolicyEvidenceFingerprint(duplicateProjection).fingerprint)
      .toBe(buildPolicyEvidenceFingerprint(uniqueProjection).fingerprint);
    expect(distinctProvenanceProjection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY])
      .toHaveLength(2);
  });

  test('treats stale profiles and missing input as insufficient evidence instead of exclusions', () => {
    const staleProjection = buildPolicyEvidenceProjection({
      profileFreshness: {
        stale: true,
        updatedAt: '2026-05-01T12:00:00.000Z',
      },
    });

    expect(staleProjection.buckets[POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT][0])
      .toEqual(expect.objectContaining({
        label: 'Profile is stale',
        reasonCode: 'stale_profile',
        stale: true,
      }));
    expect(staleProjection.buckets[POLICY_EVIDENCE_BUCKET_IDS.AVOID]).toEqual([]);

    const emptyProjection = buildPolicyEvidenceProjection();
    expect(emptyProjection.warnings).toEqual([
      expect.objectContaining({
        bucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
        reasonCode: 'no_evidence_inputs',
      }),
    ]);
  });

  test('passes the default evidence engine audit', () => {
    const audit = buildPolicyEvidenceEngineAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedBucketCount).toBe(8);
    expect(audit.checkedSourceCount).toBe(8);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'intent_inference',
      label: 'Intent Engine',
    }));
  });

  test('audits generated evidence projections as safe contract instances', () => {
    const projection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
        compatibilityCandidates: ['Family'],
      },
      operatorIntent: {
        hardLimits: ['No NC-17'],
      },
    });

    const audit = buildPolicyEvidenceProjectionAudit(projection);

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      checkedEntryCount: 3,
      issues: [],
    }));
  });

  test('rejects tampered projections that leak payloads, live lookups, or invalid authority', () => {
    const projection = buildPolicyEvidenceProjection({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
    });
    projection.generatedFromLiveProvider = true;
    projection.exposesRawProviderPayloads = true;
    projection.exposesUiChipLanguage = true;
    projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY].push({
      label: 'Provider gate identity chip',
      sourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      includesRawPayload: true,
      liveLookupPerformed: true,
      raw: { providerPayload: { id: 16 } },
    });
    projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT].push({
      label: 'Provider hard limit',
      sourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    });
    projection.summary.totalEntryCount = 1;

    const riskIds = buildPolicyEvidenceProjectionAudit(projection)
      .issues
      .map(issue => issue.riskId);

    expect(riskIds).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_USED_LIVE_PROVIDER,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_EXPOSES_RAW_PAYLOAD,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_EXPOSES_UI_LANGUAGE,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_SOURCE_NOT_ALLOWED,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_AUTHORITY_NOT_ALLOWED,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_RAW_PAYLOAD,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_LIVE_LOOKUP,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_HARD_LIMIT_WITHOUT_OPERATOR_AUTHORITY,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_METADATA_OWNS_IDENTITY,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_SUMMARY_COUNT_MISMATCH,
    ]));
  });

  test('rejects projections without generated summaries', () => {
    const projection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
      },
    });
    delete projection.summary;

    expect(buildPolicyEvidenceProjectionAudit(projection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_MISSING_SUMMARY,
        }),
      ]));
  });

  test('rejects projections with stale quality assessments', () => {
    const projection = buildPolicyEvidenceProjection({
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

    expect(buildPolicyEvidenceProjectionAudit(projection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_QUALITY_MISMATCH,
        }),
      ]));
  });

  test('rejects tampered evidence entries that bypass the bounded entry contract', () => {
    const projection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
      },
    });
    projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY][0] = {
      ...projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY][0],
      label: 'Animation\nprovider diagnostic',
      reasonCode: 'not a canonical reason',
    };

    expect(buildPolicyEvidenceProjectionAudit(projection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_FIELD_CONTRACT,
        }),
      ]));
  });

  test('rejects individual projection entries with unknown source or authority', () => {
    const result = validatePolicyEvidenceProjectionEntry({
      label: 'Mystery signal',
      sourceId: 'unknown_source',
      authoritySourceId: 'unknown_authority',
    }, POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY);

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_UNKNOWN_SOURCE,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_UNKNOWN_AUTHORITY_SOURCE,
    ]));
  });

  test('rejects a projection entry whose authority is not allowed by its source', () => {
    const projection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animated Movies'],
      },
    });
    projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY][0] = {
      ...projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY][0],
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    };

    expect(buildPolicyEvidenceProjectionAudit(projection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_SOURCE_AUTHORITY_NOT_ALLOWED,
        }),
      ]));
  });

  test('rejects tampered projections that contain duplicate canonical entries', () => {
    const projection = buildPolicyEvidenceProjection({
      libraryProfile: {
        identityCandidates: ['Animation'],
      },
    });
    projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY].push({
      ...projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY][0],
    });

    expect(buildPolicyEvidenceProjectionAudit(projection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_DUPLICATE_ENTRY,
        }),
      ]));
  });

  test('rejects metadata evidence as destination identity authority', () => {
    const metadataSource = {
      ...getPolicyEvidenceSource(POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT),
      allowedBucketIds: [
        ...getPolicyEvidenceSource(POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT)
          .allowedBucketIds,
        POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
      ],
    };

    expect(validatePolicyEvidenceSource(metadataSource).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.METADATA_OWNS_POLICY_MEANING,
        }),
      ]));
  });

  test('rejects hard-limit authority that does not come from declared operator intent', () => {
    const hardLimitBucket = {
      ...getPolicyEvidenceBucket(POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT),
      authoritySourceIds: [
        AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      ],
    };

    expect(validatePolicyEvidenceBucket(hardLimitBucket).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.HARD_LIMIT_WITHOUT_OPERATOR_AUTHORITY,
        }),
      ]));
  });

  test('rejects final-outcome sources that try to learn directly before the learning guard', () => {
    const manualCorrections = {
      ...getPolicyEvidenceSource(POLICY_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS),
      directLearningAllowed: true,
    };

    expect(validatePolicyEvidenceSource(manualCorrections).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.FINAL_OUTCOME_LEARNS_DIRECTLY,
        }),
      ]));
  });

  test('exposes immutable evidence bucket and source contracts', () => {
    const buckets = listPolicyEvidenceBuckets();
    const sources = listPolicyEvidenceSources();

    expect(Object.isFrozen(buckets)).toBe(true);
    expect(Object.isFrozen(buckets[0])).toBe(true);
    expect(Object.isFrozen(buckets[0].allowedSourceIds)).toBe(true);
    expect(Object.isFrozen(sources)).toBe(true);
    expect(Object.isFrozen(sources[0])).toBe(true);
    expect(Object.isFrozen(sources[0].prohibitedPayloadIds)).toBe(true);
  });
});
