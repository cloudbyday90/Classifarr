import {
  POLICY_EVIDENCE_BUCKET_IDS,
  buildPolicyEvidenceProjection,
} from './policyEvidenceEngine.mjs';
import {
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
} from './policyEvidenceQuality.mjs';
import {
  POLICY_INTENT_CONFIDENCE_LEVEL_IDS,
  POLICY_INTENT_WARNING_IDS,
  buildPolicyIntentDraftFromEvidenceProjection,
} from './policyIntentEngine.mjs';
import {
  POLICY_LEARNING_DECISION_IDS,
  POLICY_LEARNING_TIER_IDS,
} from './policyLearningGuard.mjs';
import {
  buildPolicyAutomationReadinessInputSummary,
  normalizePolicyAutomationReadinessInputs,
} from './policyAutomationReadinessInputNormalizer.mjs';

const POLICY_AUTOMATION_READINESS_STATE_IDS = Object.freeze({
  READY: 'ready',
  NEEDS_MORE_EXAMPLES: 'needs_more_examples',
  NEEDS_OPERATOR_REVIEW: 'needs_operator_review',
  NEEDS_ROUTING: 'needs_routing',
  BLOCKED_BY_HARD_LIMIT: 'blocked_by_hard_limit',
  STALE_PROFILE: 'stale_profile',
});

const POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_BOUNDED_INPUT: 'blocked_by_bounded_input',
  BLOCKED_BY_READINESS_AUDIT: 'blocked_by_readiness_audit',
});

const POLICY_AUTOMATION_READINESS_REASON_IDS = Object.freeze({
  READY_FOR_AUTOMATION: 'ready_for_automation',
  HAS_IDENTITY_AND_ROUTING: 'has_identity_and_routing',
  MISSING_IDENTITY_EVIDENCE: 'missing_identity_evidence',
  INSUFFICIENT_EXAMPLES: 'insufficient_examples',
  INTENT_REVIEW_REQUIRED: 'intent_review_required',
  LEARNING_BLOCKED: 'learning_blocked',
  LEARNING_POLICY_EDIT_REQUIRED: 'learning_policy_edit_required',
  MISSING_ROUTING_TARGET: 'missing_routing_target',
  ROUTING_NOT_READY: 'routing_not_ready',
  HARD_LIMIT_CONFLICT: 'hard_limit_conflict',
  INTENT_BLOCKED: 'intent_blocked',
  STALE_PROFILE: 'stale_profile',
  PROFILE_REFRESH_QUEUED: 'profile_refresh_queued',
  DIAGNOSTIC_STATE_IGNORED: 'diagnostic_state_ignored',
});

const POLICY_AUTOMATION_READINESS_INPUT_IDS = Object.freeze({
  EVIDENCE: 'evidence',
  INTENT: 'intent',
  LEARNING: 'learning',
  ROUTING: 'routing',
  PROFILE_FRESHNESS: 'profile_freshness',
});

const POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS = Object.freeze({
  MISSING_STATE: 'missing_state',
  UNKNOWN_STATE: 'unknown_state',
  READY_STATE_MISMATCH: 'ready_state_mismatch',
  MISSING_NEXT_ACTION: 'missing_next_action',
  MISSING_REASON_CODE: 'missing_reason_code',
  ISSUE_WITHOUT_NEXT_ACTION: 'issue_without_next_action',
  LIVE_PROVIDER_DEPENDENCY: 'live_provider_dependency',
  DIAGNOSTIC_DEPENDENCY: 'diagnostic_dependency',
  RAW_PAYLOAD_DEPENDENCY: 'raw_payload_dependency',
  LEARNING_WRITE_DEPENDENCY: 'learning_write_dependency',
  UNKNOWN_IGNORED_DIAGNOSTIC: 'unknown_ignored_diagnostic',
  MISSING_BOUNDED_EVIDENCE: 'missing_bounded_evidence',
  MISSING_BOUNDED_INTENT: 'missing_bounded_intent',
  MISSING_BOUNDED_LEARNING: 'missing_bounded_learning',
  MISSING_BOUNDED_PROVENANCE: 'missing_bounded_provenance',
  BOUNDED_PROVENANCE_MISMATCH: 'bounded_provenance_mismatch',
  BOUNDED_EVIDENCE_AUDIT_NOT_PASSING: 'bounded_evidence_audit_not_passing',
  BOUNDED_INTENT_EVIDENCE_AUDIT_NOT_PASSING: 'bounded_intent_evidence_audit_not_passing',
  BOUNDED_LEARNING_AUDIT_NOT_PASSING: 'bounded_learning_audit_not_passing',
  MISSING_BOUNDED_QUALITY: 'missing_bounded_quality',
  BOUNDED_QUALITY_INSUFFICIENT: 'bounded_quality_insufficient',
  BOUNDED_QUALITY_MISMATCH: 'bounded_quality_mismatch',
});

