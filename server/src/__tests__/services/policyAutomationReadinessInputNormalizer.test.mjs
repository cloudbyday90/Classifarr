import {
  POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS,
  POLICY_AUTOMATION_READINESS_INPUT_VERSION,
  buildPolicyAutomationReadinessInputAudit,
  buildPolicyAutomationReadinessInputSummary,
  normalizePolicyAutomationReadinessInputs,
} from '../../services/policyAutomationReadinessInputNormalizer.mjs';

describe('policyAutomationReadinessInputNormalizer', () => {
  test('normalizes bounded readiness inputs without raw routing configuration', () => {
    const input = normalizePolicyAutomationReadinessInputs({
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr\r\nAnimated Movies',
        apiKey: 'must-not-propagate',
        url: 'http://radarr.internal',
      },
      profileFreshness: { stale: false },
      hardLimitConflict: false,
    });

    expect(input).toEqual({
      version: POLICY_AUTOMATION_READINESS_INPUT_VERSION,
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
        invalidState: false,
      },
      profileFreshness: {
        stale: false,
        invalidState: false,
      },
      hardLimitConflict: false,
      invalidHardLimitConflict: false,
    });
    expect(buildPolicyAutomationReadinessInputSummary(input)).toEqual({
      version: POLICY_AUTOMATION_READINESS_INPUT_VERSION,
      routingConfigured: true,
      routeReady: true,
      hasRoutingTarget: true,
      routingStateInvalid: false,
      profileStale: false,
      profileFreshnessInvalid: false,
      hardLimitConflict: false,
      hardLimitConflictInvalid: false,
    });
    expect(JSON.stringify(input)).not.toContain('must-not-propagate');
  });

  test('fails closed for malformed routing, freshness, and hard-limit input states', () => {
    const input = normalizePolicyAutomationReadinessInputs({
      routing: { configured: 'true' },
      profileFreshness: { stale: 'false' },
      hardLimitConflict: 'false',
    });
    const audit = buildPolicyAutomationReadinessInputAudit(input, {
      rawRouting: { apiKey: 'must-not-log' },
    });

    expect(input).toEqual(expect.objectContaining({
      routing: expect.objectContaining({ invalidState: true }),
      profileFreshness: expect.objectContaining({ stale: true, invalidState: true }),
      hardLimitConflict: true,
      invalidHardLimitConflict: true,
    }));
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS.INVALID_ROUTING_STATE }),
      expect.objectContaining({ riskId: POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS.INVALID_PROFILE_FRESHNESS }),
      expect.objectContaining({ riskId: POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS.INVALID_HARD_LIMIT_STATE }),
      expect.objectContaining({ riskId: POLICY_AUTOMATION_READINESS_INPUT_AUDIT_RISK_IDS.RAW_CONFIGURATION_FIELD }),
    ]));
  });
});
