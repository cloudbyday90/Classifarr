import {
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
import {
  POLICY_EVIDENCE_BUCKET_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
} from './policyEvidenceEngine.mjs';
import {
  POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS,
  POLICY_RUNTIME_EVIDENCE_SOURCE_IDS,
  buildPolicyRuntimeEvidenceProjection,
  validatePolicyRuntimeEvidenceProjection,
} from './policyRuntimeEvidenceProjection.mjs';
import {
  POLICY_AUTOMATION_DECISION_ACTION_IDS,
  POLICY_AUTOMATION_DECISION_MAX_TRACE_REASONS,
  POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS,
  POLICY_AUTOMATION_DECISION_REASON_IDS,
  POLICY_AUTOMATION_DECISION_STATE_IDS,
  buildPolicyAutomationDecisionOutputAudit,
  buildPolicyAutomationDecisionReason,
  buildPolicyAutomationDecisionTrace,
  getAutomationDecisionState,
  listPolicyAutomationDecisionStates,
} from './policyAutomationDecisionOutputContract.mjs';

const POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS = Object.freeze({
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
  MISSING_RUNTIME_EVIDENCE_VALIDATION: 'missing_runtime_evidence_validation',
  TRACE_EVIDENCE_VALID_MISMATCH: 'trace_evidence_valid_mismatch',
  MISSING_EVIDENCE_FINGERPRINT: 'missing_evidence_fingerprint',
  MALFORMED_EVIDENCE_FINGERPRINT: 'malformed_evidence_fingerprint',
  RAW_EVIDENCE_PROVENANCE_EXPOSED: 'raw_evidence_provenance_exposed',
  TRACE_FINGERPRINT_MISMATCH: 'trace_fingerprint_mismatch',
  STATE_ACTION_MISMATCH:
    POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS.STATE_ACTION_MISMATCH,
  STATE_PERMISSION_MISMATCH:
    POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS.STATE_PERMISSION_MISMATCH,
  TRACE_CONTRACT_MISMATCH:
    POLICY_AUTOMATION_DECISION_OUTPUT_RISK_IDS.TRACE_CONTRACT_MISMATCH,
});
const STRONG_IDENTITY_CONFIDENCE = 0.75;
const STRONG_IDENTITY_COUNT = 2;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const DECISION_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE =
  'classifarr.runtime.decision.evidence_projection_fingerprint';
const DECISION_EVIDENCE_VALID_TRACE_ATTRIBUTE =
  'classifarr.runtime.decision.evidence_valid';
const UNSAFE_PROVENANCE_KEYS = new Set([
  'entries',
  'entry',
  'label',
  'labels',
  'payload',
  'providerpayload',
  'raw',
  'rawlabel',
]);
const RUNTIME_EVIDENCE_INPUT_KEYS = new Set([
  'libraryProfile',
  'operatorIntent',
  'classificationFinalOutcomes',
  'manualCorrections',
  'pendingItemAnswers',
  'ragNeighbors',
  'ragEvidence',
  'metadataSignals',
  'metadataEvidence',
  'routingOutcomes',
  'profileFreshness',
]);

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

function getBuckets(evidenceProjection = {}) {
  const buckets = asObject(evidenceProjection.buckets);

  return {
    identity: asArray(buckets[POLICY_EVIDENCE_BUCKET_IDS.IDENTITY]),
    compatibility: asArray(buckets[POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY]),
    hardLimit: asArray(buckets[POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT]),
    avoid: asArray(buckets[POLICY_EVIDENCE_BUCKET_IDS.AVOID]),
    outlier: asArray(buckets[POLICY_EVIDENCE_BUCKET_IDS.OUTLIER]),
    routing: asArray(buckets[POLICY_EVIDENCE_BUCKET_IDS.ROUTING]),
    freshness: asArray(buckets[POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS]),
    insufficient: asArray(buckets[POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT]),
  };
}

function isStrongIdentityEntry(entry = {}) {
  const confidence = normalizeConfidence(entry.confidence);

  return entry.sourceId === POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT ||
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
      entry?.reasonCode === POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.STALE_PROFILE
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
    entry?.runtimeSourceId === POLICY_RUNTIME_EVIDENCE_SOURCE_IDS.ROUTING_OUTCOME &&
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
    POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.LOW_TRUST_RAG_NEIGHBOR,
    POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.UNKNOWN_LIBRARY_NEIGHBOR,
  ]);

  return input.highRiskEvidenceConflict === true ||
    risk.highRiskEvidenceConflict === true ||
    asArray(policyEvaluation.highRiskConflicts).length > 0 ||
    asArray(buckets.outlier).length > 0 ||
    asArray(buckets.insufficient).some(entry => highRiskInsufficientReasons.has(entry?.reasonCode));
}