const IGNORED_DIAGNOSTIC_INPUT_KEYS = Object.freeze([
  'impactPreview',
  'providerReadiness',
  'providerQuotaState',
  'rawScoringPanel',
  'replayParity',
  'replayPreview',
  'tmdbCoverage',
  'tmdbDiagnosticState',
]);

const STATE_CONTRACTS = Object.freeze([
  {
    id: POLICY_AUTOMATION_READINESS_STATE_IDS.READY,
    label: 'Ready',
    defaultActionId: 'continue_automation',
    defaultActionLabel: 'Continue automation',
  },
  {
    id: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
    label: 'Needs examples',
    defaultActionId: 'add_destination_examples',
    defaultActionLabel: 'Add examples',
  },
  {
    id: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW,
    label: 'Needs review',
    defaultActionId: 'review_destination_intent',
    defaultActionLabel: 'Review intent',
  },
  {
    id: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING,
    label: 'Needs routing',
    defaultActionId: 'configure_routing',
    defaultActionLabel: 'Configure routing',
  },
  {
    id: POLICY_AUTOMATION_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
    label: 'Blocked by hard limit',
    defaultActionId: 'edit_hard_limit',
    defaultActionLabel: 'Review hard limit',
  },
  {
    id: POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE,
    label: 'Stale profile',
    defaultActionId: 'refresh_profile',
    defaultActionLabel: 'Refresh profile',
  },
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

function getPolicyAutomationReadinessState(stateId) {
  return STATE_CONTRACTS.find(state => state.id === stateId) || null;
}

function listPolicyAutomationReadinessStates() {
  return STATE_CONTRACTS;
}

function hasNonInfoWarnings(intent = {}) {
  return asArray(intent.warnings).some(warning =>
    warning?.severity !== 'info' &&
    warning?.reasonCode !== POLICY_INTENT_WARNING_IDS.LEGACY_TEMPLATE_BRIDGE_ONLY
  );
}

function buildNextAction(stateId, reasonCode, overrides = {}) {
  const state = getPolicyAutomationReadinessState(stateId);

  return {
    actionId: overrides.actionId || state?.defaultActionId || 'review_readiness',
    label: overrides.label || state?.defaultActionLabel || 'Review readiness',
    target: overrides.target || null,
    reasonCode,
  };
}

function buildIssue({
  stateId,
  reasonCode,
  sourceId,
  summary,
  target = null,
}) {
  return {
    stateId,
    reasonCode,
    sourceId,
    summary,
    nextAction: buildNextAction(stateId, reasonCode, { target }),
  };
}

function collectIgnoredDiagnostics(input = {}) {
  return IGNORED_DIAGNOSTIC_INPUT_KEYS
    .filter(key => Object.prototype.hasOwnProperty.call(input, key))
    .map(key => ({
      key,
      reasonCode: POLICY_AUTOMATION_READINESS_REASON_IDS.DIAGNOSTIC_STATE_IGNORED,
      message: `${key} is intentionally ignored by policy automation readiness.`,
    }));
}

function buildInputsSummary({
  evidenceProjection,
  intent,
  learningDecision,
  ignoredDiagnostics,
  readinessInputs,
  boundaryContext = null,
}) {
  return {
    evidenceVersion: evidenceProjection?.version || null,
    intentVersion: intent?.version || null,
    learningVersion: learningDecision?.version || null,
    usesCachedStateOnly: true,
    liveProviderLookupPerformed: false,
    exposesRawPayload: false,
    diagnosticDependencies: [],
    learningWritesPerformed: learningDecision?.learning?.writesPerformed === true,
    ignoredDiagnostics,
    readinessInput: buildPolicyAutomationReadinessInputSummary(readinessInputs),
    boundaryContext,
  };
}

function hasStaleProfile(readinessInputs = {}, evidenceProjection = {}, intent = {}, learningDecision = {}) {
  const profileFreshness = asObject(readinessInputs.profileFreshness);
  const staleEvidence = asArray(evidenceProjection?.buckets?.[POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT])
    .some(entry => entry?.reasonCode === 'stale_profile' || entry?.stale === true);

  return profileFreshness.stale === true ||
    staleEvidence ||
    asArray(intent.warnings).some(warning =>
      warning?.reasonCode === POLICY_INTENT_WARNING_IDS.STALE_PROFILE
    ) ||
    learningDecision?.profileRefresh?.queue === true;
}

function hasHardLimitBlock(readinessInputs = {}, intent = {}, learningDecision = {}) {
  const learning = asObject(learningDecision.learning);

  return readinessInputs.hardLimitConflict === true ||
    intent?.confidence?.level === POLICY_INTENT_CONFIDENCE_LEVEL_IDS.BLOCKED ||
    learning.decisionId === POLICY_LEARNING_DECISION_IDS.POLICY_EDIT_REQUIRED ||
    (
      learning.tierId === POLICY_LEARNING_TIER_IDS.HARD_LIMIT_EVIDENCE &&
      learning.requiresExplicitPolicyEdit === true
    );
}

function hasRoutingReady(readinessInputs = {}, intent = {}) {
  const routing = asObject(readinessInputs.routing);
  const hasIntentRoutingTarget = asArray(intent.routing_target).length > 0;

  if (routing.invalidState === true || routing.configured === false || routing.routeReady === false) {
    return false;
  }

  if (routing.configured === true || routing.routeReady === true) {
    return hasIntentRoutingTarget || Boolean(normalizeString(routing.targetName));
  }

  return hasIntentRoutingTarget;
}

function collectReadinessIssues({
  readinessInputs,
  evidenceProjection,
  intent,
  learningDecision,
}) {
  const issues = [];
  const learning = asObject(learningDecision.learning);

  if (hasStaleProfile(readinessInputs, evidenceProjection, intent, learningDecision)) {
    issues.push(buildIssue({
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE,
      reasonCode: learningDecision?.profileRefresh?.queue === true
        ? POLICY_AUTOMATION_READINESS_REASON_IDS.PROFILE_REFRESH_QUEUED
        : POLICY_AUTOMATION_READINESS_REASON_IDS.STALE_PROFILE,
      sourceId: POLICY_AUTOMATION_READINESS_INPUT_IDS.PROFILE_FRESHNESS,
      summary: 'Refresh the destination profile before automation trusts this intent.',
      target: 'profile_refresh',
    }));
  }

  if (hasHardLimitBlock(readinessInputs, intent, learningDecision)) {
    issues.push(buildIssue({
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      reasonCode: learning.decisionId === POLICY_LEARNING_DECISION_IDS.POLICY_EDIT_REQUIRED
        ? POLICY_AUTOMATION_READINESS_REASON_IDS.LEARNING_POLICY_EDIT_REQUIRED
        : POLICY_AUTOMATION_READINESS_REASON_IDS.HARD_LIMIT_CONFLICT,
      sourceId: POLICY_AUTOMATION_READINESS_INPUT_IDS.INTENT,
      summary: 'Resolve the hard-limit conflict or make an explicit policy edit.',
      target: 'hard_limits',
    }));
  }

  if (asArray(intent.belongs_here).length === 0) {
    issues.push(buildIssue({
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
      reasonCode: POLICY_AUTOMATION_READINESS_REASON_IDS.MISSING_IDENTITY_EVIDENCE,
      sourceId: POLICY_AUTOMATION_READINESS_INPUT_IDS.EVIDENCE,
      summary: 'Add or accept destination examples before automation can continue.',
      target: 'belongs_here',
    }));
  }

  if (
    asArray(intent.ask_when).length > 0 ||
    hasNonInfoWarnings(intent) ||
    learning.decisionId === POLICY_LEARNING_DECISION_IDS.BLOCKED
  ) {
    issues.push(buildIssue({
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      reasonCode: learning.decisionId === POLICY_LEARNING_DECISION_IDS.BLOCKED
        ? POLICY_AUTOMATION_READINESS_REASON_IDS.LEARNING_BLOCKED
        : POLICY_AUTOMATION_READINESS_REASON_IDS.INTENT_REVIEW_REQUIRED,
      sourceId: POLICY_AUTOMATION_READINESS_INPUT_IDS.INTENT,
      summary: 'Review the destination intent before automation continues.',
      target: 'ask_when',
    }));
  }

  if (!hasRoutingReady(readinessInputs, intent)) {
    const routing = asObject(readinessInputs.routing);
    issues.push(buildIssue({
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING,
      reasonCode: routing.configured === false || routing.routeReady === false
        ? POLICY_AUTOMATION_READINESS_REASON_IDS.ROUTING_NOT_READY
        : POLICY_AUTOMATION_READINESS_REASON_IDS.MISSING_ROUTING_TARGET,
      sourceId: POLICY_AUTOMATION_READINESS_INPUT_IDS.ROUTING,
      summary: 'Choose or configure the routing target for confirmed matches.',
      target: 'routing_target',
    }));
  }

  return issues;
}

function chooseReadinessState(issues) {
  const priority = [
    POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE,
    POLICY_AUTOMATION_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
    POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
    POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW,
    POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING,
  ];

  return priority.find(stateId => issues.some(issue => issue.stateId === stateId)) ||
    POLICY_AUTOMATION_READINESS_STATE_IDS.READY;
}

function buildPolicyAutomationReadiness(input = {}) {
  const readinessInputs = normalizePolicyAutomationReadinessInputs({
    routing: input.routing,
    profileFreshness: input.profileFreshness,
    hardLimitConflict: input.hardLimitConflict,
  });
  const evidenceProjection = input.evidenceProjection?.version === 'policy.evidence.v1'
    ? input.evidenceProjection
    : buildPolicyEvidenceProjection(input);
  const intent = input.intentDraft?.version === 'policy.intent.v1' ||
    input.intent?.version === 'policy.intent.v1'
    ? input.intentDraft || input.intent
    : buildPolicyIntentDraftFromEvidenceProjection(evidenceProjection);
  const learningDecision = asObject(input.learningDecision);
  const ignoredDiagnostics = collectIgnoredDiagnostics(input);
  const issues = collectReadinessIssues({
    readinessInputs,
    evidenceProjection,
    intent,
    learningDecision,
  });
  const stateId = chooseReadinessState(issues);
  const ready = stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.READY;
  const reasonCodes = ready
    ? [
      POLICY_AUTOMATION_READINESS_REASON_IDS.READY_FOR_AUTOMATION,
      POLICY_AUTOMATION_READINESS_REASON_IDS.HAS_IDENTITY_AND_ROUTING,
    ]
    : [...new Set(issues.map(issue => issue.reasonCode))];

  return {
    version: 'policy.automation_readiness.v1',
    stateId,
    ready,
    nextAction: ready
      ? buildNextAction(stateId, POLICY_AUTOMATION_READINESS_REASON_IDS.READY_FOR_AUTOMATION)
      : issues.find(issue => issue.stateId === stateId)?.nextAction || null,
    issues,
    reasonCodes,
    inputs: buildInputsSummary({
      evidenceProjection,
      intent,
      learningDecision,
      ignoredDiagnostics,
      readinessInputs,
    }),
  };
}

function getProjectionFingerprintFromEvidenceResult(boundedEvidenceResult = {}) {
  return boundedEvidenceResult?.projectionFingerprint?.fingerprint || null;
}

function getProjectionFingerprintFromIntentResult(boundedIntentResult = {}) {
  return boundedIntentResult?.evidenceBoundary?.projectionFingerprint?.fingerprint || null;
}

function getProjectionFingerprintFromLearningResult(boundedLearningResult = {}) {
  return boundedLearningResult?.intentBoundary?.evidenceBoundary?.projectionFingerprint?.fingerprint || null;
}

function getQualityFromEvidenceResult(boundedEvidenceResult = {}) {
  return boundedEvidenceResult?.projection?.quality || null;
}

function getQualityFromIntentResult(boundedIntentResult = {}) {
  return boundedIntentResult?.evidenceBoundary?.quality || null;
}

function getQualityFromLearningResult(boundedLearningResult = {}) {
  return boundedLearningResult?.intentBoundary?.evidenceBoundary?.quality || null;
}

function normalizeQualitySnapshot(quality = null) {
  const normalized = asObject(quality);
  const reasonIds = asArray(normalized.reasonIds)
    .map(reasonId => normalizeString(reasonId))
    .filter(Boolean);

  return {
    version: normalized.version || null,
    statusId: normalized.statusId || null,
    score: Number.isFinite(Number(normalized.score)) ? Number(normalized.score) : null,
    nextActionId: normalized.nextActionId || null,
    reasonIds,
    counts: asObject(normalized.counts),
    hasIdentityEvidence: normalized.hasIdentityEvidence === true,
    hasDeclaredIdentityEvidence: normalized.hasDeclaredIdentityEvidence === true,
    hasObservedIdentityEvidence: normalized.hasObservedIdentityEvidence === true,
    hasStaleProfileEvidence: normalized.hasStaleProfileEvidence === true,
  };
}

function hasQualitySnapshot(quality = null) {
  return Boolean(normalizeQualitySnapshot(quality).statusId);
}

function qualitySnapshotsMatch(left = null, right = null) {
  const leftSnapshot = normalizeQualitySnapshot(left);
  const rightSnapshot = normalizeQualitySnapshot(right);

  return Boolean(leftSnapshot.statusId) &&
    leftSnapshot.version === rightSnapshot.version &&
    leftSnapshot.statusId === rightSnapshot.statusId &&
    leftSnapshot.nextActionId === rightSnapshot.nextActionId &&
    leftSnapshot.reasonIds.join('|') === rightSnapshot.reasonIds.join('|');
}

function collectBoundedQualityIssues({
  boundedEvidenceResult,
  boundedIntentResult,
  boundedLearningResult,
} = {}) {
  const issues = [];
  const evidenceQuality = getQualityFromEvidenceResult(boundedEvidenceResult);
  const intentQuality = getQualityFromIntentResult(boundedIntentResult);
  const learningQuality = getQualityFromLearningResult(boundedLearningResult);

  if (
    !hasQualitySnapshot(evidenceQuality) ||
    !hasQualitySnapshot(intentQuality) ||
    !hasQualitySnapshot(learningQuality)
  ) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
      message: 'Readiness requires bounded evidence, intent, and learning quality snapshots.',
    });
    return issues;
  }

  const qualitySnapshots = [
    normalizeQualitySnapshot(evidenceQuality),
    normalizeQualitySnapshot(intentQuality),
    normalizeQualitySnapshot(learningQuality),
  ];
  const insufficientQuality = qualitySnapshots.find(quality =>
    quality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT
  );

  if (insufficientQuality) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_QUALITY_INSUFFICIENT,
      message: 'Readiness requires usable bounded evidence quality before automation can be evaluated.',
      qualityStatusId: insufficientQuality.statusId,
      nextActionId: insufficientQuality.nextActionId,
      reasonIds: insufficientQuality.reasonIds,
    });
  }

  if (
    !qualitySnapshotsMatch(evidenceQuality, intentQuality) ||
    !qualitySnapshotsMatch(evidenceQuality, learningQuality)
  ) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_QUALITY_MISMATCH,
      message: 'Readiness requires bounded evidence, intent, and learning quality to match.',
    });
  }

  return issues;
}

