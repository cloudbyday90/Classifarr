import {
  PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES,
  PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_VERSION,
  buildPolicyBuilderPhase6EvidenceProjectionFingerprint,
  stableStringify,
} from '../../services/policyBuilderPhase6EvidenceProjectionFingerprint.mjs';

describe('policyBuilderPhase6EvidenceProjectionFingerprint', () => {
  test('stableStringify sorts object keys recursively', () => {
    expect(stableStringify({
      b: 2,
      a: {
        z: 1,
        y: [2, { b: 'right', a: 'left' }],
      },
    })).toBe(stableStringify({
      a: {
        y: [2, { a: 'left', b: 'right' }],
        z: 1,
      },
      b: 2,
    }));
  });

  test('builds stable projection fingerprints with sanitized provenance', () => {
    const projection = {
      version: 'phase6r.evidence.v1',
      generatedFromLiveProvider: false,
      exposesRawProviderPayloads: false,
      exposesUiChipLanguage: false,
      buckets: {
        identity_evidence: [
          {
            bucketId: 'identity_evidence',
            sourceId: 'media_server_library_profile',
            authoritySourceId: 'media_server_contents',
            label: 'Animation',
          },
        ],
      },
      warnings: [],
      summary: {
        version: 'phase6r.evidence.summary.v1',
        totalEntryCount: 1,
        sourceIds: ['media_server_library_profile'],
        authoritySourceIds: ['media_server_contents'],
        bucketSummaries: [
          {
            bucketId: 'identity_evidence',
            entryCount: 1,
            readinessId: 'supporting',
          },
        ],
        hasBlockingEvidence: false,
        hasReviewEvidence: false,
      },
    };

    const left = buildPolicyBuilderPhase6EvidenceProjectionFingerprint(projection);
    const right = buildPolicyBuilderPhase6EvidenceProjectionFingerprint({
      summary: projection.summary,
      warnings: [],
      buckets: projection.buckets,
      exposesUiChipLanguage: false,
      exposesRawProviderPayloads: false,
      generatedFromLiveProvider: false,
      version: 'phase6r.evidence.v1',
    });

    expect(left).toEqual(right);
    expect(left).toEqual(expect.objectContaining({
      version: PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_VERSION,
      algorithm: 'sha256',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      provenance: expect.objectContaining({
        totalEntryCount: 1,
        sourceIds: ['media_server_library_profile'],
        authoritySourceIds: ['media_server_contents'],
        bucketCounts: [
          {
            bucketId: 'identity_evidence',
            entryCount: 1,
            readinessId: 'supporting',
          },
        ],
      }),
    }));
    expect(Object.keys(left.traceAttributes)).toEqual(expect.arrayContaining([
      PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES.FINGERPRINT,
      PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES.PROJECTION_VERSION,
      PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES.TOTAL_ENTRY_COUNT,
      PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES.SOURCE_IDS,
      PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES.AUTHORITY_SOURCE_IDS,
    ]));
    expect(JSON.stringify(left)).not.toContain('Animation');
  });

  test('changes the fingerprint when projection evidence changes', () => {
    const baseProjection = {
      version: 'phase6r.evidence.v1',
      buckets: {
        identity_evidence: [{ label: 'Animation' }],
      },
      warnings: [],
      summary: {
        totalEntryCount: 1,
        sourceIds: ['media_server_library_profile'],
        authoritySourceIds: ['media_server_contents'],
        bucketSummaries: [{ bucketId: 'identity_evidence', entryCount: 1 }],
      },
    };
    const changedProjection = {
      ...baseProjection,
      buckets: {
        identity_evidence: [{ label: 'Animation' }, { label: 'Family' }],
      },
      summary: {
        ...baseProjection.summary,
        totalEntryCount: 2,
        bucketSummaries: [{ bucketId: 'identity_evidence', entryCount: 2 }],
      },
    };

    expect(buildPolicyBuilderPhase6EvidenceProjectionFingerprint(baseProjection).fingerprint)
      .not.toBe(buildPolicyBuilderPhase6EvidenceProjectionFingerprint(changedProjection).fingerprint);
  });
});
