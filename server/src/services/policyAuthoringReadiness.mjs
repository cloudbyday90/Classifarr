import {
  POLICY_AUTHORING_COMPONENT_IDS,
  POLICY_AUTHORING_INTERACTION_RULE_IDS,
} from './policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS,
  POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS,
} from './policyAuthoringDestinationFlow.mjs';
const POLICY_AUTHORING_READINESS_STATE_IDS = Object.freeze({
  READY: 'ready',
  NEEDS_EXAMPLES: 'needs_examples',
  NEEDS_REVIEW: 'needs_review',
  NEEDS_ROUTING: 'needs_routing',
  BLOCKED_BY_HARD_LIMIT: 'blocked_by_hard_limit',
  STALE_PROFILE: 'stale_profile',
});

const POLICY_AUTHORING_READINESS_ISSUE_IDS = Object.freeze({
  NO_OBSERVED_EXAMPLES: 'no_observed_examples',
  MISSING_DESTINATION_INTENT: 'missing_destination_intent',
  STRUCTURAL_REVIEW_NEEDED: 'structural_review_needed',
  ROUTING_UNMAPPED: 'routing_unmapped',
  HARD_LIMIT_BLOCKING: 'hard_limit_blocking',
  OBSERVED_PROFILE_STALE: 'observed_profile_stale',
});

const POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS = Object.freeze({
  SAVE_POLICY: 'save_policy',
  ADD_DECLARED_INTENT: 'add_declared_intent',
  REVIEW_INTENT_SECTION: 'review_intent_section',
  MAP_ROUTING_DESTINATION: 'map_routing_destination',
  REVIEW_HARD_LIMITS: 'review_hard_limits',
});

const POLICY_AUTHORING_READINESS_RISK_IDS = Object.freeze({
  UNKNOWN_READINESS_ISSUE: 'unknown_readiness_issue',
  UNKNOWN_READINESS_STATE: 'unknown_readiness_state',
  MULTIPLE_NEXT_ACTIONS: 'multiple_next_actions',
  MISSING_DESTINATION_LINK: 'missing_destination_link',
  INTERNAL_DIAGNOSTIC_IN_NORMAL_FLOW: 'internal_diagnostic_in_normal_flow',
  PROVIDER_OR_REPLAY_DETAIL_EXPOSED: 'provider_or_replay_detail_exposed',
});