function buildBoundedReadinessContext({
  boundedEvidenceResult,
  boundedIntentResult,
  boundedLearningResult,
} = {}) {
  const evidenceFingerprint = getProjectionFingerprintFromEvidenceResult(boundedEvidenceResult);
  const intentFingerprint = getProjectionFingerprintFromIntentResult(boundedIntentResult);
  const learningFingerprint = getProjectionFingerprintFromLearningResult(boundedLearningResult);

  if (!evidenceFingerprint || !intentFingerprint || !learningFingerprint) {
    return null;
  }

  return {
    evidenceBoundary: {
      version: boundedEvidenceResult.version || null,
      statusId: boundedEvidenceResult.statusId || null,
      quality: normalizeQualitySnapshot(getQualityFromEvidenceResult(boundedEvidenceResult)),
      projectionFingerprint: boundedEvidenceResult.projectionFingerprint,
    },
    intentBoundary: {
      statusId: boundedIntentResult.statusId || null,
      intentVersion: boundedIntentResult.intent?.version || null,
      quality: normalizeQualitySnapshot(getQualityFromIntentResult(boundedIntentResult)),
      projectionFingerprint:
        boundedIntentResult.evidenceBoundary?.projectionFingerprint || null,
    },
    learningBoundary: {
      statusId: boundedLearningResult.statusId || null,
      learningVersion: boundedLearningResult.decision?.version || null,
      quality: normalizeQualitySnapshot(getQualityFromLearningResult(boundedLearningResult)),
      projectionFingerprint:
        boundedLearningResult.intentBoundary?.evidenceBoundary?.projectionFingerprint || null,
    },
    projectionFingerprintMatch:
      evidenceFingerprint === intentFingerprint
      && evidenceFingerprint === learningFingerprint,
  };
}

