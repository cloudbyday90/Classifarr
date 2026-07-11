import {
  POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS,
  buildPolicyOperatorWorkflowEntryAudit,
  normalizePolicyOperatorWorkflowEntry,
  normalizePolicyOperatorWorkflowEntries,
} from '../../services/policyOperatorWorkflowEntryNormalizer.mjs';

describe('policyOperatorWorkflowEntryNormalizer', () => {
  test('projects only bounded display fields from an observed entry', () => {
    const entry = normalizePolicyOperatorWorkflowEntry({
      key: 'genre:animation',
      label: 'Animation\r\n',
      value: {
        providerPayload: { apiKey: 'must-not-escape' },
      },
      authoritySourceId: 'media_server_contents',
      evidenceCount: 3,
      metadata: { raw: true },
    });

    expect(entry).toEqual({
      key: 'genre:animation',
      label: 'Animation',
      value: null,
      authoritySourceId: 'media_server_contents',
      operatorDeclared: false,
      observed: true,
      reasonCode: null,
      evidenceCount: 3,
      includesRawPayload: false,
    });
    expect(buildPolicyOperatorWorkflowEntryAudit(entry)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
    expect(JSON.stringify(entry)).not.toContain('must-not-escape');
  });

  test('drops entries with no display value and detects tampered raw payload fields', () => {
    expect(normalizePolicyOperatorWorkflowEntries([
      { value: { secret: true } },
      { label: 'Keep me' },
    ])).toHaveLength(1);

    const audit = buildPolicyOperatorWorkflowEntryAudit({
      label: 'Unsafe',
      value: { nested: true },
      includesRawPayload: true,
      providerPayload: { secret: true },
    });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS.INVALID_VALUE }),
      expect.objectContaining({ riskId: POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS.RAW_FIELD_PRESENT }),
      expect.objectContaining({ riskId: POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS.RAW_PAYLOAD_FLAGGED }),
    ]));
  });
});
