import {
  POLICY_AUTHORING_COMPONENT_IDS,
  POLICY_AUTHORING_INTERACTION_RULE_IDS,
} from '../../services/policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS,
  POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS,
} from '../../services/policyAuthoringDestinationFlow.mjs';
import {
  POLICY_AUTHORING_WORKFLOW_DECISION_IDS,
  POLICY_AUTHORING_WORKFLOW_ROLE_IDS,
} from '../../services/policyAuthoringWorkflowInventory.mjs';
import {
  POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS,
  POLICY_AUTHORING_READINESS_ISSUE_IDS,
  POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS,
  POLICY_AUTHORING_READINESS_RISK_IDS,
  POLICY_AUTHORING_READINESS_STATE_IDS,
  POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS,
  buildPolicyAuthoringReadinessProjection,
  getPolicyAuthoringReadinessIssueRecord,
  getPolicyAuthoringReadinessStateRecord,
  listPolicyAuthoringDiagnosticSurfaceRecords,
  listPolicyAuthoringReadinessIssueRecords,
  listPolicyAuthoringReadinessStateRecords,
  normalizePolicyAuthoringReadinessIssue,
  summarizePolicyAuthoringReadiness,
  validatePolicyAuthoringDiagnosticSurfaceVisibility,
  validatePolicyAuthoringReadinessIssue,
} from '../../services/policyAuthoringReadiness.mjs';

