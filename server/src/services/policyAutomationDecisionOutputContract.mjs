const POLICY_AUTOMATION_DECISION_STATE_IDS = Object.freeze({
  AUTO_ROUTE_READY: 'auto_route_ready',
  CLASSIFIED_NOT_ROUTED: 'classified_not_routed',
  NEEDS_OPERATOR_REVIEW: 'needs_operator_review',
  BLOCKED_BY_HARD_LIMIT: 'blocked_by_hard_limit',
  NEEDS_ROUTING_MAPPING: 'needs_routing_mapping',
  STALE_PROFILE_RETRY: 'stale_profile_retry',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
});

const POLICY_AUTOMATION_DECISION_ACTION_IDS = Object.freeze({
  ROUTE_TO_ARR: 'route_to_arr',
  RECORD_CLASSIFICATION_ONLY: 'record_classification_only',
  ASK_OPERATOR: 'ask_operator',
  BLOCK_AUTOMATION: 'block_automation',
  CONFIGURE_ROUTING: 'configure_routing',
  REFRESH_PROFILE: 'refresh_profile',
  GATHER_EVIDENCE: 'gather_evidence',
});

const POLICY_AUTOMATION_DECISION_REASON_IDS = Object.freeze({
  AUTOMATION_ROUTE_READY: 'automation_route_ready',
  CLASSIFICATION_WITHOUT_ROUTE: 'classification_without_route',
  HARD_LIMIT_VIOLATION: 'hard_limit_violation',
  AVOID_RULE_CONFLICT: 'avoid_rule_conflict',
  OUTLIER_CONFLICT: 'outlier_conflict',
  STALE_PROFILE: 'stale_profile',
  MISSING_STRONG_IDENTITY: 'missing_strong_identity',
  INSUFFICIENT_RUNTIME_EVIDENCE: 'insufficient_runtime_evidence',
  ROUTING_MAPPING_MISSING: 'routing_mapping_missing',
  HIGH_RISK_EVIDENCE_CONFLICT: 'high_risk_evidence_conflict',
  RUNTIME_EVIDENCE_INVALID: 'runtime_evidence_invalid',
});

const POLICY_AUTOMATION_DECISION_TRACE_ATTRIBUTE_IDS = Object.freeze({
  VERSION: 'classifarr.runtime.decision.version',
  STATE: 'classifarr.runtime.decision.state',
  REASON_COUNT: 'classifarr.runtime.decision.reason_count',
  IDENTITY_COUNT: 'classifarr.runtime.decision.identity_count',
  ROUTING_COUNT: 'classifarr.runtime.decision.routing_count',
  STRONG_IDENTITY: 'classifarr.runtime.decision.strong_identity',
  ROUTE_MAPPED: 'classifarr.runtime.decision.route_mapped',
  EVIDENCE_VALID: 'classifarr.runtime.decision.evidence_valid',
});

const POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS = Object.freeze({
  STATE_ACTION_MISMATCH: 'state_action_mismatch',
  STATE_PERMISSION_MISMATCH: 'state_permission_mismatch',
  TRACE_CONTRACT_MISMATCH: 'trace_contract_mismatch',
});

const POLICY_AUTOMATION_DECISION_MAX_TRACE_REASONS = 12;

const STATE_CONTRACTS = Object.freeze([
  {
    id: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
    label: 'Auto-route ready',
    actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR,
    automationAllowed: true,
    routeAllowed: true,
    classificationAllowed: true,
    reasonIds: [POLICY_AUTOMATION_DECISION_REASON_IDS.AUTOMATION_ROUTE_READY],
    reasonMode: 'exact',
  },
  {
    id: POLICY_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED,
    label: 'Classified, not routed',
    actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.RECORD_CLASSIFICATION_ONLY,
    automationAllowed: true,
    routeAllowed: false,
    classificationAllowed: true,
    reasonIds: [
      POLICY_AUTOMATION_DECISION_REASON_IDS.ROUTING_MAPPING_MISSING,
      POLICY_AUTOMATION_DECISION_REASON_IDS.CLASSIFICATION_WITHOUT_ROUTE,
    ],
    reasonMode: 'exact',
  },
  {
    id: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
    label: 'Needs operator review',
    actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR,
    automationAllowed: false,
    routeAllowed: false,
    classificationAllowed: false,
    reasonIds: [
      POLICY_AUTOMATION_DECISION_REASON_IDS.RUNTIME_EVIDENCE_INVALID,
      POLICY_AUTOMATION_DECISION_REASON_IDS.AVOID_RULE_CONFLICT,
      POLICY_AUTOMATION_DECISION_REASON_IDS.HIGH_RISK_EVIDENCE_CONFLICT,
    ],
    reasonMode: 'one_of',
  },
  {
    id: POLICY_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
    label: 'Blocked by hard limit',
    actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.BLOCK_AUTOMATION,
    automationAllowed: false,
    routeAllowed: false,
    classificationAllowed: false,
    reasonIds: [POLICY_AUTOMATION_DECISION_REASON_IDS.HARD_LIMIT_VIOLATION],
    reasonMode: 'exact',
  },
  {
    id: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING,
    label: 'Needs routing mapping',
    actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING,
    automationAllowed: false,
    routeAllowed: false,
    classificationAllowed: false,
    reasonIds: [POLICY_AUTOMATION_DECISION_REASON_IDS.ROUTING_MAPPING_MISSING],
    reasonMode: 'exact',
  },
  {
    id: POLICY_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY,
    label: 'Stale profile retry',
    actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.REFRESH_PROFILE,
    automationAllowed: false,
    routeAllowed: false,
    classificationAllowed: false,
    reasonIds: [POLICY_AUTOMATION_DECISION_REASON_IDS.STALE_PROFILE],
    reasonMode: 'exact',
  },
  {
    id: POLICY_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE,
    label: 'Insufficient evidence',
    actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.GATHER_EVIDENCE,
    automationAllowed: false,
    routeAllowed: false,
    classificationAllowed: false,
    reasonIds: [POLICY_AUTOMATION_DECISION_REASON_IDS.MISSING_STRONG_IDENTITY],
    reasonMode: 'exact',
  },
]);