function buildPolicyAutomationReadinessFromBoundedContracts({
  boundedEvidenceResult,
  boundedIntentResult,
  boundedLearningResult,
  routing = {},
  profileFreshness = {},
} = {}) {
  const boundaryIssues = [];

  if (boundedEvidenceResult?.ok !== true || !boundedEvidenceResult?.projection) {
    boundaryIssues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_EVIDENCE,
      message: 'Readiness requires a successful bounded evidence result.',
    });
  }

  if (boundedIntentResult?.ok !== true || !boundedIntentResult?.intent) {
    boundaryIssues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_INTENT,
      message: 'Readiness requires a successful bounded intent result.',
    });
  }

  if (boundedLearningResult?.ok !== true || !boundedLearningResult?.decision) {
    boundaryIssues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_LEARNING,
      message: 'Readiness requires a successful bounded learning result.',
    });
  }

  if (
    boundedEvidenceResult?.ok === true &&
    (
      boundedEvidenceResult.projectionAudit?.ok !== true ||
      boundedEvidenceResult.projectionFingerprintAudit?.ok !== true
    )
  ) {
    boundaryIssues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_EVIDENCE_AUDIT_NOT_PASSING,
      message: 'Readiness requires passing bounded evidence projection and fingerprint audits.',
    });
  }

  if (
    boundedIntentResult?.ok === true &&
    (
      boundedIntentResult.intentAudit?.ok !== true ||
      boundedIntentResult.evidenceFingerprintAudit?.ok !== true
    )
  ) {
    boundaryIssues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_INTENT_EVIDENCE_AUDIT_NOT_PASSING,
      message: 'Readiness requires passing bounded intent and evidence-fingerprint audits.',
    });
  }

  if (boundedLearningResult?.ok === true && boundedLearningResult.learningAudit?.ok !== true) {
    boundaryIssues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_LEARNING_AUDIT_NOT_PASSING,
      message: 'Readiness requires a passing bounded learning audit.',
    });
  }

  if (
    boundedEvidenceResult?.ok === true &&
    boundedIntentResult?.ok === true &&
    boundedLearningResult?.ok === true
  ) {
    boundaryIssues.push(...collectBoundedQualityIssues({
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult,
    }));
  }

  const boundaryContext = buildBoundedReadinessContext({
    boundedEvidenceResult,
    boundedIntentResult,
    boundedLearningResult,
  });

  if (!boundaryContext) {
    boundaryIssues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_BOUNDED_PROVENANCE,
      message: 'Readiness requires matching bounded evidence provenance.',
    });
  } else if (boundaryContext.projectionFingerprintMatch !== true) {
    boundaryIssues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.BOUNDED_PROVENANCE_MISMATCH,
      message: 'Readiness requires all bounded contracts to reference the same evidence projection.',
    });
  }

  if (boundaryIssues.length > 0) {
    return {
      ok: false,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      boundaryContext,
      readiness: null,
      readinessAudit: null,
      issueCount: boundaryIssues.length,
      issues: boundaryIssues,
      nextStep: null,
    };
  }

  const readiness = buildPolicyAutomationReadiness({
    evidenceProjection: boundedEvidenceResult.projection,
    intentDraft: boundedIntentResult.intent,
    learningDecision: boundedLearningResult.decision,
    routing,
    profileFreshness,
  });
  readiness.inputs.boundaryContext = boundaryContext;
  const readinessAudit = buildPolicyAutomationReadinessEngineAudit(readiness);
  const ok = readinessAudit.ok === true;

  return {
    ok,
    statusId: ok
      ? POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.READY
      : POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.BLOCKED_BY_READINESS_AUDIT,
    boundaryContext,
    readiness,
    readinessAudit,
    issueCount: readinessAudit.issueCount,
    issues: readinessAudit.validation.issues,
    nextStep: ok ? readinessAudit.nextStep : null,
  };
}