describe('policyAuthoringReadiness', () => {
  test('defines the visible policy authoring readiness states', () => {
    expect(listPolicyAuthoringReadinessStateRecords().map(record => record.id)).toEqual([
      POLICY_AUTHORING_READINESS_STATE_IDS.READY,
      POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_EXAMPLES,
      POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_REVIEW,
      POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_ROUTING,
      POLICY_AUTHORING_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      POLICY_AUTHORING_READINESS_STATE_IDS.STALE_PROFILE,
    ]);

    expect(getPolicyAuthoringReadinessStateRecord(POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_ROUTING))
      .toEqual(expect.objectContaining({
        label: 'Needs routing',
        statusRole: 'alert',
        nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
      }));
  });

  test('maps each readiness issue to exactly one next action and resolving component', () => {
    for (const issue of listPolicyAuthoringReadinessIssueRecords()) {
      expect(validatePolicyAuthoringReadinessIssue(issue.issueId)).toEqual(expect.objectContaining({
        valid: true,
        riskId: null,
      }));
      expect(issue.nextActionId).toEqual(expect.any(String));
      expect(Array.isArray(issue.nextActionId)).toBe(false);
      expect(issue.flowStepId).toEqual(expect.any(String));
      expect(issue.componentId).toEqual(expect.any(String));
    }

    expect(getPolicyAuthoringReadinessIssueRecord(POLICY_AUTHORING_READINESS_ISSUE_IDS.ROUTING_UNMAPPED))
      .toEqual(expect.objectContaining({
        stateId: POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_ROUTING,
        nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
        flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
        componentId: POLICY_AUTHORING_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
        destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
      }));
  });

  test('normalizes issue strings into action-oriented records', () => {
    expect(normalizePolicyAuthoringReadinessIssue(POLICY_AUTHORING_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING))
      .toEqual(expect.objectContaining({
        issueId: POLICY_AUTHORING_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING,
        stateId: POLICY_AUTHORING_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
        nextActionIds: [
          POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.REVIEW_HARD_LIMITS,
        ],
        flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
        componentId: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      }));
  });

  test('builds ready projection with save action when there are no issues', () => {
    expect(buildPolicyAuthoringReadinessProjection([])).toEqual(expect.objectContaining({
      componentId: POLICY_AUTHORING_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
      interactionRuleId: POLICY_AUTHORING_INTERACTION_RULE_IDS.READINESS_LINKS_TO_RESOLVING_COMPONENT,
      stateId: POLICY_AUTHORING_READINESS_STATE_IDS.READY,
      label: 'Ready',
      nextAction: {
        actionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.SAVE_POLICY,
        issueId: null,
        flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
        componentId: POLICY_AUTHORING_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
        destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.SAVE_POLICY,
        message: 'Save this policy or defer without changing routing behavior.',
      },
      exposesInternalDiagnostics: false,
    }));
  });

  test('selects the highest-priority readiness issue but preserves all valid issues', () => {
    const projection = buildPolicyAuthoringReadinessProjection([
      POLICY_AUTHORING_READINESS_ISSUE_IDS.MISSING_DESTINATION_INTENT,
      POLICY_AUTHORING_READINESS_ISSUE_IDS.ROUTING_UNMAPPED,
      POLICY_AUTHORING_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING,
    ]);

    expect(projection).toEqual(expect.objectContaining({
      stateId: POLICY_AUTHORING_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      label: 'Blocked by hard limit',
      nextAction: expect.objectContaining({
        actionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.REVIEW_HARD_LIMITS,
        issueId: POLICY_AUTHORING_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING,
        componentId: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      }),
      exposesInternalDiagnostics: false,
    }));
    expect(projection.issues.map(issue => issue.issueId)).toEqual([
      POLICY_AUTHORING_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING,
      POLICY_AUTHORING_READINESS_ISSUE_IDS.ROUTING_UNMAPPED,
      POLICY_AUTHORING_READINESS_ISSUE_IDS.MISSING_DESTINATION_INTENT,
    ]);
  });

  test('rejects unknown readiness issues and diagnostic details in normal flow', () => {
    expect(validatePolicyAuthoringReadinessIssue('provider_readiness_failed')).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_READINESS_RISK_IDS.UNKNOWN_READINESS_ISSUE,
    }));

    expect(validatePolicyAuthoringReadinessIssue({
      issueId: POLICY_AUTHORING_READINESS_ISSUE_IDS.STRUCTURAL_REVIEW_NEEDED,
      internalDiagnosticSurfaceIds: [
        POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.REPLAY_PREVIEW,
      ],
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_READINESS_RISK_IDS.INTERNAL_DIAGNOSTIC_IN_NORMAL_FLOW,
    }));
  });

  test('marks old replay, provider, TMDB, scoring, and parity surfaces verifier-only', () => {
    expect(listPolicyAuthoringDiagnosticSurfaceRecords()).toEqual([
      expect.objectContaining({
        id: POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.IMPACT_PREVIEW,
        visibilityId: POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.DELETE,
        workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
      }),
      expect.objectContaining({
        id: POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.REPLAY_PREVIEW,
        visibilityId: POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      }),
      expect.objectContaining({
        id: POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.PROVIDER_READINESS,
        visibilityId: POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      }),
      expect.objectContaining({
        id: POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.TMDB_LIVE_PREVIEW,
        visibilityId: POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      }),
      expect.objectContaining({
        id: POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.SCORING_DETAILS,
        visibilityId: POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      }),
      expect.objectContaining({
        id: POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.PARITY_DELTA,
        visibilityId: POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      }),
    ]);

    expect(validatePolicyAuthoringDiagnosticSurfaceVisibility([
      POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.IMPACT_PREVIEW,
      POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.REPLAY_PREVIEW,
      POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.PROVIDER_READINESS,
      POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.TMDB_LIVE_PREVIEW,
      POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.SCORING_DETAILS,
      POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS.PARITY_DELTA,
    ])).toEqual({
      valid: true,
      riskId: null,
      normalDiagnosticIds: [],
      reason: 'Diagnostic surfaces are verifier-only and excluded from normal readiness.',
    });
  });

  test('fails visibility validation for unknown normal diagnostic surfaces', () => {
    expect(validatePolicyAuthoringDiagnosticSurfaceVisibility(['raw_provider_payload'])).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_READINESS_RISK_IDS.PROVIDER_OR_REPLAY_DETAIL_EXPOSED,
      normalDiagnosticIds: ['raw_provider_payload'],
      reason: 'Normal readiness cannot expose replay, provider, TMDB, scoring, or parity details.',
    });
  });

  test('summarizes the readiness next-action surface checkpoint', () => {
    expect(summarizePolicyAuthoringReadiness()).toEqual({
      readinessStateCount: 6,
      readinessIssueCount: 6,
      diagnosticSurfaceCount: 6,
      visibleStateIds: [
        POLICY_AUTHORING_READINESS_STATE_IDS.READY,
        POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_EXAMPLES,
        POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_REVIEW,
        POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_ROUTING,
        POLICY_AUTHORING_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
        POLICY_AUTHORING_READINESS_STATE_IDS.STALE_PROFILE,
      ],
      diagnosticSurfaceVisibilityIds: [
        POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        POLICY_AUTHORING_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      ],
      everyIssueHasOneNextAction: true,
      normalReadinessExposesInternalDiagnostics: false,
    });
  });
});