const READINESS_STATE_PRIORITY = Object.freeze({
  [POLICY_AUTHORING_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT]: 1,
  [POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_ROUTING]: 2,
  [POLICY_AUTHORING_READINESS_STATE_IDS.STALE_PROFILE]: 3,
  [POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_EXAMPLES]: 4,
  [POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_REVIEW]: 5,
  [POLICY_AUTHORING_READINESS_STATE_IDS.READY]: 6,
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

const POLICY_AUTHORING_READINESS_STATE_RECORDS = deepFreeze([
  {
    id: POLICY_AUTHORING_READINESS_STATE_IDS.READY,
    label: 'Ready',
    tone: 'success',
    statusRole: 'status',
    message: 'This policy has enough declared intent and routing context to save.',
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.SAVE_POLICY,
  },
  {
    id: POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_EXAMPLES,
    label: 'Needs examples',
    tone: 'info',
    statusRole: 'status',
    message: 'This destination needs explicit declared intent before it can rely on observed examples.',
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
  },
  {
    id: POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_REVIEW,
    label: 'Needs review',
    tone: 'warning',
    statusRole: 'alert',
    message: 'Review the highlighted policy section before relying on this destination.',
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.REVIEW_INTENT_SECTION,
  },
  {
    id: POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_ROUTING,
    label: 'Needs routing',
    tone: 'warning',
    statusRole: 'alert',
    message: 'Map the destination to an Arr root folder before this policy can route.',
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
  },
  {
    id: POLICY_AUTHORING_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
    label: 'Blocked by hard limit',
    tone: 'danger',
    statusRole: 'alert',
    message: 'A declared hard limit currently blocks this destination.',
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.REVIEW_HARD_LIMITS,
  },
  {
    id: POLICY_AUTHORING_READINESS_STATE_IDS.STALE_PROFILE,
    label: 'Stale profile',
    tone: 'info',
    statusRole: 'status',
    message: 'Observed suggestions are unavailable because this library profile is stale. Add declared intent or defer this policy.',
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
  },
]);

const POLICY_AUTHORING_READINESS_ISSUE_RECORDS = deepFreeze([
  {
    issueId: POLICY_AUTHORING_READINESS_ISSUE_IDS.NO_OBSERVED_EXAMPLES,
    stateId: POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_EXAMPLES,
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
    destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
    message: 'Add declared intent while this destination has no usable observed examples.',
  },
  {
    issueId: POLICY_AUTHORING_READINESS_ISSUE_IDS.MISSING_DESTINATION_INTENT,
    stateId: POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_EXAMPLES,
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
    message: 'Add at least one belongs-here signal for this destination.',
  },
  {
    issueId: POLICY_AUTHORING_READINESS_ISSUE_IDS.STRUCTURAL_REVIEW_NEEDED,
    stateId: POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_REVIEW,
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.REVIEW_INTENT_SECTION,
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.ACCEPT_OBSERVED_SUGGESTIONS,
    message: 'Review weak or conflicting intent before saving.',
  },
  {
    issueId: POLICY_AUTHORING_READINESS_ISSUE_IDS.ROUTING_UNMAPPED,
    stateId: POLICY_AUTHORING_READINESS_STATE_IDS.NEEDS_ROUTING,
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
    destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
    message: 'Map this media-server library to an Arr destination before routing.',
  },
  {
    issueId: POLICY_AUTHORING_READINESS_ISSUE_IDS.HARD_LIMIT_BLOCKING,
    stateId: POLICY_AUTHORING_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.REVIEW_HARD_LIMITS,
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.CONFIRM_HARD_LIMITS,
    message: 'Review the hard limit that is blocking this destination.',
  },
  {
    issueId: POLICY_AUTHORING_READINESS_ISSUE_IDS.OBSERVED_PROFILE_STALE,
    stateId: POLICY_AUTHORING_READINESS_STATE_IDS.STALE_PROFILE,
    nextActionId: POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
    destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
    message: 'Observed suggestions are stale; add declared intent or defer this policy.',
  },
]);

const STATE_BY_ID = new Map(POLICY_AUTHORING_READINESS_STATE_RECORDS.map(record => [record.id, record]));
const ISSUE_BY_ID = new Map(POLICY_AUTHORING_READINESS_ISSUE_RECORDS.map(record => [record.issueId, record]));

function listPolicyAuthoringReadinessStateRecords() {
  return POLICY_AUTHORING_READINESS_STATE_RECORDS;
}

function listPolicyAuthoringReadinessIssueRecords() {
  return POLICY_AUTHORING_READINESS_ISSUE_RECORDS;
}

function getPolicyAuthoringReadinessStateRecord(stateId) {
  return STATE_BY_ID.get(stateId) || null;
}

function getPolicyAuthoringReadinessIssueRecord(issueId) {
  return ISSUE_BY_ID.get(issueId) || null;
}

function normalizePolicyAuthoringReadinessIssue(issue = {}) {
  const issueId = toCleanString(typeof issue === 'string' ? issue : issue.issueId);
  const record = getPolicyAuthoringReadinessIssueRecord(issueId);

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

function validatePolicyAuthoringReadinessIssue(issue = {}) {
  const normalizedIssue = normalizePolicyAuthoringReadinessIssue(issue);
  const record = getPolicyAuthoringReadinessIssueRecord(normalizedIssue.issueId);

  if (!record) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_READINESS_RISK_IDS.UNKNOWN_READINESS_ISSUE,
      normalizedIssue,
      reason: 'Readiness issue is not part of the policy authoring normal workflow vocabulary.',
    };
  }

  if (!getPolicyAuthoringReadinessStateRecord(normalizedIssue.stateId)) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_READINESS_RISK_IDS.UNKNOWN_READINESS_STATE,
      normalizedIssue,
      reason: 'Readiness issue points to an unknown visible readiness state.',
    };
  }

  if (normalizedIssue.nextActionIds.length !== 1) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_READINESS_RISK_IDS.MULTIPLE_NEXT_ACTIONS,
      normalizedIssue,
      reason: 'Each readiness issue must expose exactly one next action.',
    };
  }

  if (!normalizedIssue.flowStepId || !normalizedIssue.componentId) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_READINESS_RISK_IDS.MISSING_DESTINATION_LINK,
      normalizedIssue,
      reason: 'Each readiness issue must link to a destination workflow section or setting.',
    };
  }

  if (normalizedIssue.internalDiagnosticSurfaceIds.length > 0) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_READINESS_RISK_IDS.INTERNAL_DIAGNOSTIC_IN_NORMAL_FLOW,
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
    return POLICY_AUTHORING_READINESS_STATE_IDS.READY;
  }

  return issueRecords
    .map(issue => issue.stateId)
    .sort((left, right) => READINESS_STATE_PRIORITY[left] - READINESS_STATE_PRIORITY[right])[0];
}

