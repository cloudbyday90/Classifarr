import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  POLICY_EVIDENCE_BUCKET_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
} from '../../services/policyEvidenceEngine.mjs';
import {
  POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS,
  POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS,
  POLICY_RUNTIME_EVIDENCE_SOURCE_IDS,
  buildPolicyRuntimeEvidenceProjection,
  buildPolicyRuntimeEvidenceProjectionAudit,
  validatePolicyRuntimeEvidenceProjection,
  validateRuntimeEvidenceEntry,
} from '../../services/policyRuntimeEvidenceProjection.mjs';
import {
  buildPolicyRuntimeEvidenceFingerprint,
} from '../../services/policyRuntimeEvidenceFingerprint.mjs';

describe('policyRuntimeEvidenceProjection', () => {
  test('projects runtime inputs into policy evidence buckets', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 12, confidence: 0.93, trusted: true },
        ],
        compatibilityCandidates: ['Disney'],
      },
      operatorIntent: {
        hardLimits: ['No NC-17'],
        routingTargets: ['Radarr Animated'],
      },
      classificationFinalOutcomes: ['Mulan routed here'],
      routingOutcomes: [{ label: 'Radarr route mapped', routed: true }],
      profileFreshness: {
        stale: false,
        updatedAt: '2026-06-30T12:00:00.000Z',
      },
    });

    expect(projection.version).toBe('policy.runtime_evidence_projection.v1');
    expect(projection.evidenceVersion).toBe('policy.evidence.v1');
    expect(projection.generatedFromLiveProvider).toBe(false);
    expect(projection.exposesRawProviderPayloads).toBe(false);
    expect(projection.projectionFingerprint).toEqual(expect.objectContaining({
      algorithm: 'sha256',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      provenance: expect.objectContaining({
        totalEntryCount: expect.any(Number),
        sourceIds: expect.any(Array),
        runtimeSourceIds: expect.any(Array),
        authoritySourceIds: expect.any(Array),
      }),
    }));
    expect(JSON.stringify(projection.projectionFingerprint)).not.toContain('Animated Movies');
    expect(JSON.stringify(projection.projectionFingerprint)).not.toContain('Radarr route mapped');
    expect(projection.operatorIntentBoundary).toEqual(expect.objectContaining({
      ok: true,
      statusId: 'ready',
      projectionFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Animated Movies',
          sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
          runtimeSourceId: POLICY_RUNTIME_EVIDENCE_SOURCE_IDS.LIBRARY_PROFILE,
          authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
        }),
      ]));
    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT][0])
      .toEqual(expect.objectContaining({
        label: 'No NC-17',
        sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      }));
    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.ROUTING])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Radarr Animated',
        }),
        expect.objectContaining({
          label: 'Radarr route mapped',
        }),
      ]));
  });

  test('excludes operator intent when its bounded evidence handoff is rejected', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [{
          label: 'Animated Movies',
          count: 12,
          trusted: true,
        }],
      },
      operatorIntent: {
        hardLimits: [{
          label: 'No NC-17',
          value: {
            providerPayload: { apiKey: 'must-not-escape' },
          },
        }],
      },
    });

    expect(projection.operatorIntentBoundary).toEqual({
      statusId: 'blocked_by_input_gate',
      ok: false,
      riskIds: ['raw_provider_payload'],
      projectionFingerprint: null,
    });
    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT]).toEqual([]);
    expect(projection.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.OPERATOR_INTENT_BOUNDARY_BLOCKED,
      }),
    ]));
    expect(JSON.stringify(projection)).not.toContain('must-not-escape');
    expect(validatePolicyRuntimeEvidenceProjection(projection).ok).toBe(true);
  });

  test('rejects operator intent evidence added after a blocked boundary', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      operatorIntent: {
        hardLimits: [{
          label: 'No NC-17',
          value: { providerPayload: { title: 'raw' } },
        }],
      },
    });

    projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT].push({
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
      sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      runtimeSourceId: POLICY_RUNTIME_EVIDENCE_SOURCE_IDS.OPERATOR_INTENT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      key: 'rating:nc17',
      label: 'No NC-17',
      reasonCode: 'runtime_operator_intent',
    });

    expect(validatePolicyRuntimeEvidenceProjection(projection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.BLOCKED_OPERATOR_INTENT_CONSUMED,
        }),
      ]));
  });

  test('rejects a blocked operator intent boundary that claims readiness', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({});
    projection.operatorIntentBoundary = {
      statusId: 'ready',
      ok: false,
      riskIds: [],
      projectionFingerprint: 'a'.repeat(64),
    };

    expect(validatePolicyRuntimeEvidenceProjection(projection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.INVALID_OPERATOR_INTENT_BOUNDARY,
        }),
      ]));
  });

  test('demotes broad genres without strong identity support to compatibility evidence', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animation', count: 1, confidence: 0.8 },
        ],
      },
      metadataSignals: [
        { label: 'Comedy', confidence: 0.7 },
      ],
    });

    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY]).toEqual([]);
    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Animation',
          reasonCode: POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.BROAD_GENRE_WITHOUT_IDENTITY,
          demotedFromBucketId: POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
        }),
        expect.objectContaining({
          label: 'Comedy',
          reasonCode: POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.BROAD_GENRE_WITHOUT_IDENTITY,
          demotedFromBucketId: POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
        }),
      ]));
  });

  test('demotes low-trust and unknown-library RAG neighbors to insufficient evidence', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      ragNeighbors: [
        {
          label: 'Unknown neighbor',
          libraryName: 'Unknown library',
          similarity: 0.82,
          trusted: false,
        },
        {
          label: 'Weak known neighbor',
          libraryName: 'Movies',
          similarity: 0.76,
          trusted: false,
          compatibleProfile: false,
        },
        {
          label: 'Trusted known neighbor',
          libraryName: 'Animated Movies',
          similarity: 0.91,
          trusted: true,
          compatibleProfile: true,
        },
      ],
    });

    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Unknown neighbor',
          reasonCode: POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.UNKNOWN_LIBRARY_NEIGHBOR,
        }),
        expect.objectContaining({
          label: 'Weak known neighbor',
          reasonCode: POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.LOW_TRUST_RAG_NEIGHBOR,
        }),
      ]));
    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Trusted known neighbor',
          runtimeSourceId: POLICY_RUNTIME_EVIDENCE_SOURCE_IDS.RAG_NEIGHBOR,
          trusted: true,
        }),
      ]));
  });

  test('treats stale profile and failed routing as insufficient evidence', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      profileFreshness: {
        stale: true,
        updatedAt: '2026-05-01T12:00:00.000Z',
      },
      routingOutcomes: [
        { label: 'Radarr missing mapping', routed: false },
      ],
    });

    expect(projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Profile is stale',
          reasonCode: POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.STALE_PROFILE,
          stale: true,
        }),
        expect.objectContaining({
          label: 'Radarr missing mapping',
          reasonCode: POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.ROUTING_NOT_PROVEN,
          demotedFromBucketId: POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
        }),
      ]));
  });

  test('suppresses raw provider payloads and records bounded warnings', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      metadataSignals: [
        {
          label: 'TMDB keyword: princess',
          confidence: 0.72,
          providerPayload: { id: 123, raw: true },
        },
      ],
    });

    expect(JSON.stringify(projection)).not.toContain('providerPayload');
    expect(JSON.stringify(projection)).not.toContain('"raw":true');
    expect(projection.exposesRawProviderPayloads).toBe(false);
    expect(projection.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.RAW_PAYLOAD_SUPPRESSED,
      }),
    ]));
  });

  test('normalizes runtime entry fields through the shared evidence entry contract', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      metadataSignals: [{
        label: '  TMDB keyword:\nprincess  ',
        confidence: 72,
        observedAt: '2026-06-30T12:00:00-04:00',
      }],
    });
    const entry = projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY][0];

    expect(entry).toEqual(expect.objectContaining({
      key: 'tmdb_keyword:princess',
      label: 'TMDB keyword: princess',
      confidence: 0.72,
      observedAt: '2026-06-30T16:00:00.000Z',
    }));
    expect(validatePolicyRuntimeEvidenceProjection(projection).ok).toBe(true);
  });

  test('rejects runtime entries with incompatible source authority or unbounded fields', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      metadataSignals: ['TMDB keyword: princess'],
    });
    const entry = projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY][0];

    projection.buckets[POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY][0] = {
      ...entry,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      label: `TMDB ${'x'.repeat(300)}`,
    };

    expect(validatePolicyRuntimeEvidenceProjection(projection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.SOURCE_AUTHORITY_NOT_ALLOWED,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.ENTRY_FIELD_CONTRACT,
        }),
      ]));
  });

  test('passes the default runtime evidence projection audit', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 12, confidence: 0.93, trusted: true },
        ],
      },
    });
    const audit = buildPolicyRuntimeEvidenceProjectionAudit(projection);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedEntryCount).toBe(1);
    expect(audit.checkedBucketCount).toBe(8);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'automation_decision_contract',
      label: 'Automation Decision Contract',
    }));
  });

  test('builds stable sanitized runtime evidence fingerprints', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 12, confidence: 0.93, trusted: true },
        ],
        compatibilityCandidates: ['Disney'],
      },
      metadataSignals: [
        { label: 'TMDB keyword: princess', confidence: 0.72 },
      ],
    });
    const reorderedProjection = buildPolicyRuntimeEvidenceProjection({
      metadataSignals: [
        { label: 'TMDB keyword: princess', confidence: 0.72 },
      ],
      libraryProfile: {
        compatibilityCandidates: ['Disney'],
        identityCandidates: [
          { trusted: true, confidence: 0.93, count: 12, label: 'Animated Movies' },
        ],
      },
    });
    const changedProjection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 13, confidence: 0.93, trusted: true },
        ],
        compatibilityCandidates: ['Disney'],
      },
      metadataSignals: [
        { label: 'TMDB keyword: princess', confidence: 0.72 },
      ],
    });

    expect(projection.projectionFingerprint.fingerprint)
      .toBe(reorderedProjection.projectionFingerprint.fingerprint);
    expect(projection.projectionFingerprint.fingerprint)
      .not.toBe(changedProjection.projectionFingerprint.fingerprint);
    expect(buildPolicyRuntimeEvidenceFingerprint(projection))
      .toEqual(projection.projectionFingerprint);
    expect(projection.projectionFingerprint.provenance).toEqual(expect.objectContaining({
      totalEntryCount: 3,
      sourceIds: expect.arrayContaining([
        POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
        POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      ]),
      runtimeSourceIds: expect.arrayContaining([
        POLICY_RUNTIME_EVIDENCE_SOURCE_IDS.LIBRARY_PROFILE,
        POLICY_RUNTIME_EVIDENCE_SOURCE_IDS.METADATA_SIGNAL,
      ]),
      authoritySourceIds: expect.arrayContaining([
        AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
        AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      ]),
    }));
  });

  test('rejects unsafe runtime evidence entries and projections', () => {
    expect(validateRuntimeEvidenceEntry({
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
      sourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      label: 'Animation',
      reasonCode: 'metadata_identity',
      includesRawPayload: true,
      liveLookupPerformed: true,
      exposesUiLanguage: true,
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.LIVE_LOOKUP_USED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.UI_LANGUAGE_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.BROAD_GENRE_PROMOTED_TO_IDENTITY,
      }),
    ]));

    expect(validatePolicyRuntimeEvidenceProjection({
      generatedFromLiveProvider: true,
      exposesRawProviderPayloads: true,
      exposesUiChipLanguage: true,
      buckets: {},
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.LIVE_LOOKUP_USED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.UI_LANGUAGE_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.MISSING_PROJECTION_FINGERPRINT,
      }),
    ]));
  });

  test('rejects projection fingerprint provenance that exposes raw evidence labels', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 12, confidence: 0.93, trusted: true },
        ],
      },
    });
    const unsafeProjection = {
      ...projection,
      projectionFingerprint: {
        ...projection.projectionFingerprint,
        provenance: {
          ...projection.projectionFingerprint.provenance,
          rawLabel: 'Animated Movies',
        },
      },
    };

    expect(validatePolicyRuntimeEvidenceProjection(unsafeProjection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.RAW_PROVENANCE_EXPOSED,
        }),
      ]));
  });

  test('rejects stale or malformed projection fingerprints', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 12, confidence: 0.93, trusted: true },
        ],
      },
    });
    const staleProjection = {
      ...projection,
      projectionFingerprint: {
        ...projection.projectionFingerprint,
        fingerprint: '0'.repeat(64),
      },
    };
    const malformedProjection = {
      ...projection,
      projectionFingerprint: {
        ...projection.projectionFingerprint,
        fingerprint: 'not-a-sha256-digest',
      },
    };

    expect(validatePolicyRuntimeEvidenceProjection(staleProjection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .PROJECTION_FINGERPRINT_MISMATCH,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .PROJECTION_FINGERPRINT_TRACE_MISMATCH,
        }),
      ]));
    expect(validatePolicyRuntimeEvidenceProjection(malformedProjection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .MALFORMED_PROJECTION_FINGERPRINT,
        }),
      ]));
  });

  test('rejects mismatched projection fingerprint provenance and trace attributes', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 12, confidence: 0.93, trusted: true },
        ],
      },
    });
    const provenanceMismatch = {
      ...projection,
      projectionFingerprint: {
        ...projection.projectionFingerprint,
        provenance: {
          ...projection.projectionFingerprint.provenance,
          totalEntryCount: 99,
        },
      },
    };
    const traceMismatch = {
      ...projection,
      trace: {
        ...projection.trace,
        attributes: {
          ...projection.trace.attributes,
          'classifarr.runtime.evidence.projection_fingerprint': '1'.repeat(64),
        },
      },
    };

    expect(validatePolicyRuntimeEvidenceProjection(provenanceMismatch).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .PROJECTION_FINGERPRINT_PROVENANCE_MISMATCH,
        }),
      ]));
    expect(validatePolicyRuntimeEvidenceProjection(traceMismatch).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .PROJECTION_FINGERPRINT_TRACE_MISMATCH,
        }),
      ]));
  });

  test('rejects forged warning content, trace reasons, and trace summary attributes', () => {
    const projection = buildPolicyRuntimeEvidenceProjection({
      metadataSignals: [{
        label: 'TMDB keyword: princess',
        providerPayload: { secret: 'do-not-leak' },
      }],
    });
    const forgedProjection = {
      ...projection,
      warnings: [{
        ...projection.warnings[0],
        message: 'raw=do-not-leak',
      }],
      trace: {
        ...projection.trace,
        reasons: [],
        attributes: {
          ...projection.trace.attributes,
          'classifarr.runtime.evidence.entry_count': 999,
          'classifarr.runtime.evidence.unbounded_context': 'do-not-leak',
        },
      },
    };

    expect(validatePolicyRuntimeEvidenceProjection(forgedProjection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.WARNING_CONTRACT_MISMATCH,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.TRACE_REASON_MISMATCH,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .PROJECTION_FINGERPRINT_TRACE_MISMATCH,
        }),
      ]));
  });
});
