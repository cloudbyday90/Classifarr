import {
  PHASE_3R_COMPONENT_IDS,
  PHASE_3R_INTERACTION_RULE_IDS,
} from '../../services/policyBuilderPhase3ComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS,
  POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS,
} from '../../services/policyAuthoringDestinationFlow.mjs';
import {
  POLICY_AUTHORING_WORKFLOW_DECISION_IDS,
  POLICY_AUTHORING_WORKFLOW_ROLE_IDS,
} from '../../services/policyAuthoringWorkflowInventory.mjs';
import {
  PHASE_3R_DIAGNOSTIC_SURFACE_IDS,
  PHASE_3R_READINESS_ISSUE_IDS,
  PHASE_3R_READINESS_NEXT_ACTION_IDS,
  PHASE_3R_READINESS_RISK_IDS,
  PHASE_3R_READINESS_STATE_IDS,
  PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS,
  buildPhase3RReadinessProjection,
  getPhase3RReadinessIssueRecord,
  getPhase3RReadinessStateRecord,
  listPhase3RDiagnosticSurfaceRecords,
  listPhase3RReadinessIssueRecords,
  listPhase3RReadinessStateRecords,
  normalizePhase3RReadinessIssue,
  summarizePhase3RReadinessNextActionSurface,
  validatePhase3RDiagnosticSurfaceVisibility,
  validatePhase3RReadinessIssue,
} from '../../services/policyBuilderPhase3ReadinessNextActionSurface.mjs';