function pushReason(reasons, reasonId) {
  const reason = buildPolicyAutomationDecisionReason(reasonId);
  if (reason) reasons.push(reason);
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
    pushReason(reasons, POLICY_AUTOMATION_DECISION_REASON_IDS.RUNTIME_EVIDENCE_INVALID, {
      severity: 'error',
      summary: 'Runtime evidence projection failed validation.',
    });
    return {
      stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      reasons,
    };
  }

  if (hasHardLimitViolation(input)) {
    pushReason(reasons, POLICY_AUTOMATION_DECISION_REASON_IDS.HARD_LIMIT_VIOLATION, {
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
      severity: 'error',
      summary: 'A hard-limit rule blocks automation.',
    });
    return {
      stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      reasons,
    };
  }

  if (hasStaleProfile(input, buckets)) {
    pushReason(reasons, POLICY_AUTOMATION_DECISION_REASON_IDS.STALE_PROFILE, {
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS,
      severity: 'warning',
      summary: 'Refresh the media-server profile before trusting automation.',
    });
    return {
      stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY,
      reasons,
    };
  }

  if (hasAvoidConflict(input)) {
    pushReason(reasons, POLICY_AUTOMATION_DECISION_REASON_IDS.AVOID_RULE_CONFLICT, {
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.AVOID,
      severity: 'warning',
      summary: 'Avoid evidence conflicts with this candidate.',
    });
    return {
      stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      reasons,
    };
  }

  if (hasHighRiskEvidenceConflict(input, buckets)) {
    pushReason(reasons, POLICY_AUTOMATION_DECISION_REASON_IDS.HIGH_RISK_EVIDENCE_CONFLICT, {
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      severity: 'warning',
      summary: 'High-risk evidence conflict requires operator review.',
    });
    return {
      stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      reasons,
    };
  }

  if (!strongIdentity) {
    pushReason(reasons, POLICY_AUTOMATION_DECISION_REASON_IDS.MISSING_STRONG_IDENTITY, {
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
      severity: 'warning',
      summary: 'Destination identity evidence is not strong enough for automation.',
    });
    return {
      stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE,
      reasons,
    };
  }

  if (!routeMapped) {
    pushReason(reasons, POLICY_AUTOMATION_DECISION_REASON_IDS.ROUTING_MAPPING_MISSING, {
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
      severity: 'warning',
      summary: 'A concrete Arr route mapping is required before routing.',
    });

    if (classificationComplete || routingIntent) {
      pushReason(reasons, POLICY_AUTOMATION_DECISION_REASON_IDS.CLASSIFICATION_WITHOUT_ROUTE, {
        bucketId: POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
        severity: 'warning',
        summary: 'Classification may be recorded, but routing cannot be treated as complete.',
      });

      return {
        stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED,
        reasons,
      };
    }

    return {
      stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING,
      reasons,
    };
  }

  pushReason(reasons, POLICY_AUTOMATION_DECISION_REASON_IDS.AUTOMATION_ROUTE_READY, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
    summary: 'Identity, risk, freshness, and routing gates allow automatic routing.',
  });

  return {
    stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
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
  return buildPolicyAutomationDecisionTrace({
    stateId,
    reasons,
    evidenceCounts: {
      identity: asArray(buckets.identity).length,
      routing: asArray(buckets.routing).length,
    },
    evidenceValidation,
    strongIdentity,
    routeMapped,
  });
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

function sanitizeProjectionFingerprint(projectionFingerprint = null) {
  if (!projectionFingerprint?.fingerprint) return null;

  const provenance = asObject(projectionFingerprint.provenance);

  return {
    version: normalizeString(projectionFingerprint.version) || null,
    algorithm: normalizeString(projectionFingerprint.algorithm) || null,
    fingerprint: normalizeString(projectionFingerprint.fingerprint),
    provenance: {
      projectionVersion: normalizeString(provenance.projectionVersion) || null,
      evidenceVersion: normalizeString(provenance.evidenceVersion) || null,
      totalEntryCount: Number.isFinite(Number(provenance.totalEntryCount))
        ? Number(provenance.totalEntryCount)
        : 0,
      sourceIds: asArray(provenance.sourceIds).map(String).sort(),
      runtimeSourceIds: asArray(provenance.runtimeSourceIds).map(String).sort(),
      authoritySourceIds: asArray(provenance.authoritySourceIds).map(String).sort(),
      demotionReasonIds: asArray(provenance.demotionReasonIds).map(String).sort(),
      warningReasonIds: asArray(provenance.warningReasonIds).map(String).sort(),
      bucketCounts: asArray(provenance.bucketCounts)
        .map(bucket => ({
          bucketId: normalizeString(bucket?.bucketId) || null,
          entryCount: Number.isFinite(Number(bucket?.entryCount))
            ? Number(bucket.entryCount)
            : 0,
        }))
        .sort((left, right) => String(left.bucketId).localeCompare(String(right.bucketId))),
      generatedFromLiveProvider: provenance.generatedFromLiveProvider === true,
      exposesRawProviderPayloads: provenance.exposesRawProviderPayloads === true,
      exposesUiChipLanguage: provenance.exposesUiChipLanguage === true,
    },
  };
}

function hasUnsafeProvenanceKey(value = {}) {
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(([key, nestedValue]) =>
    UNSAFE_PROVENANCE_KEYS.has(String(key).replace(/[^a-z0-9]/giu, '').toLowerCase()) ||
    (nestedValue && typeof nestedValue === 'object' && hasUnsafeProvenanceKey(nestedValue))
  );
}

function validateDecisionEvidenceFingerprint(decision = {}) {
  const issues = [];
  const fingerprint = decision.evidence?.projectionFingerprint;
  const fingerprintValue = normalizeString(fingerprint?.fingerprint);
  const traceFingerprint = normalizeString(
    decision.trace?.attributes?.[DECISION_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE]
  );

  if (!fingerprintValue) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.MISSING_EVIDENCE_FINGERPRINT,
      message: 'Automation decision must carry the runtime evidence projection fingerprint.',
    });
    return issues;
  }

  if (!FINGERPRINT_PATTERN.test(fingerprintValue) || fingerprint?.algorithm !== 'sha256') {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.MALFORMED_EVIDENCE_FINGERPRINT,
      message: 'Automation decision evidence fingerprint must be a SHA-256 hex digest.',
    });
  }

  if (hasUnsafeProvenanceKey(fingerprint.provenance)) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.RAW_EVIDENCE_PROVENANCE_EXPOSED,
      message: 'Automation decision fingerprint provenance must not expose raw labels or payload fields.',
    });
  }

  if (traceFingerprint && traceFingerprint !== fingerprintValue) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.TRACE_FINGERPRINT_MISMATCH,
      message: 'Automation decision trace fingerprint must match decision evidence.',
    });
  }

  return issues;
}