function buildPolicyAuthoringReadinessProjection(issues = []) {
  const validationResults = asArray(issues).map(issue => validatePolicyAuthoringReadinessIssue(issue));
  const validIssues = validationResults
    .filter(result => result.valid)
    .map(result => result.normalizedIssue)
    .sort((left, right) => (
      READINESS_STATE_PRIORITY[left.stateId] - READINESS_STATE_PRIORITY[right.stateId]
    ));
  const stateId = selectHighestPriorityState(validIssues);
  const state = getPolicyAuthoringReadinessStateRecord(stateId);

  return {
    interactionRuleId: POLICY_AUTHORING_INTERACTION_RULE_IDS.READINESS_LINKS_TO_RESOLVING_COMPONENT,
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
          flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
          componentId: null,
          destinationNextActionId: POLICY_AUTHORING_DESTINATION_NEXT_ACTION_IDS.SAVE_POLICY,
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

function validatePolicyAuthoringDiagnosticSurfaceVisibility(surfaceIds = []) {
  const normalDiagnosticIds = asArray(surfaceIds)
    .map(surfaceId => toCleanString(surfaceId))
    .filter(Boolean);

  return {
    valid: normalDiagnosticIds.length === 0,
    riskId: normalDiagnosticIds.length === 0
      ? null
      : POLICY_AUTHORING_READINESS_RISK_IDS.PROVIDER_OR_REPLAY_DETAIL_EXPOSED,
    normalDiagnosticIds,
    reason: normalDiagnosticIds.length === 0
      ? 'Normal readiness exposes no diagnostic surfaces.'
      : 'Normal readiness cannot expose retired diagnostic details.',
  };
}

function summarizePolicyAuthoringReadiness() {
  return {
    readinessStateCount: POLICY_AUTHORING_READINESS_STATE_RECORDS.length,
    readinessIssueCount: POLICY_AUTHORING_READINESS_ISSUE_RECORDS.length,
    visibleStateIds: Object.values(POLICY_AUTHORING_READINESS_STATE_IDS),
    everyIssueHasOneNextAction: POLICY_AUTHORING_READINESS_ISSUE_RECORDS
      .every(issue => Boolean(issue.nextActionId) && !Array.isArray(issue.nextActionId)),
    normalReadinessExposesInternalDiagnostics: false,
  };
}

export {
  POLICY_AUTHORING_READINESS_ISSUE_IDS,
  POLICY_AUTHORING_READINESS_NEXT_ACTION_IDS,
  POLICY_AUTHORING_READINESS_RISK_IDS,
  POLICY_AUTHORING_READINESS_STATE_IDS,
  buildPolicyAuthoringReadinessProjection,
  getPolicyAuthoringReadinessIssueRecord,
  getPolicyAuthoringReadinessStateRecord,
  listPolicyAuthoringReadinessIssueRecords,
  listPolicyAuthoringReadinessStateRecords,
  normalizePolicyAuthoringReadinessIssue,
  summarizePolicyAuthoringReadiness,
  validatePolicyAuthoringDiagnosticSurfaceVisibility,
  validatePolicyAuthoringReadinessIssue,
};
