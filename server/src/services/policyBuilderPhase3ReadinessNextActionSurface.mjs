import {
  PHASE_3R_COMPONENT_IDS,
  PHASE_3R_INTERACTION_RULE_IDS,
} from './policyBuilderPhase3ComponentSystem.mjs';
import {
  PHASE_3R_DESTINATION_FLOW_STEP_IDS,
  PHASE_3R_DESTINATION_NEXT_ACTION_IDS,
} from './policyBuilderPhase3DestinationFirstFlow.mjs';
import {
  PHASE_3R_WORKFLOW_DECISION_IDS,
  PHASE_3R_WORKFLOW_ROLE_IDS,
} from './policyBuilderPhase3WorkflowInventory.mjs';

const PHASE_3R_READINESS_STATE_IDS = Object.freeze({
  READY: 'ready',
  NEEDS_EXAMPLES: 'needs_examples',
  NEEDS_REVIEW: 'needs_review',
  NEEDS_ROUTING: 'needs_routing',
  BLOCKED_BY_HARD_LIMIT: 'blocked_by_hard_limit',
  STALE_PROFILE: 'stale_profile',
});

const PHASE_3R_READINESS_ISSUE_IDS = Object.freeze({
  NO_OBSERVED_EXAMPLES: 'no_observed_examples',
  MISSING_DESTINATION_INTENT: 'missing_destination_intent',
  STRUCTURAL_REVIEW_NEEDED: 'structural_review_needed',
  ROUTING_UNMAPPED: 'routing_unmapped',
  HARD_LIMIT_BLOCKING: 'hard_limit_blocking',
  OBSERVED_PROFILE_STALE: 'observed_profile_stale',
});

const PHASE_3R_READINESS_NEXT_ACTION_IDS = Object.freeze({
  SAVE_POLICY: 'save_policy',
  SYNC_MEDIA_SERVER_LIBRARY: 'sync_media_server_library',
  ADD_DECLARED_INTENT: 'add_declared_intent',
  REVIEW_INTENT_SECTION: 'review_intent_section',
  MAP_ROUTING_DESTINATION: 'map_routing_destination',
  REVIEW_HARD_LIMITS: 'review_hard_limits',
  REFRESH_OBSERVED_PROFILE: 'refresh_observed_profile',
});

const PHASE_3R_DIAGNOSTIC_SURFACE_IDS = Object.freeze({
  IMPACT_PREVIEW: 'impact_preview',
  REPLAY_PREVIEW: 'replay_preview',
  PROVIDER_READINESS: 'provider_readiness',
  TMDB_LIVE_PREVIEW: 'tmdb_live_preview',
  SCORING_DETAILS: 'scoring_details',
  PARITY_DELTA: 'parity_delta',
});

const PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS = Object.freeze({
  NORMAL_READINESS: 'normal_readiness',
  MIGRATION_VERIFIER_ONLY: 'migration_verifier_only',
});

const PHASE_3R_READINESS_RISK_IDS = Object.freeze({
  UNKNOWN_READINESS_ISSUE: 'unknown_readiness_issue',
  UNKNOWN_READINESS_STATE: 'unknown_readiness_state',
  MULTIPLE_NEXT_ACTIONS: 'multiple_next_actions',
  MISSING_DESTINATION_LINK: 'missing_destination_link',
  INTERNAL_DIAGNOSTIC_IN_NORMAL_FLOW: 'internal_diagnostic_in_normal_flow',
  PROVIDER_OR_REPLAY_DETAIL_EXPOSED: 'provider_or_replay_detail_exposed',
});