function validateDecisionEvidenceValidation(decision = {}) {
  const issues = [];
  const validation = decision.evidence?.validation;
  const hasValidationResult = validation &&
    typeof validation === 'object' &&
    typeof validation.ok === 'boolean';
  const traceEvidenceValid =
    decision.trace?.attributes?.[DECISION_EVIDENCE_VALID_TRACE_ATTRIBUTE];

  if (!hasValidationResult) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS
        .MISSING_RUNTIME_EVIDENCE_VALIDATION,
      message: 'Automation decision must carry the runtime evidence validation result.',
    });
    return issues;
  }

  if (validation.ok !== true) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.INVALID_RUNTIME_EVIDENCE,
      message: 'Automation decision cannot rely on invalid runtime evidence.',
    });
  }

  if (traceEvidenceValid !== validation.ok) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.TRACE_EVIDENCE_VALID_MISMATCH,
      message: 'Automation decision trace evidence-valid attribute must match runtime evidence validation.',
    });
  }

  return issues;
}

function requireRuntimeEvidenceProjection(input = {}) {
  const decisionInput = asObject(input);
  const rawEvidenceKey = Object.keys(decisionInput).find(key =>
    RUNTIME_EVIDENCE_INPUT_KEYS.has(key)
  );

  if (rawEvidenceKey) {
    throw new TypeError(
      `Automation decision requires a runtime evidence projection; raw evidence key "${rawEvidenceKey}" must use buildPolicyAutomationDecisionFromRuntimeInput.`
    );
  }

  if (decisionInput.evidenceProjection?.version !== 'policy.runtime_evidence_projection.v1') {
    throw new TypeError('Automation decision requires a policy.runtime_evidence_projection.v1 evidence projection.');
  }

  return decisionInput.evidenceProjection;
}

