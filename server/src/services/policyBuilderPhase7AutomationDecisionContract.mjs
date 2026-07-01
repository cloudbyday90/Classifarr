import {
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
import {
  PHASE6R_EVIDENCE_BUCKET_IDS,
  PHASE6R_EVIDENCE_SOURCE_IDS,
} from './policyBuilderPhase6EvidenceEngine.mjs';
import {
  PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS,
  PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS,
  buildPolicyBuilderPhase7RuntimeEvidenceProjection,
  validatePolicyBuilderPhase7RuntimeEvidenceProjection,
} from './policyBuilderPhase7RuntimeEvidenceProjection.mjs';

const PHASE7R_AUTOMATION_DECISION_STATE_IDS = Object.freeze({
  AUTO_ROUTE_READY: 'auto_route_ready',
  CLASSIFIED_NOT_ROUTED: 'classified_not_routed',
  NEEDS_OPERATOR_REVIEW: 'needs_operator_review',
  BLOCKED_BY_HARD_LIMIT: 'blocked_by_hard_limit',
  NEEDS_ROUTING_MAPPING: 'needs_routing_mapping',
  STALE_PROFILE_RETRY: 'stale_profile_retry',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
});

const PHASE7R_AUTOMATION_DECISION_ACTION_IDS = Object.freeze({
  ROUTE_TO_ARR: 'route_to_arr',
  RECORD_CLASSIFICATION_ONLY: 'record_classification_only',
  ASK_OPERATOR: 'ask_operator',
  BLOCK_AUTOMATION: 'block_automation',
  CONFIGURE_ROUTING: 'configure_routing',
  REFRESH_PROFILE: 'refresh_profile',
  GATHER_EVIDENCE: 'gather_evidence',
});

const PHASE7R_AUTOMATION_DECISION_REASON_IDS = Object.freeze({
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

const PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS = Object.freeze({
  MISSING_STATE: 'missing_state',
  UNKNOWN_STATE: 'unknown_state',
  MISSING_ACTION: 'missing_action',
  MISSING_TRACE_REASON: 'missing_trace_reason',
  TRACE_REASON_OVERFLOW: 'trace_reason_overflow',
  AUTO_ROUTE_WITHOUT_STRONG_IDENTITY: 'auto_route_without_strong_identity',
  AUTO_ROUTE_WITHOUT_ROUTING: 'auto_route_without_routing',
  AUTO_ROUTE_WITH_HARD_LIMIT_BLOCK: 'auto_route_with_hard_limit_block',
  AUTO_ROUTE_WITH_STALE_PROFILE: 'auto_route_with_stale_profile',
  AUTO_ROUTE_WITH_HIGH_RISK_CONFLICT: 'auto_route_with_high_risk_conflict',
  ROUTING_SUCCESS_CONFLATED_WITH_CLASSIFICATION: 'routing_success_conflated_with_classification',
  DECISION_PERFORMED_SIDE_EFFECT: 'decision_performed_side_effect',
  INVALID_RUNTIME_EVIDENCE: 'invalid_runtime_evidence',
});

const STATE_CONTRACTS = Object.freeze([
  {
    id: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
    label: 'Auto-route ready',
    actionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR,
    automationAllowed: true,
    routeAllowed: true,
  },
  {
    id: PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED,
    label: 'Classified, not routed',
    actionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.RECORD_CLASSIFICATION_ONLY,
    automationAllowed: true,
    routeAllowed: false,
  },
  {
    id: PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
    label: 'Needs operator review',
    actionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR,
    automationAllowed: false,
    routeAllowed: false,
  },
  {
    id: PHASE7R_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
    label: 'Blocked by hard limit',
    actionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.BLOCK_AUTOMATION,
    automationAllowed: false,
    routeAllowed: false,
  },
  {
    id: PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING,
    label: 'Needs routing mapping',
    actionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING,
    automationAllowed: false,
    routeAllowed: false,
  },
  {
    id: PHASE7R_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY,
    label: 'Stale profile retry',
    actionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.REFRESH_PROFILE,
    automationAllowed: false,
    routeAllowed: false,
  },
  {
    id: PHASE7R_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE,
    label: 'Insufficient evidence',
    actionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.GATHER_EVIDENCE,
    automationAllowed: false,
    routeAllowed: false,
  },
]);

const DECISION_STATE_IDS = Object.freeze(Object.values(PHASE7R_AUTOMATION_DECISION_STATE_IDS));
const MAX_TRACE_REASONS = 12;
const STRONG_IDENTITY_CONFIDENCE = 0.75;
const STRONG_IDENTITY_COUNT = 2;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}

function getAutomationDecisionState(stateId) {
  return STATE_CONTRACTS.find(state => state.id === stateId) || null;
}

function listPolicyBuilderPhase7AutomationDecisionStates() {
  return STATE_CONTRACTS;
}

function getBuckets(evidenceProjection = {}) {
  const buckets = asObject(evidenceProjection.buckets);

  return {
    identity: asArray(buckets[PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY]),
    compatibility: asArray(buckets[PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY]),
    hardLimit: asArray(buckets[PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT]),
    avoid: asArray(buckets[PHASE6R_EVIDENCE_BUCKET_IDS.AVOID]),
    outlier: asArray(buckets[PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER]),
    routing: asArray(buckets[PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING]),
    freshness: asArray(buckets[PHASE6R_EVIDENCE_BUCKET_IDS.FRESHNESS]),
    insufficient: asArray(buckets[PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT]),
  };
}

function isStrongIdentityEntry(entry = {}) {
  const confidence = normalizeConfidence(entry.confidence);

  return entry.sourceId === PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT ||
    entry.authoritySourceId === AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT ||
    entry.trusted === true ||
    Number(entry.count) >= STRONG_IDENTITY_COUNT ||
    (confidence !== null && confidence >= STRONG_IDENTITY_CONFIDENCE);
}

function isClassificationComplete(classification = {}) {
  const status = normalizeString(classification.status).toLowerCase();

  return classification.confirmed === true ||
    classification.completed === true ||
    ['completed', 'classified', 'verified', 'routed', 'reclassified'].includes(status);
}

function hasHardLimitViolation(input = {}) {
  const candidate = asObject(input.candidate);
  const policyEvaluation = asObject(input.policyEvaluation);

  return input.hardLimitViolation === true ||
    candidate.hardLimitViolation === true ||
    policyEvaluation.hardLimitSatisfied === false ||
    policyEvaluation.hardLimitsSatisfied === false;
}

function hasAvoidConflict(input = {}) {
  const candidate = asObject(input.candidate);
  const policyEvaluation = asObject(input.policyEvaluation);

  return input.avoidConflict === true ||
    candidate.avoidConflict === true ||
    policyEvaluation.avoidRulesSatisfied === false ||
    policyEvaluation.avoidSatisfied === false ||
    asArray(policyEvaluation.avoidConflicts).length > 0;
}

function hasStaleProfile(input = {}, buckets = {}) {
  const profileFreshness = asObject(input.profileFreshness);

  return profileFreshness.stale === true ||
    asArray(buckets.insufficient).some(entry =>
      entry?.stale === true ||
      entry?.reasonCode === PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.STALE_PROFILE
    );
}

function isRoutingMapped(input = {}, buckets = {}) {
  const routing = asObject(input.routing);
  const hasExplicitTarget = Boolean(
    normalizeString(routing.targetId) ||
    normalizeString(routing.targetName) ||
    normalizeString(routing.arrConfigId) ||
    normalizeString(routing.arrRootFolderPath)
  );

  if (routing.mapped === true || routing.routeReady === true || routing.targetMapped === true) {
    return true;
  }

  if (routing.configured === true && hasExplicitTarget) {
    return true;
  }

  return asArray(buckets.routing).some(entry =>
    entry?.runtimeSourceId === PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.ROUTING_OUTCOME &&
    entry?.reasonCode === 'runtime_arr_routing_outcome'
  );
}

function hasRoutingIntent(input = {}, buckets = {}) {
  const routing = asObject(input.routing);

  return Boolean(
    normalizeString(routing.targetId) ||
    normalizeString(routing.targetName) ||
    normalizeString(routing.arrConfigId) ||
    normalizeString(routing.arrRootFolderPath) ||
    asArray(buckets.routing).length > 0
  );
}

function hasHighRiskEvidenceConflict(input = {}, buckets = {}) {
  const policyEvaluation = asObject(input.policyEvaluation);
  const risk = asObject(input.risk);
  const highRiskInsufficientReasons = new Set([
    PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.LOW_TRUST_RAG_NEIGHBOR,
    PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.UNKNOWN_LIBRARY_NEIGHBOR,
  ]);

  return input.highRiskEvidenceConflict === true ||
    risk.highRiskEvidenceConflict === true ||
    asArray(policyEvaluation.highRiskConflicts).length > 0 ||
    asArray(buckets.outlier).length > 0 ||
    asArray(buckets.insufficient).some(entry => highRiskInsufficientReasons.has(entry?.reasonCode));
}

function buildReason(reasonId, {
  bucketId = null,
  sourceId = null,
  summary,
  severity = 'info',
} = {}) {
  return {
    reasonId,
    bucketId,
    sourceId,
    summary,
    severity,
  };
}

function pushReason(reasons, reasonId, options = {}) {
  reasons.push(buildReason(reasonId, options));
}

function chooseDecisionState({
  input,
  buckets,
  strongIdentity,
  routeMapped,
  routingIntent,
  classificationComplete,
  evidenceValidation,
}) {
  const reasons = [];

  if (!evidenceValidation.ok) {
    pushReason(reasons, PHASE7R_AUTOMATION_DECISION_REASON_IDS.RUNTIME_EVIDENCE_INVALID, {
      severity: 'error',
      summary: 'Runtime evidence projection failed validation.',
    });
    return {
      stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      reasons,
    };
  }

  if (hasHardLimitViolation(input)) {
    pushReason(reasons, PHASE7R_AUTOMATION_DECISION_REASON_IDS.HARD_LIMIT_VIOLATION, {
      bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
      severity: 'error',
      summary: 'A hard-limit rule blocks automation.',
    });
    return {
      stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      reasons,
    };
  }

  if (hasStaleProfile(input, buckets)) {
    pushReason(reasons, PHASE7R_AUTOMATION_DECISION_REASON_IDS.STALE_PROFILE, {
      bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.FRESHNESS,
      severity: 'warning',
      summary: 'Refresh the media-server profile before trusting automation.',
    });
    return {
      stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY,
      reasons,
    };
  }

  if (hasAvoidConflict(input)) {
    pushReason(reasons, PHASE7R_AUTOMATION_DECISION_REASON_IDS.AVOID_RULE_CONFLICT, {
      bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.AVOID,
      severity: 'warning',
      summary: 'Avoid evidence conflicts with this candidate.',
    });
    return {
      stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      reasons,
    };
  }

  if (hasHighRiskEvidenceConflict(input, buckets)) {
    pushReason(reasons, PHASE7R_AUTOMATION_DECISION_REASON_IDS.HIGH_RISK_EVIDENCE_CONFLICT, {
      bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
      severity: 'warning',
      summary: 'High-risk evidence conflict requires operator review.',
    });
    return {
      stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      reasons,
    };
  }

  if (!strongIdentity) {
    pushReason(reasons, PHASE7R_AUTOMATION_DECISION_REASON_IDS.MISSING_STRONG_IDENTITY, {
      bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
      severity: 'warning',
      summary: 'Destination identity evidence is not strong enough for automation.',
    });
    return {
      stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE,
      reasons,
    };
  }

  if (!routeMapped) {
    pushReason(reasons, PHASE7R_AUTOMATION_DECISION_REASON_IDS.ROUTING_MAPPING_MISSING, {
      bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING,
      severity: 'warning',
      summary: 'A concrete Arr route mapping is required before routing.',
    });

    if (classificationComplete || routingIntent) {
      pushReason(reasons, PHASE7R_AUTOMATION_DECISION_REASON_IDS.CLASSIFICATION_WITHOUT_ROUTE, {
        bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING,
        severity: 'warning',
        summary: 'Classification may be recorded, but routing cannot be treated as complete.',
      });

      return {
        stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED,
        reasons,
      };
    }

    return {
      stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING,
      reasons,
    };
  }

  pushReason(reasons, PHASE7R_AUTOMATION_DECISION_REASON_IDS.AUTOMATION_ROUTE_READY, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING,
    summary: 'Identity, risk, freshness, and routing gates allow automatic routing.',
  });

  return {
    stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
    reasons,
  };
}

function buildTrace({
  stateId,
  reasons,
  buckets,
  evidenceValidation,
  strongIdentity,
  routeMapped,
}) {
  const boundedReasons = reasons.slice(0, MAX_TRACE_REASONS);

  return {
    attributes: {
      'classifarr.runtime.decision.version': 'phase7r.automation_decision.v1',
      'classifarr.runtime.decision.state': stateId,
      'classifarr.runtime.decision.reason_count': boundedReasons.length,
      'classifarr.runtime.decision.identity_count': asArray(buckets.identity).length,
      'classifarr.runtime.decision.routing_count': asArray(buckets.routing).length,
      'classifarr.runtime.decision.strong_identity': strongIdentity,
      'classifarr.runtime.decision.route_mapped': routeMapped,
      'classifarr.runtime.decision.evidence_valid': evidenceValidation.ok,
    },
    reasons: boundedReasons,
    truncated: reasons.length > boundedReasons.length,
  };
}

function buildSideEffectSummary(input = {}) {
  const sideEffects = asObject(input.sideEffects);

  return {
    routeExecuted: sideEffects.routeExecuted === true,
    classificationWritten: sideEffects.classificationWritten === true,
    questionCreated: sideEffects.questionCreated === true,
    learningWritten: sideEffects.learningWritten === true,
  };
}

function buildPolicyBuilderPhase7AutomationDecision(input = {}) {
  const evidenceProjection = input.evidenceProjection?.version === 'phase7r.runtime_evidence_projection.v1'
    ? input.evidenceProjection
    : buildPolicyBuilderPhase7RuntimeEvidenceProjection(input);
  const evidenceValidation = validatePolicyBuilderPhase7RuntimeEvidenceProjection(evidenceProjection);
  const buckets = getBuckets(evidenceProjection);
  const strongIdentity = buckets.identity.some(isStrongIdentityEntry);
  const routeMapped = isRoutingMapped(input, buckets);
  const routingIntent = hasRoutingIntent(input, buckets);
  const classificationComplete = isClassificationComplete(asObject(input.classification));
  const chosen = chooseDecisionState({
    input,
    buckets,
    strongIdentity,
    routeMapped,
    routingIntent,
    classificationComplete,
    evidenceValidation,
  });
  const state = getAutomationDecisionState(chosen.stateId);

  return {
    version: 'phase7r.automation_decision.v1',
    stateId: chosen.stateId,
    actionId: state?.actionId || PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR,
    automationAllowed: state?.automationAllowed === true,
    routeAllowed: state?.routeAllowed === true,
    classificationAllowed: [
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED,
    ].includes(chosen.stateId),
    routeMapped,
    strongIdentity,
    classificationComplete,
    evidence: {
      version: evidenceProjection.version,
      validation: evidenceValidation,
      counts: {
        identity: buckets.identity.length,
        compatibility: buckets.compatibility.length,
        hardLimit: buckets.hardLimit.length,
        avoid: buckets.avoid.length,
        outlier: buckets.outlier.length,
        routing: buckets.routing.length,
        freshness: buckets.freshness.length,
        insufficient: buckets.insufficient.length,
      },
    },
    sideEffects: buildSideEffectSummary(input),
    trace: buildTrace({
      stateId: chosen.stateId,
      reasons: chosen.reasons,
      buckets,
      evidenceValidation,
      strongIdentity,
      routeMapped,
    }),
  };
}

function validatePolicyBuilderPhase7AutomationDecision(decision = {}) {
  const issues = [];

  if (!normalizeString(decision.stateId)) {
    issues.push({
      riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.MISSING_STATE,
      message: 'Automation decision must include a state id.',
    });
  } else if (!DECISION_STATE_IDS.includes(decision.stateId)) {
    issues.push({
      riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.UNKNOWN_STATE,
      message: 'Automation decision must use a supported Phase 7R state.',
    });
  }

  if (!normalizeString(decision.actionId)) {
    issues.push({
      riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.MISSING_ACTION,
      message: 'Automation decision must include an action id.',
    });
  }

  if (asArray(decision.trace?.reasons).length === 0) {
    issues.push({
      riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Automation decision must include bounded trace reasons.',
    });
  }

  if (asArray(decision.trace?.reasons).length > MAX_TRACE_REASONS || decision.trace?.truncated === true) {
    issues.push({
      riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.TRACE_REASON_OVERFLOW,
      message: 'Automation decision trace must stay bounded.',
    });
  }

  if (decision.evidence?.validation?.ok === false) {
    issues.push({
      riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.INVALID_RUNTIME_EVIDENCE,
      message: 'Automation decision cannot rely on invalid runtime evidence.',
    });
  }

  if (decision.stateId === PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY) {
    if (decision.strongIdentity !== true) {
      issues.push({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITHOUT_STRONG_IDENTITY,
        message: 'Auto-route decisions require strong destination identity evidence.',
      });
    }

    if (decision.routeMapped !== true || decision.routeAllowed !== true) {
      issues.push({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITHOUT_ROUTING,
        message: 'Auto-route decisions require a concrete route mapping.',
      });
    }

    const reasonIds = new Set(asArray(decision.trace?.reasons).map(reason => reason.reasonId));
    if (reasonIds.has(PHASE7R_AUTOMATION_DECISION_REASON_IDS.HARD_LIMIT_VIOLATION)) {
      issues.push({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITH_HARD_LIMIT_BLOCK,
        message: 'Auto-route decisions cannot include a hard-limit block reason.',
      });
    }

    if (reasonIds.has(PHASE7R_AUTOMATION_DECISION_REASON_IDS.STALE_PROFILE)) {
      issues.push({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITH_STALE_PROFILE,
        message: 'Auto-route decisions cannot include stale-profile reasons.',
      });
    }

    if (reasonIds.has(PHASE7R_AUTOMATION_DECISION_REASON_IDS.HIGH_RISK_EVIDENCE_CONFLICT)) {
      issues.push({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITH_HIGH_RISK_CONFLICT,
        message: 'Auto-route decisions cannot include high-risk evidence conflicts.',
      });
    }
  }

  if (
    decision.stateId === PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED &&
    decision.routeAllowed === true
  ) {
    issues.push({
      riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.ROUTING_SUCCESS_CONFLATED_WITH_CLASSIFICATION,
      message: 'Classified-not-routed decisions cannot claim route success.',
    });
  }

  Object.entries(asObject(decision.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.DECISION_PERFORMED_SIDE_EFFECT,
        message: `Automation decision contract must not perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase7AutomationDecisionContractAudit(
  decision = buildPolicyBuilderPhase7AutomationDecision()
) {
  const validation = validatePolicyBuilderPhase7AutomationDecision(decision);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedStateCount: STATE_CONTRACTS.length,
    maxTraceReasonCount: MAX_TRACE_REASONS,
    validation,
    nextPhase: {
      phaseId: '7r_4',
      label: 'Runtime Question Reduction',
      reason: 'Runtime automation can now distinguish route, classify-only, review, stale-profile, routing-gap, hard-limit, and insufficient-evidence states before question generation changes.',
    },
  };
}

export {
  PHASE7R_AUTOMATION_DECISION_ACTION_IDS,
  PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS,
  PHASE7R_AUTOMATION_DECISION_REASON_IDS,
  PHASE7R_AUTOMATION_DECISION_STATE_IDS,
  buildPolicyBuilderPhase7AutomationDecision,
  buildPolicyBuilderPhase7AutomationDecisionContractAudit,
  getAutomationDecisionState,
  listPolicyBuilderPhase7AutomationDecisionStates,
  validatePolicyBuilderPhase7AutomationDecision,
};
