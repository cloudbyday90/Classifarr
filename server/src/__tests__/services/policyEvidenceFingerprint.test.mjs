import {
  POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS,
  POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES,
  POLICY_EVIDENCE_FINGERPRINT_VERSION,
  buildPolicyEvidenceFingerprint,
  stableStringify,
  validatePolicyEvidenceFingerprint,
} from '../../services/policyEvidenceFingerprint.mjs';

describe('policyEvidenceFingerprint', () => {
  const buildProjection = () => ({
    version: 'policy.evidence.v1',
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
      version: 'policy.evidence.summary.v1',
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
  });

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
    const projection = buildProjection();

    const left = buildPolicyEvidenceFingerprint(projection);
    const right = buildPolicyEvidenceFingerprint({
      summary: projection.summary,
      warnings: [],
      buckets: projection.buckets,
      exposesUiChipLanguage: false,
      exposesRawProviderPayloads: false,
      generatedFromLiveProvider: false,
      version: 'policy.evidence.v1',
    });

    expect(left).toEqual(right);
    expect(left).toEqual(expect.objectContaining({
      version: POLICY_EVIDENCE_FINGERPRINT_VERSION,
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
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.FINGERPRINT,
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.PROJECTION_VERSION,
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.TOTAL_ENTRY_COUNT,
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.SOURCE_IDS,
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.AUTHORITY_SOURCE_IDS,
    ]));
    expect(JSON.stringify(left)).not.toContain('Animation');
  });

  test('keeps fingerprints stable when equivalent bucket entries arrive out of order', () => {
    const projection = {
      ...buildProjection(),
      buckets: {
        identity_evidence: [
          {
            bucketId: 'identity_evidence',
            sourceId: 'operator_declared_intent',
            authoritySourceId: 'operator_declared_intent',
            label: 'Family',
          },
          ...buildProjection().buckets.identity_evidence,
        ],
      },
      summary: {
        ...buildProjection().summary,
        totalEntryCount: 2,
        sourceIds: ['media_server_library_profile', 'operator_declared_intent'],
        authoritySourceIds: ['media_server_contents', 'operator_declared_intent'],
        bucketSummaries: [{
          bucketId: 'identity_evidence',
          entryCount: 2,
          readinessId: 'supporting',
        }],
      },
    };
    const reorderedProjection = {
      ...projection,
      buckets: {
        identity_evidence: [...projection.buckets.identity_evidence].reverse(),
      },
    };

    expect(buildPolicyEvidenceFingerprint(projection).fingerprint)
      .toBe(buildPolicyEvidenceFingerprint(reorderedProjection).fingerprint);
  });

  test('validates projection fingerprints against projection, trace, and provenance', () => {
    const projection = buildProjection();
    const projectionFingerprint =
      buildPolicyEvidenceFingerprint(projection);

    expect(validatePolicyEvidenceFingerprint({
      projection,
      projectionFingerprint,
    })).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('rejects stale, malformed, trace-mismatched, and provenance-mismatched fingerprints', () => {
    const projection = buildProjection();
    const staleProjection = {
      ...projection,
      buckets: {
        identity_evidence: [
          ...projection.buckets.identity_evidence,
          {
            bucketId: 'identity_evidence',
            sourceId: 'media_server_library_profile',
            authoritySourceId: 'media_server_contents',
            label: 'Family',
          },
        ],
      },
      summary: {
        ...projection.summary,
        totalEntryCount: 2,
        bucketSummaries: [
          {
            bucketId: 'identity_evidence',
            entryCount: 2,
            readinessId: 'supporting',
          },
        ],
      },
    };
    const staleFingerprint =
      buildPolicyEvidenceFingerprint(projection);
    const tamperedFingerprint = {
      ...staleFingerprint,
      fingerprint: 'not-a-sha256',
      provenance: {
        ...staleFingerprint.provenance,
        totalEntryCount: 99,
      },
      traceAttributes: {
        ...staleFingerprint.traceAttributes,
        [POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.FINGERPRINT]:
          'b'.repeat(64),
      },
    };

    const audit = validatePolicyEvidenceFingerprint({
      projection: staleProjection,
      projectionFingerprint: tamperedFingerprint,
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.MALFORMED_FINGERPRINT,
      }),
      expect.objectContaining({
        riskId:
          POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.FINGERPRINT_MISMATCH,
      }),
      expect.objectContaining({
        riskId:
          POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.TRACE_FINGERPRINT_MISMATCH,
      }),
      expect.objectContaining({
        riskId:
          POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.PROVENANCE_MISMATCH,
      }),
    ]));
  });

  test('changes the fingerprint when projection evidence changes', () => {
    const baseProjection = {
      version: 'policy.evidence.v1',
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

    expect(buildPolicyEvidenceFingerprint(baseProjection).fingerprint)
      .not.toBe(buildPolicyEvidenceFingerprint(changedProjection).fingerprint);
  });
});