const REASON_DEFINITIONS = Object.freeze({
  [POLICY_AUTOMATION_DECISION_REASON_IDS.AUTOMATION_ROUTE_READY]: Object.freeze({
    bucketId: 'routing_evidence',
    severity: 'info',
    summary: 'Identity, risk, freshness, and routing gates allow automatic routing.',
  }),
  [POLICY_AUTOMATION_DECISION_REASON_IDS.CLASSIFICATION_WITHOUT_ROUTE]: Object.freeze({
    bucketId: 'routing_evidence',
    severity: 'warning',
    summary: 'Classification may be recorded, but routing cannot be treated as complete.',
  }),
  [POLICY_AUTOMATION_DECISION_REASON_IDS.HARD_LIMIT_VIOLATION]: Object.freeze({
    bucketId: 'hard_limit_evidence',
    severity: 'error',
    summary: 'A hard-limit rule blocks automation.',
  }),
  [POLICY_AUTOMATION_DECISION_REASON_IDS.AVOID_RULE_CONFLICT]: Object.freeze({
    bucketId: 'avoid_evidence',
    severity: 'warning',
    summary: 'Avoid evidence conflicts with this candidate.',
  }),
  [POLICY_AUTOMATION_DECISION_REASON_IDS.OUTLIER_CONFLICT]: Object.freeze({
    bucketId: 'outlier_evidence',
    severity: 'warning',
    summary: 'Outlier evidence requires operator review.',
  }),
  [POLICY_AUTOMATION_DECISION_REASON_IDS.STALE_PROFILE]: Object.freeze({
    bucketId: 'freshness_evidence',
    severity: 'warning',
    summary: 'Refresh the media-server profile before trusting automation.',
  }),
  [POLICY_AUTOMATION_DECISION_REASON_IDS.MISSING_STRONG_IDENTITY]: Object.freeze({
    bucketId: 'identity_evidence',
    severity: 'warning',
    summary: 'Destination identity evidence is not strong enough for automation.',
  }),
  [POLICY_AUTOMATION_DECISION_REASON_IDS.INSUFFICIENT_RUNTIME_EVIDENCE]: Object.freeze({
    bucketId: 'insufficient_evidence',
    severity: 'warning',
    summary: 'Runtime evidence is insufficient for automation.',
  }),
  [POLICY_AUTOMATION_DECISION_REASON_IDS.ROUTING_MAPPING_MISSING]: Object.freeze({
    bucketId: 'routing_evidence',
    severity: 'warning',
    summary: 'A concrete Arr route mapping is required before routing.',
  }),
  [POLICY_AUTOMATION_DECISION_REASON_IDS.HIGH_RISK_EVIDENCE_CONFLICT]: Object.freeze({
    bucketId: 'outlier_evidence',
    severity: 'warning',
    summary: 'High-risk evidence conflict requires operator review.',
  }),
  [POLICY_AUTOMATION_DECISION_REASON_IDS.RUNTIME_EVIDENCE_INVALID]: Object.freeze({
    bucketId: null,
    severity: 'error',
    summary: 'Runtime evidence projection failed validation.',
  }),
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function getAutomationDecisionState(stateId) {
  return STATE_CONTRACTS.find(state => state.id === stateId) || null;
}

function listPolicyAutomationDecisionStates() {
  return STATE_CONTRACTS;
}

function buildPolicyAutomationDecisionReason(reasonId) {
  const definition = REASON_DEFINITIONS[reasonId];
  return definition ? { reasonId, ...definition } : null;
}

function getReasonIds(reasons = []) {
  return asArray(reasons)
    .map(reason => typeof reason === 'string' ? reason : reason?.reasonId)
    .filter(Boolean);
}

function areStateReasonsValid(state, reasonIds) {
  if (!state) return false;

  if (state.reasonMode === 'one_of') {
    return reasonIds.length === 1 && state.reasonIds.includes(reasonIds[0]);
  }

  return stableJson(reasonIds) === stableJson(state.reasonIds);
}

function buildPolicyAutomationDecisionTrace({
  stateId,
  reasons = [],
  evidenceCounts = {},
  evidenceValidation = {},
  strongIdentity = false,
  routeMapped = false,
} = {}) {
  const canonicalReasons = getReasonIds(reasons)
    .slice(0, POLICY_AUTOMATION_DECISION_MAX_TRACE_REASONS)
    .map(buildPolicyAutomationDecisionReason)
    .filter(Boolean);
  const counts = asObject(evidenceCounts);

  return {
    attributes: {
      [POLICY_AUTOMATION_DECISION_TRACE_ATTRIBUTE_IDS.VERSION]:
        'policy.automation_decision.v1',
      [POLICY_AUTOMATION_DECISION_TRACE_ATTRIBUTE_IDS.STATE]: stateId || null,
      [POLICY_AUTOMATION_DECISION_TRACE_ATTRIBUTE_IDS.REASON_COUNT]: canonicalReasons.length,
      [POLICY_AUTOMATION_DECISION_TRACE_ATTRIBUTE_IDS.IDENTITY_COUNT]:
        Number(counts.identity) || 0,
      [POLICY_AUTOMATION_DECISION_TRACE_ATTRIBUTE_IDS.ROUTING_COUNT]:
        Number(counts.routing) || 0,
      [POLICY_AUTOMATION_DECISION_TRACE_ATTRIBUTE_IDS.STRONG_IDENTITY]:
        strongIdentity === true,
      [POLICY_AUTOMATION_DECISION_TRACE_ATTRIBUTE_IDS.ROUTE_MAPPED]: routeMapped === true,
      [POLICY_AUTOMATION_DECISION_TRACE_ATTRIBUTE_IDS.EVIDENCE_VALID]:
        evidenceValidation?.ok === true,
    },
    reasons: canonicalReasons,
    truncated: getReasonIds(reasons).length > POLICY_AUTOMATION_DECISION_MAX_TRACE_REASONS,
  };
}

function buildPolicyAutomationDecisionOutputAudit({
  decision = {},
  additionalTraceAttributes = {},
} = {}) {
  const issues = [];
  const state = getAutomationDecisionState(decision.stateId);

  if (state) {
    if (decision.actionId !== state.actionId) {
      issues.push({
        riskId: POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS.STATE_ACTION_MISMATCH,
        message: 'Automation decision action must match its state contract.',
      });
    }

    if (
      decision.automationAllowed !== state.automationAllowed ||
      decision.routeAllowed !== state.routeAllowed ||
      decision.classificationAllowed !== state.classificationAllowed
    ) {
      issues.push({
        riskId: POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS.STATE_PERMISSION_MISMATCH,
        message: 'Automation decision permissions must match its state contract.',
      });
    }
  }

  const expectedTrace = buildPolicyAutomationDecisionTrace({
    stateId: decision.stateId,
    reasons: decision.trace?.reasons,
    evidenceCounts: decision.evidence?.counts,
    evidenceValidation: decision.evidence?.validation,
    strongIdentity: decision.strongIdentity,
    routeMapped: decision.routeMapped,
  });
  const actualTrace = asObject(decision.trace);
  const expectedTraceAttributes = {
    ...expectedTrace.attributes,
    ...asObject(additionalTraceAttributes),
  };

  if (
    !areStateReasonsValid(state, getReasonIds(actualTrace.reasons)) ||
    stableJson(actualTrace.reasons) !== stableJson(expectedTrace.reasons) ||
    actualTrace.truncated !== expectedTrace.truncated ||
    stableJson(actualTrace.attributes) !== stableJson(expectedTraceAttributes)
  ) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS.TRACE_CONTRACT_MISMATCH,
      message: 'Automation decision trace must match the bounded state and evidence contract.',
    });
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export {
  POLICY_AUTOMATION_DECISION_ACTION_IDS,
  POLICY_AUTOMATION_DECISION_MAX_TRACE_REASONS,
  POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS,
  POLICY_AUTOMATION_DECISION_REASON_IDS,
  POLICY_AUTOMATION_DECISION_STATE_IDS,
  POLICY_AUTOMATION_DECISION_TRACE_ATTRIBUTE_IDS,
  buildPolicyAutomationDecisionOutputAudit,
  buildPolicyAutomationDecisionReason,
  buildPolicyAutomationDecisionTrace,
  getAutomationDecisionState,
  listPolicyAutomationDecisionStates,
};
