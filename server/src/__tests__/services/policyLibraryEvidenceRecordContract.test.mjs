import {
  POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS,
  buildPolicyLibraryEvidenceRecordAudit,
  buildPolicyLibraryEvidenceRecordCollectionAudit,
} from '../../services/policyLibraryEvidenceRecordContract.mjs';

function buildValidRecord(overrides = {}) {
  return {
    key: 'classification:42',
    label: 'Persisted final classification outcome',
    value: 'completed',
    count: 1,
    confidence: 0.8,
    observedAt: '2026-07-12T12:00:00.000Z',
    reasonCode: 'persisted_final_outcome',
    ...overrides,
  };
}

describe('policyLibraryEvidenceRecordContract', () => {
  test('accepts a complete canonical primitive record with a source-owned reason code', () => {
    expect(buildPolicyLibraryEvidenceRecordAudit(buildValidRecord(), {
      allowedReasonCodes: ['persisted_final_outcome'],
    })).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('rejects missing, unexpected, malformed, and non-source-owned fields', () => {
    const record = buildValidRecord({
      count: '1',
      confidence: 1.1,
      reasonCode: 'untrusted_reason',
      providerPayload: { title: 'must not be admitted' },
    });
    delete record.value;

    const audit = buildPolicyLibraryEvidenceRecordAudit(record, {
      allowedReasonCodes: ['persisted_final_outcome'],
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.MISSING_FIELD,
      POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.UNEXPECTED_FIELD,
      POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.INVALID_ENTRY,
      POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.INVALID_COUNT,
      POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.INVALID_CONFIDENCE,
      POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.UNSUPPORTED_REASON_CODE,
    ]));
  });

  test('reports the index of each invalid record in a collection', () => {
    const audit = buildPolicyLibraryEvidenceRecordCollectionAudit([
      buildValidRecord(),
      buildValidRecord({ reasonCode: 'untrusted_reason' }),
    ], {
      allowedReasonCodes: ['persisted_final_outcome'],
    });

    expect(audit).toEqual(expect.objectContaining({
      ok: false,
      checkedRecordCount: 2,
      issues: expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.UNSUPPORTED_REASON_CODE,
          index: 1,
        }),
      ]),
    }));
  });
});
