import {
  POLICY_RUNTIME_METRICS_INPUT_VERSION,
  buildPolicyRuntimeMetricsInputFromRuntimeInput,
  validatePolicyRuntimeMetricsInput,
} from '../../services/policyRuntimeMetricsInput.mjs';

describe('policyRuntimeMetricsInput', () => {
  test('normalizes only bounded metrics fields and records sensitive input without retaining it', () => {
    const metricsInput = buildPolicyRuntimeMetricsInputFromRuntimeInput({
      automationDecisions: [
        {
          stateId: 'auto_route_ready',
          trace: {
            reasons: [{ reasonId: 'decision_ready' }],
            attributes: {
              'classifarr.runtime.decision.evidence_projection_fingerprint': 'a'.repeat(64),
              ignored: 'not retained',
            },
          },
          providerPayload: {
            apiKey: 'not-retained',
          },
        },
      ],
      rebuildEvents: [
        {
          status: 'accepted',
          prompt: 'not retained',
        },
      ],
      ignored: 'not retained',
    });

    expect(metricsInput).toEqual(expect.objectContaining({
      version: POLICY_RUNTIME_METRICS_INPUT_VERSION,
      automationDecisions: [expect.objectContaining({
        stateId: 'auto_route_ready',
        sensitiveInputDetected: true,
        trace: {
          reasons: [{ reasonId: 'decision_ready' }],
          attributes: {
            'classifarr.runtime.decision.evidence_projection_fingerprint': 'a'.repeat(64),
          },
        },
      })],
      rebuildEvents: [expect.objectContaining({
        statusId: 'accepted',
        sensitiveInputDetected: true,
      })],
    }));
    expect(JSON.stringify(metricsInput)).not.toContain('not-retained');
    expect(validatePolicyRuntimeMetricsInput(metricsInput)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('rejects malformed normalized input with unexpected source fields', () => {
    const metricsInput = buildPolicyRuntimeMetricsInputFromRuntimeInput({
      automationDecisions: [{ stateId: 'auto_route_ready' }],
    });
    metricsInput.automationDecisions[0].rawDecision = {};

    expect(validatePolicyRuntimeMetricsInput(metricsInput)).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ field: 'automationDecisions[0]' }),
      ]),
    }));
  });
});
