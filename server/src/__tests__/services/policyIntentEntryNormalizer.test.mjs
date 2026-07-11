import {
  POLICY_INTENT_ENTRY_AUDIT_RISK_IDS,
  buildPolicyIntentEntryAudit,
  normalizePolicyIntentEntry,
} from '../../services/policyIntentEntryNormalizer.mjs';

describe('policyIntentEntryNormalizer', () => {
  test('projects bounded primitive fields and excludes object values', () => {
    const entry = normalizePolicyIntentEntry({
      key: 'Studio: Pixar',
      label: ' Pixar\n',
      value: { raw: 'must-not-project' },
      reasonCode: 'observed_destination_identity',
    });

    expect(entry).toEqual({
      key: 'studio:pixar',
      label: 'Pixar',
      value: null,
      reasonCode: 'observed_destination_identity',
    });
    expect(JSON.stringify(entry)).not.toContain('must-not-project');
  });

  test('audits noncanonical and object-valued entries', () => {
    const audit = buildPolicyIntentEntryAudit({
      key: 'unsafe key',
      label: 'Unsafe\nlabel',
      value: { raw: true },
      reasonCode: 'Not Canonical',
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_INTENT_ENTRY_AUDIT_RISK_IDS.INVALID_KEY,
      POLICY_INTENT_ENTRY_AUDIT_RISK_IDS.INVALID_VALUE,
      POLICY_INTENT_ENTRY_AUDIT_RISK_IDS.INVALID_REASON_CODE,
      POLICY_INTENT_ENTRY_AUDIT_RISK_IDS.UNSAFE_TEXT,
    ]));
  });
});
