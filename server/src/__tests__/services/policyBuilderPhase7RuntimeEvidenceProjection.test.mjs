import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  PHASE6R_EVIDENCE_BUCKET_IDS,
  PHASE6R_EVIDENCE_SOURCE_IDS,
} from '../../services/policyBuilderPhase6EvidenceEngine.mjs';
import {
  PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS,
  PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS,
  PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS,
  buildPolicyBuilderPhase7RuntimeEvidenceProjection,
  buildPolicyBuilderPhase7RuntimeEvidenceProjectionAudit,
  validatePolicyBuilderPhase7RuntimeEvidenceProjection,
  validateRuntimeEvidenceEntry,
} from '../../services/policyBuilderPhase7RuntimeEvidenceProjection.mjs';
import {
  buildPolicyBuilderPhase7RuntimeEvidenceFingerprint,
} from '../../services/policyBuilderPhase7RuntimeEvidenceFingerprint.mjs';

describe('policyBuilderPhase7RuntimeEvidenceProjection', () => {
  test('projects runtime inputs into Phase 6R evidence buckets', () => {
    const projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
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

    expect(projection.version).toBe('phase7r.runtime_evidence_projection.v1');
    expect(projection.phase6EvidenceVersion).toBe('phase6r.evidence.v1');
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
    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Animated Movies',
          sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
          runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.LIBRARY_PROFILE,
          authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
        }),
      ]));
    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT][0])
      .toEqual(expect.objectContaining({
        label: 'No NC-17',
        sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      }));
    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Radarr Animated',
        }),
        expect.objectContaining({
          label: 'Radarr route mapped',
        }),
      ]));
  });

  test('demotes broad genres without strong identity support to compatibility evidence', () => {
    const projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animation', count: 1, confidence: 0.8 },
        ],
      },
      metadataSignals: [
        { label: 'Comedy', confidence: 0.7 },
      ],
    });

    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY]).toEqual([]);
    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Animation',
          reasonCode: PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.BROAD_GENRE_WITHOUT_IDENTITY,
          demotedFromBucketId: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
        }),
        expect.objectContaining({
          label: 'Comedy',
          reasonCode: PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.BROAD_GENRE_WITHOUT_IDENTITY,
          demotedFromBucketId: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
        }),
      ]));
  });

  test('demotes low-trust and unknown-library RAG neighbors to insufficient evidence', () => {
    const projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
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

    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Unknown neighbor',
          reasonCode: PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.UNKNOWN_LIBRARY_NEIGHBOR,
        }),
        expect.objectContaining({
          label: 'Weak known neighbor',
          reasonCode: PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.LOW_TRUST_RAG_NEIGHBOR,
        }),
      ]));
    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Trusted known neighbor',
          runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.RAG_NEIGHBOR,
          trusted: true,
        }),
      ]));
  });

  test('treats stale profile and failed routing as insufficient evidence', () => {
    const projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
      profileFreshness: {
        stale: true,
        updatedAt: '2026-05-01T12:00:00.000Z',
      },
      routingOutcomes: [
        { label: 'Radarr missing mapping', routed: false },
      ],
    });

    expect(projection.buckets[PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Profile is stale',
          reasonCode: PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.STALE_PROFILE,
          stale: true,
        }),
        expect.objectContaining({
          label: 'Radarr missing mapping',
          reasonCode: PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.ROUTING_NOT_PROVEN,
          demotedFromBucketId: PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING,
        }),
      ]));
  });

  test('suppresses raw provider payloads and records bounded warnings', () => {
    const projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
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
        reasonCode: PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.RAW_PAYLOAD_SUPPRESSED,
      }),
    ]));
  });

  test('passes the default runtime evidence projection audit', () => {
    const projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 12, confidence: 0.93, trusted: true },
        ],
      },
    });
    const audit = buildPolicyBuilderPhase7RuntimeEvidenceProjectionAudit(projection);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedEntryCount).toBe(1);
    expect(audit.checkedBucketCount).toBe(8);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '7r_3',
      label: 'Automation Decision Contract',
    }));
  });

  test('builds stable sanitized runtime evidence fingerprints', () => {
    const projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
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
    const reorderedProjection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
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
    const changedProjection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
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
    expect(buildPolicyBuilderPhase7RuntimeEvidenceFingerprint(projection))
      .toEqual(projection.projectionFingerprint);
    expect(projection.projectionFingerprint.provenance).toEqual(expect.objectContaining({
      totalEntryCount: 3,
      sourceIds: expect.arrayContaining([
        PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
        PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      ]),
      runtimeSourceIds: expect.arrayContaining([
        PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.LIBRARY_PROFILE,
        PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.METADATA_SIGNAL,
      ]),
      authoritySourceIds: expect.arrayContaining([
        AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
        AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      ]),
    }));
  });

  test('rejects unsafe runtime evidence entries and projections', () => {
    expect(validateRuntimeEvidenceEntry({
      bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
      sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      label: 'Animation',
      reasonCode: 'metadata_identity',
      includesRawPayload: true,
      liveLookupPerformed: true,
      exposesUiLanguage: true,
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.LIVE_LOOKUP_USED,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.UI_LANGUAGE_EXPOSED,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.BROAD_GENRE_PROMOTED_TO_IDENTITY,
      }),
    ]));

    expect(validatePolicyBuilderPhase7RuntimeEvidenceProjection({
      generatedFromLiveProvider: true,
      exposesRawProviderPayloads: true,
      exposesUiChipLanguage: true,
      buckets: {},
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.LIVE_LOOKUP_USED,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.UI_LANGUAGE_EXPOSED,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.MISSING_PROJECTION_FINGERPRINT,
      }),
    ]));
  });

  test('rejects projection fingerprint provenance that exposes raw evidence labels', () => {
    const projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
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

    expect(validatePolicyBuilderPhase7RuntimeEvidenceProjection(unsafeProjection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.RAW_PROVENANCE_EXPOSED,
        }),
      ]));
  });

  test('rejects stale or malformed projection fingerprints', () => {
    const projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
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

    expect(validatePolicyBuilderPhase7RuntimeEvidenceProjection(staleProjection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .PROJECTION_FINGERPRINT_MISMATCH,
        }),
        expect.objectContaining({
          riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .PROJECTION_FINGERPRINT_TRACE_MISMATCH,
        }),
      ]));
    expect(validatePolicyBuilderPhase7RuntimeEvidenceProjection(malformedProjection).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .MALFORMED_PROJECTION_FINGERPRINT,
        }),
      ]));
  });

  test('rejects mismatched projection fingerprint provenance and trace attributes', () => {
    const projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection({
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

    expect(validatePolicyBuilderPhase7RuntimeEvidenceProjection(provenanceMismatch).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .PROJECTION_FINGERPRINT_PROVENANCE_MISMATCH,
        }),
      ]));
    expect(validatePolicyBuilderPhase7RuntimeEvidenceProjection(traceMismatch).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
            .PROJECTION_FINGERPRINT_TRACE_MISMATCH,
        }),
      ]));
  });
});
