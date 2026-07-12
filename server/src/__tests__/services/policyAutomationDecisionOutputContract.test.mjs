import {
  POLICY_AUTOMATION_DECISION_ACTION_IDS,
  POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS,
  POLICY_AUTOMATION_DECISION_REASON_IDS,
  POLICY_AUTOMATION_DECISION_STATE_IDS,
  buildPolicyAutomationDecisionOutputAudit,
  buildPolicyAutomationDecisionTrace,
} from '../../services/policyAutomationDecisionOutputContract.mjs';

describe('policyAutomationDecisionOutputContract', () => {
  function buildValidDecision() {
    const stateId = POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY;
    const evidence = {
      validation: { ok: true },
      counts: { identity: 1, routing: 1 },
      projectionFingerprint: { fingerprint: 'a'.repeat(64) },
    };
    const trace = buildPolicyAutomationDecisionTrace({
      stateId,
      reasons: [POLICY_AUTOMATION_DECISION_REASON_IDS.AUTOMATION_ROUTE_READY],
      evidenceCounts: evidence.counts,
      evidenceValidation: evidence.validation,
      strongIdentity: true,
      routeMapped: true,
    });

    return {
      stateId,
      actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR,
      automationAllowed: true,
      routeAllowed: true,
      classificationAllowed: true,
      strongIdentity: true,
      routeMapped: true,
      evidence,
      trace: {
        ...trace,
        attributes: {
          ...trace.attributes,
          'classifarr.runtime.decision.evidence_projection_fingerprint':
            evidence.projectionFingerprint.fingerprint,
        },
      },
    };
  }

  test('builds a canonical trace for a valid decision output', () => {
    const decision = buildValidDecision();
    const audit = buildPolicyAutomationDecisionOutputAudit({
      decision,
      additionalTraceAttributes: {
        'classifarr.runtime.decision.evidence_projection_fingerprint':
          decision.evidence.projectionFingerprint.fingerprint,
      },
    });

    expect(decision.trace.reasons).toEqual([
      expect.objectContaining({
        reasonId: POLICY_AUTOMATION_DECISION_REASON_IDS.AUTOMATION_ROUTE_READY,
      }),
    ]);
    expect(audit).toEqual({ ok: true, issues: [] });
  });

  test('rejects an action or trace that does not match the selected state', () => {
    const decision = buildValidDecision();
    const audit = buildPolicyAutomationDecisionOutputAudit({
      decision: {
        ...decision,
        stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
        actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR,
        automationAllowed: true,
        routeAllowed: true,
        classificationAllowed: true,
        trace: {
          ...decision.trace,
          reasons: [{
            ...decision.trace.reasons[0],
            summary: 'raw=do-not-leak',
          }],
        },
      },
      additionalTraceAttributes: {
        'classifarr.runtime.decision.evidence_projection_fingerprint':
          decision.evidence.projectionFingerprint.fingerprint,
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS.STATE_ACTION_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS.STATE_PERMISSION_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS.TRACE_CONTRACT_MISMATCH,
      }),
    ]));
  });
});