function buildDecisionOperationalInput(input = {}) {
  return Object.entries(asObject(input)).reduce((decisionInput, [key, value]) => {
    if (!RUNTIME_EVIDENCE_INPUT_KEYS.has(key) && key !== 'evidenceProjection') {
      decisionInput[key] = value;
    }

    return decisionInput;
  }, {});
}

function buildPolicyAutomationDecisionFromEvidenceProjection(input = {}) {
  const decisionInput = asObject(input);
  const evidenceProjection = requireRuntimeEvidenceProjection(decisionInput);
  const evidenceValidation = validatePolicyRuntimeEvidenceProjection(evidenceProjection);
  const buckets = getBuckets(evidenceProjection);
  const projectionFingerprint = sanitizeProjectionFingerprint(evidenceProjection.projectionFingerprint);
  const strongIdentity = buckets.identity.some(isStrongIdentityEntry);
  const routeMapped = isRoutingMapped(decisionInput, buckets);
  const routingIntent = hasRoutingIntent(decisionInput, buckets);
  const classificationComplete = isClassificationComplete(asObject(decisionInput.classification));
  const chosen = chooseDecisionState({
    input: decisionInput,
    buckets,
    strongIdentity,
    routeMapped,
    routingIntent,
    classificationComplete,
    evidenceValidation,
  });
  const state = getAutomationDecisionState(chosen.stateId);

  const decision = {
    version: 'policy.automation_decision.v1',
    stateId: chosen.stateId,
    actionId: state?.actionId || POLICY_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR,
    automationAllowed: state?.automationAllowed === true,
    routeAllowed: state?.routeAllowed === true,
    classificationAllowed: state?.classificationAllowed === true,
    routeMapped,
    strongIdentity,
    classificationComplete,
    evidence: {
      version: evidenceProjection.version,
      validation: evidenceValidation,
      projectionFingerprint,
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
    sideEffects: buildSideEffectSummary(decisionInput),
    trace: buildTrace({
      stateId: chosen.stateId,
      reasons: chosen.reasons,
      buckets,
      evidenceValidation,
      strongIdentity,
      routeMapped,
    }),
  };

  if (projectionFingerprint?.fingerprint) {
    decision.trace.attributes[DECISION_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE] =
      projectionFingerprint.fingerprint;
  }

  return decision;
}

function buildPolicyAutomationDecisionFromRuntimeInput(input = {}) {
  const runtimeInput = asObject(input);
  const evidenceProjection = buildPolicyRuntimeEvidenceProjection(runtimeInput);

  return buildPolicyAutomationDecisionFromEvidenceProjection({
    ...buildDecisionOperationalInput(runtimeInput),
    evidenceProjection,
  });
}

function validatePolicyAutomationDecision(decision = {}) {
  const issues = [];

  if (!normalizeString(decision.stateId)) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.MISSING_STATE,
      message: 'Automation decision must include a state id.',
    });
  } else if (!getAutomationDecisionState(decision.stateId)) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.UNKNOWN_STATE,
      message: 'Automation decision must use a supported policy automation state.',
    });
  }

  if (!normalizeString(decision.actionId)) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.MISSING_ACTION,
      message: 'Automation decision must include an action id.',
    });
  }

  if (asArray(decision.trace?.reasons).length === 0) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Automation decision must include bounded trace reasons.',
    });
  }

  if (
    asArray(decision.trace?.reasons).length > POLICY_AUTOMATION_DECISION_MAX_TRACE_REASONS ||
    decision.trace?.truncated === true
  ) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.TRACE_REASON_OVERFLOW,
      message: 'Automation decision trace must stay bounded.',
    });
  }

  issues.push(...validateDecisionEvidenceValidation(decision));
  issues.push(...validateDecisionEvidenceFingerprint(decision));

  const decisionTraceOutputAudit = buildPolicyAutomationDecisionOutputAudit({
    decision,
    additionalTraceAttributes: normalizeString(
      decision.evidence?.projectionFingerprint?.fingerprint
    )
      ? {
        [DECISION_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE]:
          normalizeString(decision.evidence.projectionFingerprint.fingerprint),
      }
      : {},
  });
  issues.push(...decisionTraceOutputAudit.issues);

  if (decision.stateId === POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY) {
    if (decision.strongIdentity !== true) {
      issues.push({
        riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITHOUT_STRONG_IDENTITY,
        message: 'Auto-route decisions require strong destination identity evidence.',
      });
    }

    if (decision.routeMapped !== true || decision.routeAllowed !== true) {
      issues.push({
        riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITHOUT_ROUTING,
        message: 'Auto-route decisions require a concrete route mapping.',
      });
    }

    const reasonIds = new Set(asArray(decision.trace?.reasons).map(reason => reason.reasonId));
    if (reasonIds.has(POLICY_AUTOMATION_DECISION_REASON_IDS.HARD_LIMIT_VIOLATION)) {
      issues.push({
        riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITH_HARD_LIMIT_BLOCK,
        message: 'Auto-route decisions cannot include a hard-limit block reason.',
      });
    }

    if (reasonIds.has(POLICY_AUTOMATION_DECISION_REASON_IDS.STALE_PROFILE)) {
      issues.push({
        riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITH_STALE_PROFILE,
        message: 'Auto-route decisions cannot include stale-profile reasons.',
      });
    }

    if (reasonIds.has(POLICY_AUTOMATION_DECISION_REASON_IDS.HIGH_RISK_EVIDENCE_CONFLICT)) {
      issues.push({
        riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITH_HIGH_RISK_CONFLICT,
        message: 'Auto-route decisions cannot include high-risk evidence conflicts.',
      });
    }
  }

  if (
    decision.stateId === POLICY_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED &&
    decision.routeAllowed === true
  ) {
    issues.push({
      riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.ROUTING_SUCCESS_CONFLATED_WITH_CLASSIFICATION,
      message: 'Classified-not-routed decisions cannot claim route success.',
    });
  }

  Object.entries(asObject(decision.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS.DECISION_PERFORMED_SIDE_EFFECT,
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

function buildPolicyAutomationDecisionContractAudit(
  decision = buildPolicyAutomationDecisionFromRuntimeInput()
) {
  const validation = validatePolicyAutomationDecision(decision);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedStateCount: listPolicyAutomationDecisionStates().length,
    maxTraceReasonCount: POLICY_AUTOMATION_DECISION_MAX_TRACE_REASONS,
    validation,
    nextStep: {
      stepId: 'runtime_question_reduction',
      label: 'Runtime Question Reduction',
      reason: 'Runtime automation can now distinguish route, classify-only, review, stale-profile, routing-gap, hard-limit, and insufficient-evidence states before question generation changes.',
    },
  };
}

export {
  POLICY_AUTOMATION_DECISION_ACTION_IDS,
  POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS,
  POLICY_AUTOMATION_DECISION_REASON_IDS,
  POLICY_AUTOMATION_DECISION_STATE_IDS,
  buildPolicyAutomationDecisionFromEvidenceProjection,
  buildPolicyAutomationDecisionFromRuntimeInput,
  buildPolicyAutomationDecisionContractAudit,
  getAutomationDecisionState,
  listPolicyAutomationDecisionStates,
  validatePolicyAutomationDecision,
};
