import {
  POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS,
  POLICY_FINAL_OUTCOME_STATUS_IDS,
  POLICY_FINAL_OUTCOME_VERSION,
  buildPolicyFinalOutcome,
  buildPolicyFinalOutcomeAudit,
} from '../../services/policyFinalOutcomeNormalizer.mjs';

describe('policyFinalOutcomeNormalizer', () => {
  test('builds a bounded outcome without learning or write authority', () => {
    const outcome = buildPolicyFinalOutcome({
      sourceId: 'operator_confirmation',
      answerOutcomeId: 'resolve_current_item',
      itemId: 10674,
      destinationLibraryId: 6,
      destinationLibraryName: 'Animated\r\nMovies',
      status: 'untrusted_status',
      route: {
        attempted: false,
        routeId: 'route\n10674',
        reasonCode: 'untrusted_reason',
        providerPayload: { secret: true },
      },
    });

    expect(outcome).toEqual({
      version: POLICY_FINAL_OUTCOME_VERSION,
      recorded: true,
      sourceId: 'operator_confirmation',
      answerOutcomeId: 'resolve_current_item',
      itemId: 10674,
      destinationLibraryId: 6,
      destinationLibraryName: 'Animated Movies',
      status: POLICY_FINAL_OUTCOME_STATUS_IDS.RESOLVED,
      route: {
        attempted: false,
        succeeded: false,
        missingMapping: false,
        routeId: 'route 10674',
        reasonCode: null,
      },
      reasonCodes: ['final_outcome_recorded'],
    });
    expect(buildPolicyFinalOutcomeAudit(outcome)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
    expect(JSON.stringify(outcome)).not.toContain('providerPayload');
  });

  test('requires coherent route state and rejects embedded learning/write fields', () => {
    const outcome = buildPolicyFinalOutcome({
      sourceId: 'arr_routing_outcome',
      status: POLICY_FINAL_OUTCOME_STATUS_IDS.ROUTED,
      route: {
        attempted: true,
        succeeded: true,
      },
    });
    outcome.route.succeeded = false;
    outcome.learning = { canWriteLearning: true };
    outcome.writesPerformed = true;

    expect(buildPolicyFinalOutcomeAudit(outcome).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.INVALID_ROUTE }),
      expect.objectContaining({ riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.LEARNING_FIELD_PRESENT }),
      expect.objectContaining({ riskId: POLICY_FINAL_OUTCOME_AUDIT_RISK_IDS.WRITE_FIELD_PRESENT }),
    ]));
  });
});