const READINESS_STATE_PRIORITY = Object.freeze({
  [PHASE_3R_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT]: 1,
  [PHASE_3R_READINESS_STATE_IDS.NEEDS_ROUTING]: 2,
  [PHASE_3R_READINESS_STATE_IDS.STALE_PROFILE]: 3,
  [PHASE_3R_READINESS_STATE_IDS.NEEDS_EXAMPLES]: 4,
  [PHASE_3R_READINESS_STATE_IDS.NEEDS_REVIEW]: 5,
  [PHASE_3R_READINESS_STATE_IDS.READY]: 6,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach(item => {
    deepFreeze(item);
  });

  return value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toCleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const PHASE_3R_READINESS_STATE_RECORDS = deepFreeze([
  {
    id: PHASE_3R_READINESS_STATE_IDS.READY,
    label: 'Ready',
    tone: 'success',
    statusRole: 'status',
    message: 'This policy has enough declared intent and routing context to save.',
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.SAVE_POLICY,
  },
  {
    id: PHASE_3R_READINESS_STATE_IDS.NEEDS_EXAMPLES,
    label: 'Needs examples',
    tone: 'info',
    statusRole: 'status',
    message: 'This destination needs more observed examples or an explicit declared intent.',
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.SYNC_MEDIA_SERVER_LIBRARY,
  },
  {
    id: PHASE_3R_READINESS_STATE_IDS.NEEDS_REVIEW,
    label: 'Needs review',
    tone: 'warning',
    statusRole: 'alert',
    message: 'Review the highlighted policy section before relying on this destination.',
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.REVIEW_INTENT_SECTION,
  },
  {
    id: PHASE_3R_READINESS_STATE_IDS.NEEDS_ROUTING,
    label: 'Needs routing',
    tone: 'warning',
    statusRole: 'alert',
    message: 'Map the destination to an Arr root folder before this policy can route.',
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
  },
  {
    id: PHASE_3R_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
    label: 'Blocked by hard limit',
    tone: 'danger',
    statusRole: 'alert',
    message: 'A declared hard limit currently blocks this destination.',
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.REVIEW_HARD_LIMITS,
  },
  {
    id: PHASE_3R_READINESS_STATE_IDS.STALE_PROFILE,
    label: 'Stale profile',
    tone: 'info',
    statusRole: 'status',
    message: 'Refresh the observed library profile before trusting suggestions.',
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.REFRESH_OBSERVED_PROFILE,
  },
]);

const PHASE_3R_READINESS_ISSUE_RECORDS = deepFreeze([
  {
    issueId: PHASE_3R_READINESS_ISSUE_IDS.NO_OBSERVED_EXAMPLES,
    stateId: PHASE_3R_READINESS_STATE_IDS.NEEDS_EXAMPLES,
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.SYNC_MEDIA_SERVER_LIBRARY,
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
    componentId: PHASE_3R_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
    destinationNextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.SYNC_MEDIA_SERVER_LIBRARY,
    message: 'Sync or add examples so the destination has observable context.',
  },
  {
    issueId: PHASE_3R_READINESS_ISSUE_IDS.MISSING_DESTINATION_INTENT,
    stateId: PHASE_3R_READINESS_STATE_IDS.NEEDS_EXAMPLES,
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    componentId: PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    destinationNextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
    message: 'Add at least one belongs-here signal for this destination.',
  },
  {
    issueId: PHASE_3R_READINESS_ISSUE_IDS.STRUCTURAL_REVIEW_NEEDED,
    stateId: PHASE_3R_READINESS_STATE_IDS.NEEDS_REVIEW,
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.REVIEW_INTENT_SECTION,
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    componentId: PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    destinationNextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.ACCEPT_OBSERVED_SUGGESTIONS,
    message: 'Review weak or conflicting intent before saving.',
  },
  {
    issueId: PHASE_3R_READINESS_ISSUE_IDS.ROUTING_UNMAPPED,
    stateId: PHASE_3R_READINESS_STATE_IDS.NEEDS_ROUTING,
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
    componentId: PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
    destinationNextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
    message: 'Map this media-server library to an Arr destination before routing.',
  },
  {
    issueId: PHASE_3R_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING,
    stateId: PHASE_3R_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.REVIEW_HARD_LIMITS,
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
    componentId: PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    destinationNextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.CONFIRM_HARD_LIMITS,
    message: 'Review the hard limit that is blocking this destination.',
  },
  {
    issueId: PHASE_3R_READINESS_ISSUE_IDS.OBSERVED_PROFILE_STALE,
    stateId: PHASE_3R_READINESS_STATE_IDS.STALE_PROFILE,
    nextActionId: PHASE_3R_READINESS_NEXT_ACTION_IDS.REFRESH_OBSERVED_PROFILE,
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
    componentId: PHASE_3R_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
    destinationNextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.SYNC_MEDIA_SERVER_LIBRARY,
    message: 'Refresh the observed library profile before using suggestions.',
  },
]);

const PHASE_3R_DIAGNOSTIC_SURFACE_RECORDS = deepFreeze([
  {
    id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.IMPACT_PREVIEW,
    label: 'Impact preview',
    visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
    workflowDecisionId: PHASE_3R_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: PHASE_3R_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
  },
  {
    id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.REPLAY_PREVIEW,
    label: 'Replay preview',
    visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
    workflowDecisionId: PHASE_3R_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: PHASE_3R_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
  },
  {
    id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.PROVIDER_READINESS,
    label: 'Provider readiness',
    visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
    workflowDecisionId: PHASE_3R_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: PHASE_3R_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
  },
  {
    id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.TMDB_LIVE_PREVIEW,
    label: 'TMDB live preview',
    visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
    workflowDecisionId: PHASE_3R_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: PHASE_3R_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
  },
  {
    id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.SCORING_DETAILS,
    label: 'Scoring details',
    visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
    workflowDecisionId: PHASE_3R_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: PHASE_3R_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
  },
  {
    id: PHASE_3R_DIAGNOSTIC_SURFACE_IDS.PARITY_DELTA,
    label: 'Parity delta',
    visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY,
    workflowDecisionId: PHASE_3R_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: PHASE_3R_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
  },
]);

const STATE_BY_ID = new Map(PHASE_3R_READINESS_STATE_RECORDS.map(record => [record.id, record]));
const ISSUE_BY_ID = new Map(PHASE_3R_READINESS_ISSUE_RECORDS.map(record => [record.issueId, record]));
const DIAGNOSTIC_SURFACE_BY_ID = new Map(PHASE_3R_DIAGNOSTIC_SURFACE_RECORDS.map(record => [record.id, record]));

function listPhase3RReadinessStateRecords() {
  return PHASE_3R_READINESS_STATE_RECORDS;
}

function listPhase3RReadinessIssueRecords() {
  return PHASE_3R_READINESS_ISSUE_RECORDS;
}

function listPhase3RDiagnosticSurfaceRecords() {
  return PHASE_3R_DIAGNOSTIC_SURFACE_RECORDS;
}

function getPhase3RReadinessStateRecord(stateId) {
  return STATE_BY_ID.get(stateId) || null;
}

function getPhase3RReadinessIssueRecord(issueId) {
  return ISSUE_BY_ID.get(issueId) || null;
}

function normalizePhase3RReadinessIssue(issue = {}) {
  const issueId = toCleanString(typeof issue === 'string' ? issue : issue.issueId);
  const record = getPhase3RReadinessIssueRecord(issueId);

  return {
    issueId,
    stateId: record?.stateId || null,
    nextActionIds: record ? [record.nextActionId] : [],
    flowStepId: record?.flowStepId || null,
    componentId: record?.componentId || null,
    destinationNextActionId: record?.destinationNextActionId || null,
    message: toCleanString(issue.message) || record?.message || '',
    internalDiagnosticSurfaceIds: asArray(issue.internalDiagnosticSurfaceIds)
      .map(surfaceId => toCleanString(surfaceId))
      .filter(Boolean),
  };
}

function validatePhase3RReadinessIssue(issue = {}) {
  const normalizedIssue = normalizePhase3RReadinessIssue(issue);
  const record = getPhase3RReadinessIssueRecord(normalizedIssue.issueId);

  if (!record) {
    return {
      valid: false,
      riskId: PHASE_3R_READINESS_RISK_IDS.UNKNOWN_READINESS_ISSUE,
      normalizedIssue,
      reason: 'Readiness issue is not part of the Phase 3R normal workflow vocabulary.',
    };
  }

  if (!getPhase3RReadinessStateRecord(normalizedIssue.stateId)) {
    return {
      valid: false,
      riskId: PHASE_3R_READINESS_RISK_IDS.UNKNOWN_READINESS_STATE,
      normalizedIssue,
      reason: 'Readiness issue points to an unknown visible readiness state.',
    };
  }

  if (normalizedIssue.nextActionIds.length !== 1) {
    return {
      valid: false,
      riskId: PHASE_3R_READINESS_RISK_IDS.MULTIPLE_NEXT_ACTIONS,
      normalizedIssue,
      reason: 'Each readiness issue must expose exactly one next action.',
    };
  }

  if (!normalizedIssue.flowStepId || !normalizedIssue.componentId) {
    return {
      valid: false,
      riskId: PHASE_3R_READINESS_RISK_IDS.MISSING_DESTINATION_LINK,
      normalizedIssue,
      reason: 'Each readiness issue must link to a destination workflow section or setting.',
    };
  }

  if (normalizedIssue.internalDiagnosticSurfaceIds.length > 0) {
    return {
      valid: false,
      riskId: PHASE_3R_READINESS_RISK_IDS.INTERNAL_DIAGNOSTIC_IN_NORMAL_FLOW,
      normalizedIssue,
      reason: 'Normal readiness cannot expose raw diagnostic surfaces.',
    };
  }

  return {
    valid: true,
    riskId: null,
    normalizedIssue,
    reason: 'Readiness issue has one action and one destination workflow target.',
  };
}

function selectHighestPriorityState(issueRecords = []) {
  if (issueRecords.length === 0) {
    return PHASE_3R_READINESS_STATE_IDS.READY;
  }

  return issueRecords
    .map(issue => issue.stateId)
    .sort((left, right) => READINESS_STATE_PRIORITY[left] - READINESS_STATE_PRIORITY[right])[0];
}

function buildPhase3RReadinessProjection(issues = []) {
  const validationResults = asArray(issues).map(issue => validatePhase3RReadinessIssue(issue));
  const validIssues = validationResults
    .filter(result => result.valid)
    .map(result => result.normalizedIssue)
    .sort((left, right) => (
      READINESS_STATE_PRIORITY[left.stateId] - READINESS_STATE_PRIORITY[right.stateId]
    ));
  const stateId = selectHighestPriorityState(validIssues);
  const state = getPhase3RReadinessStateRecord(stateId);

  return {
    componentId: PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
    interactionRuleId: PHASE_3R_INTERACTION_RULE_IDS.READINESS_LINKS_TO_RESOLVING_COMPONENT,
    stateId,
    label: state.label,
    tone: state.tone,
    statusRole: state.statusRole,
    message: state.message,
    nextAction: validIssues.length > 0
      ? {
          actionId: validIssues[0].nextActionIds[0],
          issueId: validIssues[0].issueId,
          flowStepId: validIssues[0].flowStepId,
          componentId: validIssues[0].componentId,
          destinationNextActionId: validIssues[0].destinationNextActionId,
          message: validIssues[0].message,
        }
      : {
          actionId: state.nextActionId,
          issueId: null,
          flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
          componentId: PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
          destinationNextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.SAVE_POLICY,
          message: 'Save this policy or defer without changing routing behavior.',
        },
    issues: validIssues,
    rejectedIssues: validationResults
      .filter(result => !result.valid)
      .map(result => ({
        issueId: result.normalizedIssue.issueId,
        riskId: result.riskId,
        reason: result.reason,
      })),
    exposesInternalDiagnostics: false,
  };
}

function validatePhase3RDiagnosticSurfaceVisibility(surfaceIds = []) {
  const surfaces = asArray(surfaceIds)
    .map(surfaceId => toCleanString(surfaceId))
    .filter(Boolean)
    .map(surfaceId => DIAGNOSTIC_SURFACE_BY_ID.get(surfaceId) || {
      id: surfaceId,
      visibilityId: PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.NORMAL_READINESS,
    });

  const normalDiagnosticIds = surfaces
    .filter(surface => surface.visibilityId !== PHASE_3R_READINESS_SURFACE_VISIBILITY_IDS.MIGRATION_VERIFIER_ONLY)
    .map(surface => surface.id);

  return {
    valid: normalDiagnosticIds.length === 0,
    riskId: normalDiagnosticIds.length === 0
      ? null
      : PHASE_3R_READINESS_RISK_IDS.PROVIDER_OR_REPLAY_DETAIL_EXPOSED,
    normalDiagnosticIds,
    reason: normalDiagnosticIds.length === 0
      ? 'Diagnostic surfaces are verifier-only and excluded from normal readiness.'
      : 'Normal readiness cannot expose replay, provider, TMDB, scoring, or parity details.',
  };
}

function summarizePhase3RReadinessNextActionSurface() {
  return {
    readinessStateCount: PHASE_3R_READINESS_STATE_RECORDS.length,
    readinessIssueCount: PHASE_3R_READINESS_ISSUE_RECORDS.length,
    diagnosticSurfaceCount: PHASE_3R_DIAGNOSTIC_SURFACE_RECORDS.length,
    visibleStateIds: Object.values(PHASE_3R_READINESS_STATE_IDS),
    diagnosticSurfaceVisibilityIds: PHASE_3R_DIAGNOSTIC_SURFACE_RECORDS.map(surface => surface.visibilityId),
    everyIssueHasOneNextAction: PHASE_3R_READINESS_ISSUE_RECORDS
      .every(issue => Boolean(issue.nextActionId) && !Array.isArray(issue.nextActionId)),
    normalReadinessExposesInternalDiagnostics: false,
  };
}

export {
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
};
