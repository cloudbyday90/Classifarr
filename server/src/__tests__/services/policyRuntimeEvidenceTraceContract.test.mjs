import {
  POLICY_RUNTIME_EVIDENCE_TRACE_ATTRIBUTE_IDS,
  POLICY_RUNTIME_EVIDENCE_TRACE_RISK_IDS,
  buildPolicyRuntimeEvidenceTrace,
  buildPolicyRuntimeEvidenceTraceAudit,
  createPolicyRuntimeEvidenceWarning,
  listPolicyRuntimeEvidenceTraceReasons,
} from '../../services/policyRuntimeEvidenceTraceContract.mjs';

describe('policyRuntimeEvidenceTraceContract', () => {
  const entries = [
    {
      bucketId: 'compatibility_evidence',
      sourceId: 'metadata_enrichment',
      runtimeSourceId: 'metadata_signal',
      reasonCode: 'runtime_metadata_compatibility',
      demotedFromBucketId: null,
    },
    {
      bucketId: 'insufficient_evidence',
      sourceId: 'profile_freshness',
      runtimeSourceId: 'profile_freshness',
      reasonCode: 'stale_profile',
      demotedFromBucketId: 'freshness_evidence',
    },
  ];

  test('builds sorted trace reasons and bounded summary attributes', () => {
    const warnings = [createPolicyRuntimeEvidenceWarning('raw_payload_suppressed')];
    const trace = buildPolicyRuntimeEvidenceTrace({
      version: 'policy.runtime_evidence_projection.v1',
      entries: [...entries].reverse(),
      warnings,
    });

    expect(trace.attributes).toEqual({
      [POLICY_RUNTIME_EVIDENCE_TRACE_ATTRIBUTE_IDS.VERSION]:
        'policy.runtime_evidence_projection.v1',
      [POLICY_RUNTIME_EVIDENCE_TRACE_ATTRIBUTE_IDS.ENTRY_COUNT]: 2,
      [POLICY_RUNTIME_EVIDENCE_TRACE_ATTRIBUTE_IDS.WARNING_COUNT]: 1,
    });
    expect(trace.reasons).toEqual(listPolicyRuntimeEvidenceTraceReasons(entries));
  });

  test('rejects altered trace reasons and warning content', () => {
    const warnings = [createPolicyRuntimeEvidenceWarning('raw_payload_suppressed')];
    const trace = buildPolicyRuntimeEvidenceTrace({ entries, warnings });
    const audit = buildPolicyRuntimeEvidenceTraceAudit({
      trace: {
        ...trace,
        reasons: [],
      },
      entries,
      warnings: [{
        ...warnings[0],
        message: 'raw provider payload',
      }],
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_EVIDENCE_TRACE_RISK_IDS.TRACE_REASON_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_EVIDENCE_TRACE_RISK_IDS.WARNING_CONTRACT_MISMATCH,
      }),
    ]));
  });
});