describe('policyBuilderPhase3ReadinessNextActionSurface', () => {
  test('defines the visible Phase 3R readiness states', () => {
    expect(listPhase3RReadinessStateRecords().map(record => record.id)).toEqual([
      PHASE_3R_READINESS_STATE_IDS.READY,
      PHASE_3R_READINESS_STATE_IDS.NEEDS_EXAMPLES,
      PHASE_3R_READINESS_STATE_IDS.NEEDS_REVIEW,
      PHASE_3R_READINESS_STATE_IDS.NEEDS_ROUTING,
      PHASE_3R_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      PHASE_3R_READINESS_STATE_IDS.STALE_PROFILE,
    ]);

    expect(getPhase3RReadinessStateRecord(PHASE_3R_READINESS_STATE_IDS.NEEDS_ROUTING))
      .toEqual(expect.objectContaining({
        label: 'Needs routing',
        statusRole: 'alert',
        nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
      }));
  });

  test('maps each readiness issue to exactly one next action and resolving component', () => {
    for (const issue of listPhase3RReadinessIssueRecords()) {
      expect(validatePhase3RReadinessIssue(issue.issueId)).toEqual(expect.objectContaining({
        valid: true,
        riskId: null,
      }));
      expect(issue.nextActionId).toEqual(expect.any(String));
      expect(Array.isArray(issue.nextActionId)).toBe(false);
      expect(issue.flowStepId).toEqual(expect.any(String));
      expect(issue.componentId).toEqual(expect.any(String));
    }

    expect(getPhase3RReadinessIssueRecord(PHASE_3R_READINESS_ISSUE_IDS.ROUTING_UNMAPPED))
      .toEqual(expect.objectContaining({
        stateId: PHASE_3R_READINESS_STATE_IDS.NEEDS_ROUTING,
        nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
        flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
        componentId: PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
        destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
      }));
  });

  test('normalizes issue strings into action-oriented records', () => {
    expect(normalizePhase3RReadinessIssue(PHASE_3R_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING))
      .toEqual(expect.objectContaining({
        issueId: PHASE_3R_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING,
        stateId: PHASE_3R_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
        nextActionIds: [
          PHASE_3R_READINESS_NEXT_ACTION_IDS.REVIEW_HARD_LIMITS,
        ],
        flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
        componentId: PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      }));
  });

  test('builds ready projection with save action when there are no issues', () => {
    expect(buildPhase3RReadinessProjection([])).toEqual(expect.objectContaining({
      componentId: PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
      interactionRuleId: PHASE_3R_INTERACTION_RULE_IDS.READINESS_LINKS_TO_RESOLVING_COMPONENT,
      stateId: PHASE_3R_READINESS_STATE_IDS.READY,
      label: 'Ready',
      nextAction: {
        actionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.SAVE_POLICY,
        issueId: null,
        flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
        componentId: PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
        destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.SAVE_POLICY,
        message: 'Save this policy or defer without changing routing behavior.',
      },
      exposesInternalDiagnostics: false,
    }));
  });

  test('selects the highest-priority readiness issue but preserves all valid issues', () => {
    const projection = buildPhase3RReadinessProjection([
      PHASE_3R_READINESS_ISSUE_IDS.MISSING_DESTINATION_INTENT,
      PHASE_3R_READINESS_ISSUE_IDS.ROUTING_UNMAPPED,
      PHASE_3R_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING,
    ]);

    expect(projection).toEqual(expect.objectContaining({
      stateId: PHASE_3R_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      label: 'Blocked by hard limit',
      nextAction: expect.objectContaining({
        actionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.REVIEW_HARD_LIMITS,
        issueId: PHASE_3R_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING,
        componentId: PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      }),
      exposesInternalDiagnostics: false,
    }));
    expect(projection.issues.map(issue => issue.issueId)).toEqual([
      PHASE_3R_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING,
      PHASE_3R_READINESS_ISSUE_IDS.ROUTING_UNMAPPED,
      PHASE_3R_READINESS_ISSUE_IDS.MISSING_DESTINATION_INTENT,
    ]);
  });

  test('rejects unknown readiness issues and diagnostic details in normal flow', () => {
    expect(validatePhase3RReadinessIssue('provider_readiness_failed')).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_READINESS_RISK_IDS.UNKNOWN_READINESS_ISSUE,
    }));

    expect(validatePhase3RReadinessIssue({
      issueId: PHASE_3R_READINESS_ISSUE_IDS.STRUCTURAL_REVIEW_NEEDED,
      internalDiagnosticSurfaceIds: [
        PHASE_3R_DIAGNOSTIC_SURFACE_IDS.REPLAY_PREVIEW,
      ],
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_READINESS_RISK_IDS.INTERNAL_DIAGNOSTIC_IN_NORMAL_FLOW,
    }));
  });

  test('marks old replay, provider, TMDB, scoring, and parity surfaces verifier-only', () => {
    expect(listPhase3RDiagnosticSurfaceRecords()).toEqual([
      expect.objectContaining({
        id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.IMPACT_PREVIEW,
        visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.DELETE,
        workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
      }),
      expect.objectContaining({
        id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.REPLAY_PREVIEW,
        visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      }),
      expect.objectContaining({
        id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.PROVIDER_READINESS,
        visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      }),
      expect.objectContaining({
        id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.TMDB_LIVE_PREVIEW,
        visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      }),
      expect.objectContaining({
        id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.SCORING_DETAILS,
        visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      }),
      expect.objectContaining({
        id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.PARITY_DELTA,
        visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      }),
    ]);

    expect(validatePhase3RDiagnosticSurfaceVisibility([
      PHASE_3R_DIAGNOSTIC_SURFACE_IDS.IMPACT_PREVIEW,
      PHASE_3R_DIAGNOSTIC_SURFACE_IDS.REPLAY_PREVIEW,
      PHASE_3R_DIAGNOSTIC_SURFACE_IDS.PROVIDER_READINESS,
      PHASE_3R_DIAGNOSTIC_SURFACE_IDS.TMDB_LIVE_PREVIEW,
      PHASE_3R_DIAGNOSTIC_SURFACE_IDS.SCORING_DETAILS,
      PHASE_3R_DIAGNOSTIC_SURFACE_IDS.PARITY_DELTA,
    ])).toEqual({
      valid: true,
      riskId: null,
      normalDiagnosticIds: [],
      reason: 'Diagnostic surfaces are verifier-only and excluded from normal readiness.',
    });
  });

  test('fails visibility validation for unknown normal diagnostic surfaces', () => {
    expect(validatePhase3RDiagnosticSurfaceVisibility(['raw_provider_payload'])).toEqual({
      valid: false,
      riskId: PHASE_3R_READINESS_RISK_IDS.PROVIDER_OR_REPLAY_DETAIL_EXPOSED,
      normalDiagnosticIds: ['raw_provider_payload'],
      reason: 'Normal readiness cannot expose replay, provider, TMDB, scoring, or parity details.',
    });
  });

  test('summarizes the readiness next-action surface checkpoint', () => {
    expect(summarizePhase3RReadinessNextActionSurface()).toEqual({
      readinessStateCount: 6,
      readinessIssueCount: 6,
      diagnosticSurfaceCount: 6,
      visibleStateIds: [
        PHASE_3R_READINESS_STATE_IDS.READY,
        PHASE_3R_READINESS_STATE_IDS.NEEDS_EXAMPLES,
        PHASE_3R_READINESS_STATE_IDS.NEEDS_REVIEW,
        PHASE_3R_READINESS_STATE_IDS.NEEDS_ROUTING,
        PHASE_3R_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
        PHASE_3R_READINESS_STATE_IDS.STALE_PROFILE,
      ],
      diagnosticSurfaceVisibilityIds: [
        PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
        PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
      ],
      everyIssueHasOneNextAction: true,
      normalReadinessExposesInternalDiagnostics: false,
    });
  });
});