function validatePolicyAutomationReadiness(readiness = {}) {
  const issues = [];

  if (!normalizeString(readiness.stateId)) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_STATE,
      message: 'Readiness must include a state id.',
    });
  } else if (!getPolicyAutomationReadinessState(readiness.stateId)) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.UNKNOWN_STATE,
      message: 'Readiness must use a supported state id.',
    });
  }

  if ((readiness.ready === true) !==
      (readiness.stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.READY)) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.READY_STATE_MISMATCH,
      message: 'Readiness ready boolean must match the ready state.',
    });
  }

  if (!readiness.nextAction?.actionId) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_NEXT_ACTION,
      message: 'Readiness must include a next action.',
    });
  }

  if (asArray(readiness.reasonCodes).length === 0) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_REASON_CODE,
      message: 'Readiness must include reason codes.',
    });
  }

  asArray(readiness.issues).forEach(issue => {
    if (!issue?.reasonCode) {
      issues.push({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.MISSING_REASON_CODE,
        message: 'Each readiness issue must include a reason code.',
      });
    }
    if (!issue?.nextAction?.actionId) {
      issues.push({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.ISSUE_WITHOUT_NEXT_ACTION,
        message: 'Each readiness issue must include a next action.',
      });
    }
  });

  if (readiness.inputs?.liveProviderLookupPerformed === true) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.LIVE_PROVIDER_DEPENDENCY,
      message: 'Readiness must not depend on live provider lookups.',
    });
  }

  if (readiness.inputs?.exposesRawPayload === true) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.RAW_PAYLOAD_DEPENDENCY,
      message: 'Readiness must not expose raw provider, replay, or scoring payloads.',
    });
  }

  if (asArray(readiness.inputs?.diagnosticDependencies).length > 0) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.DIAGNOSTIC_DEPENDENCY,
      message: 'Readiness must not depend on replay, TMDB, provider, or scoring diagnostics.',
    });
  }

  asArray(readiness.inputs?.ignoredDiagnostics).forEach(diagnostic => {
    if (!IGNORED_DIAGNOSTIC_INPUT_KEYS.includes(diagnostic?.key)) {
      issues.push({
        riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.UNKNOWN_IGNORED_DIAGNOSTIC,
        message: 'Ignored diagnostics must be from the known legacy diagnostic list.',
      });
    }
  });

  if (readiness.inputs?.learningWritesPerformed === true) {
    issues.push({
      riskId: POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS.LEARNING_WRITE_DEPENDENCY,
      message: 'Readiness must not depend on learning writes having already occurred.',
    });
  }

  if (readiness.inputs?.boundaryContext) {
    const boundaryContext = asObject(readiness.inputs.boundaryContext);
    issues.push(...collectBoundedQualityIssues({
      boundedEvidenceResult: {
        ok: true,
        projection: {
          quality: boundaryContext.evidenceBoundary?.quality,
        },
      },
      boundedIntentResult: {
        ok: true,
        evidenceBoundary: {
          quality: boundaryContext.intentBoundary?.quality,
        },
      },
      boundedLearningResult: {
        ok: true,
        intentBoundary: {
          evidenceBoundary: {
            quality: boundaryContext.learningBoundary?.quality,
          },
        },
      },
    }));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyAutomationReadinessEngineAudit(
  readiness = buildPolicyAutomationReadiness()
) {
  const validation = validatePolicyAutomationReadiness(readiness);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedStateCount: STATE_CONTRACTS.length,
    ignoredDiagnosticInputCount: IGNORED_DIAGNOSTIC_INPUT_KEYS.length,
    validation,
    nextStep: {
      stepId: 'operator_workflow',
      label: 'Policy Operator Workflow',
      reason: 'Automation readiness now returns a single action-oriented state, so the product surface can replace diagnostic panels with the next operator action.',
    },
  };
}

export {
  POLICY_AUTOMATION_READINESS_AUDIT_RISK_IDS,
  POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS,
  POLICY_AUTOMATION_READINESS_INPUT_IDS,
  POLICY_AUTOMATION_READINESS_REASON_IDS,
  POLICY_AUTOMATION_READINESS_STATE_IDS,
  buildPolicyAutomationReadiness,
  buildPolicyAutomationReadinessFromBoundedContracts,
  buildPolicyAutomationReadinessEngineAudit,
  getPolicyAutomationReadinessState,
  listPolicyAutomationReadinessStates,
  validatePolicyAutomationReadiness,
};
