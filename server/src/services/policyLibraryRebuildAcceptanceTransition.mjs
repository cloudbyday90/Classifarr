import { createHash } from 'node:crypto';

import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from './policyConversionActorSources.mjs';
import {
  POLICY_REBUILD_PROPOSAL_STATUS_IDS,
  validatePolicyLibraryPolicyRebuildProposal,
} from './policyLibraryPolicyRebuild.mjs';
import {
  POLICY_ROLLBACK_SNAPSHOT_WINDOW_VERSION,
  POLICY_ROLLBACK_STATUS_IDS,
  validatePolicyRollbackSnapshotWindow,
} from './policyRollbackSnapshotWindow.mjs';

const POLICY_LIBRARY_REBUILD_ACCEPTANCE_TRANSITION_VERSION =
  'policy.library_rebuild_acceptance_transition.v1';
const POLICY_LIBRARY_REBUILD_ACCEPTANCE_FINGERPRINT_VERSION =
  'policy.library_rebuild_acceptance_fingerprint.v1';

const POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS = Object.freeze({
  AWAITING_OPERATOR_ACCEPTANCE: 'awaiting_operator_acceptance',
  READY_FOR_MIGRATION_VERIFICATION: 'ready_for_migration_verification',
  BLOCKED_BY_PROPOSAL: 'blocked_by_proposal',
  BLOCKED_BY_ROLLBACK_PLAN: 'blocked_by_rollback_plan',
  EXPIRED: 'expired',
});

const POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS = Object.freeze({
  PROPOSAL_VALIDATED: 'proposal_validated',
  PROPOSAL_FINGERPRINTED: 'proposal_fingerprinted',
  POLICY_CONTEXT_BOUND: 'policy_context_bound',
  ROLLBACK_PLAN_VALIDATED: 'rollback_plan_validated',
  OPERATOR_ACCEPTANCE_REQUIRED: 'operator_acceptance_required',
  ACCEPTANCE_WINDOW_BOUNDED: 'acceptance_window_bounded',
  PERSISTENT_REPLAY_PROTECTION_REQUIRED: 'persistent_replay_protection_required',
  PERSISTED_ROLLBACK_SNAPSHOT_REQUIRED: 'persisted_rollback_snapshot_required',
  REPLACEMENT_DISABLED: 'replacement_disabled',
});

const POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS = Object.freeze({
  INVALID_TRANSITION_VERSION: 'invalid_transition_version',
  UNSAFE_TRANSITION_DATA: 'unsafe_transition_data',
  INVALID_PROPOSAL: 'invalid_proposal',
  PROPOSAL_NOT_REVIEWABLE: 'proposal_not_reviewable',
  LEGACY_PROPOSAL_ACCEPTANCE_USED: 'legacy_proposal_acceptance_used',
  LEGACY_PROPOSAL_SNAPSHOT_USED: 'legacy_proposal_snapshot_used',
  MISSING_POLICY_CONTEXT: 'missing_policy_context',
  POLICY_CONTEXT_LIBRARY_MISMATCH: 'policy_context_library_mismatch',
  INVALID_ROLLBACK_PLAN: 'invalid_rollback_plan',
  ROLLBACK_PLAN_CONTEXT_MISMATCH: 'rollback_plan_context_mismatch',
  ROLLBACK_PLAN_NOT_READY: 'rollback_plan_not_ready',
  PROPOSAL_FINGERPRINT_MISMATCH: 'proposal_fingerprint_mismatch',
  ROLLBACK_PLAN_FINGERPRINT_MISMATCH: 'rollback_plan_fingerprint_mismatch',
  INVALID_OPERATOR_ACCEPTANCE: 'invalid_operator_acceptance',
  UNAPPROVED_OPERATOR_SOURCE: 'unapproved_operator_source',
  MISSING_OPERATOR_REFERENCE: 'missing_operator_reference',
  UNBOUNDED_ACCEPTANCE_WINDOW: 'unbounded_acceptance_window',
  ACCEPTANCE_EXPIRED: 'acceptance_expired',
  TRANSITION_STATUS_MISMATCH: 'transition_status_mismatch',
  TRANSITION_FINGERPRINT_MISMATCH: 'transition_fingerprint_mismatch',
  INVALID_REPLAY_PROTECTION: 'invalid_replay_protection',
  DIRECT_REPLACEMENT_ALLOWED: 'direct_replacement_allowed',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_TRACE_REASON: 'missing_trace_reason',
});

const POLICY_LIBRARY_REBUILD_ACCEPTANCE_DECISION_IDS = Object.freeze({
  ACCEPT_REBUILD: 'accept_rebuild',
});

const REVIEWABLE_PROPOSAL_STATUS_IDS = new Set([
  POLICY_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW,
  POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_OPERATOR_CONSTRAINT_REVIEW,
]);
const ALLOWED_ACCEPTANCE_ACTOR_SOURCE_IDS = new Set([
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
]);
const ALLOWED_OPERATOR_DECISION_KEYS = new Set([
  'actorId',
  'actorSourceId',
  'decisionId',
]);
const DISALLOWED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const ACCEPTANCE_WINDOW_DEFAULT_MINUTES = 30;
const ACCEPTANCE_WINDOW_MIN_MINUTES = 5;
const ACCEPTANCE_WINDOW_MAX_MINUTES = 60;
const MAX_PLAIN_DATA_DEPTH = 32;
const MAX_PLAIN_DATA_ENTRIES = 2048;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Library rebuild acceptance requires a valid server evaluation time.');
  }

  return date;
}

function addMinutes(value, minutes) {
  const result = new Date(value.getTime());
  result.setUTCMinutes(result.getUTCMinutes() + minutes);
  return result.toISOString();
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((normalized, key) => {
      const child = stableValue(value[key]);
      if (child !== undefined) {
        normalized[key] = child;
      }
      return normalized;
    }, {});
}

function sha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function buildFingerprint(payload) {
  return {
    version: POLICY_LIBRARY_REBUILD_ACCEPTANCE_FINGERPRINT_VERSION,
    algorithm: 'sha256',
    fingerprint: sha256(payload),
  };
}

function inspectPlainData(value, {
  path = 'value',
  depth = 0,
  state = {
    entryCount: 0,
    traversed: new WeakSet(),
    ancestors: new WeakSet(),
  },
} = {}) {
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) {
    return [];
  }

  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    return [`${path} must contain JSON-compatible plain data.`];
  }

  if (depth > MAX_PLAIN_DATA_DEPTH) {
    return [`${path} exceeds the maximum plain-data depth.`];
  }

  if (!value || typeof value !== 'object') {
    return [`${path} must contain plain data.`];
  }

  if (state.ancestors.has(value)) {
    return [`${path} must not contain circular data.`];
  }

  // Existing validated proposal contracts may intentionally share a bounded
  // projection object across their read models. Reuse is safe; only a reference
  // back into the active ancestor chain is a cycle.
  if (state.traversed.has(value)) {
    return [];
  }
  state.traversed.add(value);
  state.ancestors.add(value);

  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (!isArray && prototype !== Object.prototype && prototype !== null) {
    return [`${path} must be a plain object.`];
  }

  const issues = [];
  Reflect.ownKeys(value).forEach(key => {
    state.entryCount += 1;
    if (state.entryCount > MAX_PLAIN_DATA_ENTRIES) {
      issues.push(`${path} exceeds the maximum plain-data entry count.`);
      return;
    }

    if (typeof key !== 'string') {
      issues.push(`${path} must not contain symbol keys.`);
      return;
    }

    if (DISALLOWED_OBJECT_KEYS.has(key)) {
      issues.push(`${path}.${key} is not allowed.`);
      return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set) {
      issues.push(`${path}.${key} must not use an accessor.`);
      return;
    }

    issues.push(...inspectPlainData(descriptor.value, {
      path: isArray ? `${path}[${key}]` : `${path}.${key}`,
      depth: depth + 1,
      state,
    }));
  });

  state.ancestors.delete(value);

  return issues;
}

function assertPlainData(value, name) {
  const issues = inspectPlainData(value, { path: name });
  if (issues.length > 0) {
    throw new TypeError(`Library rebuild acceptance requires safe ${name}: ${issues[0]}`);
  }
}

function normalizePolicyContext(value = {}) {
  const context = asObject(value);

  return {
    policyId: normalizePositiveInteger(context.policyId ?? context.policy_id),
    intentId: normalizePositiveInteger(context.intentId ?? context.intent_id),
    libraryId: normalizePositiveInteger(context.libraryId ?? context.library_id),
  };
}

function policyContextIsComplete(context = {}) {
  return Number.isInteger(context.policyId) &&
    Number.isInteger(context.intentId) &&
    Number.isInteger(context.libraryId);
}

function normalizeWindowMinutes(value) {
  if (value === undefined || value === null) {
    return ACCEPTANCE_WINDOW_DEFAULT_MINUTES;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) ||
      numeric < ACCEPTANCE_WINDOW_MIN_MINUTES ||
      numeric > ACCEPTANCE_WINDOW_MAX_MINUTES) {
    throw new TypeError(
      `Library rebuild acceptance window must be between ${ACCEPTANCE_WINDOW_MIN_MINUTES} and ${ACCEPTANCE_WINDOW_MAX_MINUTES} minutes.`
    );
  }

  return numeric;
}

function normalizeOperatorDecision(value) {
  if (value === undefined || value === null) return null;

  assertPlainData(value, 'operatorDecision');
  const decision = asObject(value);
  const unexpectedKey = Object.keys(decision).find(key => !ALLOWED_OPERATOR_DECISION_KEYS.has(key));
  if (unexpectedKey) {
    throw new TypeError(`Library rebuild acceptance does not allow operator decision key "${unexpectedKey}".`);
  }

  const actorId = normalizeString(decision.actorId);
  const actorSourceId = normalizeString(decision.actorSourceId);
  const decisionId = normalizeString(decision.decisionId);
  if (!actorId || actorId.length > 160 ||
      !ALLOWED_ACCEPTANCE_ACTOR_SOURCE_IDS.has(actorSourceId) ||
      decisionId !== POLICY_LIBRARY_REBUILD_ACCEPTANCE_DECISION_IDS.ACCEPT_REBUILD) {
    throw new TypeError(
      'Library rebuild acceptance requires a manual operator accept_rebuild decision with a bounded actor id.'
    );
  }

  return {
    actorSourceId,
    actorReference: sha256({ actorId }),
    decisionId,
  };
}

function buildProposalFingerprint(proposal) {
  return buildFingerprint({
    type: 'library_rebuild_proposal',
    proposal,
  });
}

function buildRollbackPlanFingerprint(rollbackWindowPlan) {
  return buildFingerprint({
    type: 'rollback_window_plan',
    rollbackWindowPlan,
  });
}

function buildTransitionFingerprint({
  statusId,
  policyContext,
  proposalFingerprint,
  rollbackPlanFingerprint,
  acceptance,
}) {
  return buildFingerprint({
    version: POLICY_LIBRARY_REBUILD_ACCEPTANCE_TRANSITION_VERSION,
    statusId,
    policyContext,
    proposalFingerprint: proposalFingerprint.fingerprint,
    rollbackPlanFingerprint: rollbackPlanFingerprint.fingerprint,
    acceptance: {
      accepted: acceptance.accepted === true,
      actorSourceId: acceptance.actorSourceId || null,
      actorReference: acceptance.actorReference || null,
      acceptedAt: acceptance.acceptedAt || null,
      expiresAt: acceptance.expiresAt || null,
      windowMinutes: acceptance.windowMinutes,
    },
  });
}

function proposalReviewabilityIssues(proposal, policyContext) {
  const issues = [];
  const proposalValidation = validatePolicyLibraryPolicyRebuildProposal(proposal);
  if (!proposalValidation.ok) {
    issues.push(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.INVALID_PROPOSAL);
  }

  if (!REVIEWABLE_PROPOSAL_STATUS_IDS.has(proposal.statusId)) {
    issues.push(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.PROPOSAL_NOT_REVIEWABLE);
  }

  if (proposal.acceptanceGate?.accepted === true) {
    issues.push(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.LEGACY_PROPOSAL_ACCEPTANCE_USED);
  }

  if (proposal.rollbackGate?.snapshotCreated === true) {
    issues.push(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.LEGACY_PROPOSAL_SNAPSHOT_USED);
  }

  if (!policyContextIsComplete(policyContext)) {
    issues.push(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.MISSING_POLICY_CONTEXT);
  } else if (normalizePositiveInteger(proposal.library?.libraryId) !== policyContext.libraryId) {
    issues.push(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.POLICY_CONTEXT_LIBRARY_MISMATCH);
  }

  return issues;
}

function rollbackPlanIssues(rollbackWindowPlan, policyContext, now) {
  const issues = [];
  const rollbackValidation = validatePolicyRollbackSnapshotWindow(rollbackWindowPlan);
  if (!rollbackValidation.ok) {
    issues.push(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.INVALID_ROLLBACK_PLAN);
  }

  if (rollbackWindowPlan.version !== POLICY_ROLLBACK_SNAPSHOT_WINDOW_VERSION ||
      rollbackWindowPlan.statusId !== POLICY_ROLLBACK_STATUS_IDS.REVERT_READY ||
      rollbackWindowPlan.snapshot?.planned !== true ||
      rollbackWindowPlan.revert?.eligible !== true) {
    issues.push(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.ROLLBACK_PLAN_NOT_READY);
  }

  if (rollbackWindowPlan.policyId !== policyContext.policyId ||
      rollbackWindowPlan.intentId !== policyContext.intentId ||
      normalizePositiveInteger(rollbackWindowPlan.snapshot?.policyId) !== policyContext.policyId ||
      normalizePositiveInteger(rollbackWindowPlan.snapshot?.intentId) !== policyContext.intentId) {
    issues.push(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.ROLLBACK_PLAN_CONTEXT_MISMATCH);
  }

  const expiresAt = new Date(rollbackWindowPlan.snapshot?.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    issues.push(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.ROLLBACK_PLAN_NOT_READY);
  }

  return issues;
}

function hasSideEffects(value = {}) {
  return Object.values(asObject(value)).some(entry => entry === true);
}

function determineStatus({ proposalIssues, rollbackIssues, acceptance, now }) {
  if (proposalIssues.length > 0) {
    return POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.BLOCKED_BY_PROPOSAL;
  }

  if (rollbackIssues.length > 0) {
    return POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.BLOCKED_BY_ROLLBACK_PLAN;
  }

  if (acceptance.accepted !== true) {
    return POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.AWAITING_OPERATOR_ACCEPTANCE;
  }

  if (new Date(acceptance.expiresAt).getTime() <= now.getTime()) {
    return POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.EXPIRED;
  }

  return POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION;
}

function buildTrace({ statusId, proposalFingerprint, rollbackPlanFingerprint, acceptance }) {
  const reasons = [
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS.PROPOSAL_VALIDATED,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS.PROPOSAL_FINGERPRINTED,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS.POLICY_CONTEXT_BOUND,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS.ROLLBACK_PLAN_VALIDATED,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS.OPERATOR_ACCEPTANCE_REQUIRED,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS.ACCEPTANCE_WINDOW_BOUNDED,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS.PERSISTENT_REPLAY_PROTECTION_REQUIRED,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS.PERSISTED_ROLLBACK_SNAPSHOT_REQUIRED,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS.REPLACEMENT_DISABLED,
  ];

  return {
    attributes: {
      'classifarr.policy.library_rebuild_acceptance.version':
        POLICY_LIBRARY_REBUILD_ACCEPTANCE_TRANSITION_VERSION,
      'classifarr.policy.library_rebuild_acceptance.status': statusId,
      'classifarr.policy.library_rebuild_acceptance.proposal_fingerprint': proposalFingerprint.fingerprint,
      'classifarr.policy.library_rebuild_acceptance.rollback_plan_fingerprint':
        rollbackPlanFingerprint.fingerprint,
      'classifarr.policy.library_rebuild_acceptance.accepted': acceptance.accepted === true,
      'classifarr.policy.library_rebuild_acceptance.window_minutes': acceptance.windowMinutes,
    },
    reasons: reasons.map(reasonId => ({ reasonId, severity: 'info' })),
  };
}

function buildPolicyLibraryRebuildAcceptanceTransition({
  proposal = {},
  policyContext = {},
  rollbackWindowPlan = {},
  operatorDecision = null,
  acceptanceWindowMinutes = ACCEPTANCE_WINDOW_DEFAULT_MINUTES,
  now = new Date(),
} = {}) {
  assertPlainData(proposal, 'proposal');
  assertPlainData(policyContext, 'policyContext');
  assertPlainData(rollbackWindowPlan, 'rollbackWindowPlan');

  const evaluationTime = normalizeDate(now);
  const normalizedPolicyContext = normalizePolicyContext(policyContext);
  const normalizedDecision = normalizeOperatorDecision(operatorDecision);
  const boundedWindowMinutes = normalizeWindowMinutes(acceptanceWindowMinutes);
  const proposalFingerprint = buildProposalFingerprint(proposal);
  const rollbackPlanFingerprint = buildRollbackPlanFingerprint(rollbackWindowPlan);
  const provisionalAcceptance = normalizedDecision
    ? {
      required: true,
      accepted: true,
      actorSourceId: normalizedDecision.actorSourceId,
      actorReference: normalizedDecision.actorReference,
      acceptedAt: evaluationTime.toISOString(),
      expiresAt: addMinutes(evaluationTime, boundedWindowMinutes),
      windowMinutes: boundedWindowMinutes,
    }
    : {
      required: true,
      accepted: false,
      actorSourceId: null,
      actorReference: null,
      acceptedAt: null,
      expiresAt: null,
      windowMinutes: boundedWindowMinutes,
    };
  const proposalIssues = proposalReviewabilityIssues(proposal, normalizedPolicyContext);
  const rollbackIssues = rollbackPlanIssues(rollbackWindowPlan, normalizedPolicyContext, evaluationTime);
  const statusId = determineStatus({
    proposalIssues,
    rollbackIssues,
    acceptance: provisionalAcceptance,
    now: evaluationTime,
  });
  const transitionFingerprint = buildTransitionFingerprint({
    statusId,
    policyContext: normalizedPolicyContext,
    proposalFingerprint,
    rollbackPlanFingerprint,
    acceptance: provisionalAcceptance,
  });
  const readyForMigrationVerification =
    statusId === POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION;
  const transition = {
    version: POLICY_LIBRARY_REBUILD_ACCEPTANCE_TRANSITION_VERSION,
    statusId,
    policyContext: normalizedPolicyContext,
    evaluatedAt: evaluationTime.toISOString(),
    proposalFingerprint,
    rollbackWindowPlan,
    rollbackPlanFingerprint,
    acceptance: provisionalAcceptance,
    replayProtection: {
      idempotencyKey: `policy:library_rebuild_acceptance:${transitionFingerprint.fingerprint}`,
      persistentRecordRequired: true,
      replayEnforcedInThisContract: false,
    },
    application: {
      canEnterMigrationVerification: readyForMigrationVerification,
      canApplyReplacement: false,
      requiresPersistedRollbackSnapshot: true,
      persistedRollbackSnapshotPresent: false,
      replacementBlockedReason: readyForMigrationVerification
        ? 'persisted_rollback_snapshot_required'
        : statusId,
    },
    sideEffects: {
      acceptancePersisted: false,
      rollbackSnapshotCreated: false,
      policyReplaced: false,
      policyDeleted: false,
      routingWritten: false,
      learningWritten: false,
    },
    transitionFingerprint,
    trace: buildTrace({
      statusId,
      proposalFingerprint,
      rollbackPlanFingerprint,
      acceptance: provisionalAcceptance,
    }),
  };

  return {
    ...transition,
    validation: validatePolicyLibraryRebuildAcceptanceTransition({
      transition,
      proposal,
      now: evaluationTime,
    }),
  };
}

function validatePolicyLibraryRebuildAcceptanceTransition({
  transition = {},
  proposal = {},
  now = new Date(),
} = {}) {
  const issues = [];
  let evaluationTime;

  try {
    evaluationTime = normalizeDate(now);
  } catch {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.INVALID_OPERATOR_ACCEPTANCE,
      message: 'Library rebuild acceptance validation requires a valid evaluation time.',
    });
    evaluationTime = new Date(0);
  }

  const transitionSafetyIssues = inspectPlainData(transition, { path: 'transition' });
  const proposalSafetyIssues = inspectPlainData(proposal, { path: 'proposal' });
  if (transitionSafetyIssues.length > 0 || proposalSafetyIssues.length > 0) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.UNSAFE_TRANSITION_DATA,
      message: 'Library rebuild acceptance must use bounded plain-data proposal and transition records.',
    });

    return {
      ok: false,
      issueCount: issues.length,
      issues,
    };
  }

  const normalizedTransition = asObject(transition);
  const normalizedPolicyContext = normalizePolicyContext(normalizedTransition.policyContext);
  const rollbackWindowPlan = asObject(normalizedTransition.rollbackWindowPlan);
  const acceptance = asObject(normalizedTransition.acceptance);
  const proposalValidation = validatePolicyLibraryPolicyRebuildProposal(proposal);
  const proposalIssues = proposalReviewabilityIssues(proposal, normalizedPolicyContext);
  const rollbackIssues = rollbackPlanIssues(rollbackWindowPlan, normalizedPolicyContext, evaluationTime);

  if (normalizedTransition.version !== POLICY_LIBRARY_REBUILD_ACCEPTANCE_TRANSITION_VERSION) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.INVALID_TRANSITION_VERSION,
      message: 'Library rebuild acceptance transition must use the supported version.',
    });
  }

  if (!proposalValidation.ok || proposalIssues.includes(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.INVALID_PROPOSAL)) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.INVALID_PROPOSAL,
      message: 'Library rebuild acceptance transition must bind a valid rebuild proposal.',
    });
  }

  if (proposalIssues.includes(POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.PROPOSAL_NOT_REVIEWABLE)) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.PROPOSAL_NOT_REVIEWABLE,
      message: 'Only reviewable rebuild proposals can receive operator acceptance.',
    });
  }

  [
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.LEGACY_PROPOSAL_ACCEPTANCE_USED,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.LEGACY_PROPOSAL_SNAPSHOT_USED,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.MISSING_POLICY_CONTEXT,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.POLICY_CONTEXT_LIBRARY_MISMATCH,
  ].forEach(riskId => {
    if (proposalIssues.includes(riskId)) {
      issues.push({
        riskId,
        message: 'Library rebuild acceptance must not trust legacy proposal gate values or an unrelated policy context.',
      });
    }
  });

  [
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.INVALID_ROLLBACK_PLAN,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.ROLLBACK_PLAN_CONTEXT_MISMATCH,
    POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.ROLLBACK_PLAN_NOT_READY,
  ].forEach(riskId => {
    if (rollbackIssues.includes(riskId)) {
      issues.push({
        riskId,
        message: 'Library rebuild acceptance requires a current rollback-window plan bound to the same policy and intent.',
      });
    }
  });

  const expectedProposalFingerprint = buildProposalFingerprint(proposal);
  if (normalizedTransition.proposalFingerprint?.version !==
      POLICY_LIBRARY_REBUILD_ACCEPTANCE_FINGERPRINT_VERSION ||
      normalizedTransition.proposalFingerprint?.algorithm !== 'sha256' ||
      !SHA256_FINGERPRINT_PATTERN.test(normalizeString(normalizedTransition.proposalFingerprint?.fingerprint)) ||
      normalizedTransition.proposalFingerprint?.fingerprint !== expectedProposalFingerprint.fingerprint) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.PROPOSAL_FINGERPRINT_MISMATCH,
      message: 'Library rebuild acceptance proposal fingerprint must match the embedded rebuild proposal.',
    });
  }

  const expectedRollbackPlanFingerprint = buildRollbackPlanFingerprint(rollbackWindowPlan);
  if (normalizedTransition.rollbackPlanFingerprint?.version !==
      POLICY_LIBRARY_REBUILD_ACCEPTANCE_FINGERPRINT_VERSION ||
      normalizedTransition.rollbackPlanFingerprint?.algorithm !== 'sha256' ||
      !SHA256_FINGERPRINT_PATTERN.test(normalizeString(normalizedTransition.rollbackPlanFingerprint?.fingerprint)) ||
      normalizedTransition.rollbackPlanFingerprint?.fingerprint !== expectedRollbackPlanFingerprint.fingerprint) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.ROLLBACK_PLAN_FINGERPRINT_MISMATCH,
      message: 'Library rebuild acceptance rollback-plan fingerprint must match the embedded plan.',
    });
  }

  const acceptanceWindowMinutes = Number(acceptance.windowMinutes);
  const acceptanceIsBounded = Number.isInteger(acceptanceWindowMinutes) &&
    acceptanceWindowMinutes >= ACCEPTANCE_WINDOW_MIN_MINUTES &&
    acceptanceWindowMinutes <= ACCEPTANCE_WINDOW_MAX_MINUTES;
  if (!acceptanceIsBounded) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.UNBOUNDED_ACCEPTANCE_WINDOW,
      message: 'Library rebuild operator acceptance must use a bounded approval window.',
    });
  }

  if (acceptance.accepted === true) {
    if (!ALLOWED_ACCEPTANCE_ACTOR_SOURCE_IDS.has(normalizeString(acceptance.actorSourceId))) {
      issues.push({
        riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.UNAPPROVED_OPERATOR_SOURCE,
        message: 'Library rebuild acceptance must originate from an approved operator source.',
      });
    }

    if (!SHA256_FINGERPRINT_PATTERN.test(normalizeString(acceptance.actorReference))) {
      issues.push({
        riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.MISSING_OPERATOR_REFERENCE,
        message: 'Accepted rebuild transitions must retain a bounded operator reference.',
      });
    }

    const acceptedAt = new Date(acceptance.acceptedAt).getTime();
    const expiresAt = new Date(acceptance.expiresAt).getTime();
    const expectedExpiresAt = Number.isFinite(acceptedAt) && acceptanceIsBounded
      ? addMinutes(new Date(acceptedAt), acceptanceWindowMinutes)
      : null;
    if (!Number.isFinite(acceptedAt) || !Number.isFinite(expiresAt) ||
        expectedExpiresAt !== acceptance.expiresAt) {
      issues.push({
        riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.INVALID_OPERATOR_ACCEPTANCE,
        message: 'Accepted rebuild transition timestamps must be server-derived and internally consistent.',
      });
    } else if (expiresAt <= evaluationTime.getTime()) {
      issues.push({
        riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.ACCEPTANCE_EXPIRED,
        message: 'Accepted rebuild transition has expired and must be recreated before migration verification.',
      });
    }
  } else if (acceptance.actorSourceId || acceptance.actorReference ||
      acceptance.acceptedAt || acceptance.expiresAt) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.INVALID_OPERATOR_ACCEPTANCE,
      message: 'Unaccepted rebuild transitions must not carry operator approval data.',
    });
  }

  const expectedStatusId = determineStatus({
    proposalIssues,
    rollbackIssues,
    acceptance: {
      accepted: acceptance.accepted === true,
      expiresAt: acceptance.expiresAt || null,
    },
    now: evaluationTime,
  });
  if (normalizedTransition.statusId !== expectedStatusId) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.TRANSITION_STATUS_MISMATCH,
      message: 'Library rebuild acceptance status must match current proposal, rollback, and approval state.',
    });
  }

  const expectedTransitionFingerprint = buildTransitionFingerprint({
    statusId: normalizedTransition.statusId,
    policyContext: normalizedPolicyContext,
    proposalFingerprint: expectedProposalFingerprint,
    rollbackPlanFingerprint: expectedRollbackPlanFingerprint,
    acceptance,
  });
  if (normalizedTransition.transitionFingerprint?.version !==
      POLICY_LIBRARY_REBUILD_ACCEPTANCE_FINGERPRINT_VERSION ||
      normalizedTransition.transitionFingerprint?.algorithm !== 'sha256' ||
      normalizedTransition.transitionFingerprint?.fingerprint !== expectedTransitionFingerprint.fingerprint) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.TRANSITION_FINGERPRINT_MISMATCH,
      message: 'Library rebuild acceptance transition fingerprint must match its bound inputs.',
    });
  }

  const expectedIdempotencyKey =
    `policy:library_rebuild_acceptance:${expectedTransitionFingerprint.fingerprint}`;
  if (normalizedTransition.replayProtection?.idempotencyKey !== expectedIdempotencyKey ||
      normalizedTransition.replayProtection?.persistentRecordRequired !== true ||
      normalizedTransition.replayProtection?.replayEnforcedInThisContract !== false) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.INVALID_REPLAY_PROTECTION,
      message: 'Acceptance transition must declare deterministic, persistence-backed replay protection.',
    });
  }

  if (normalizedTransition.application?.canApplyReplacement === true ||
      normalizedTransition.application?.requiresPersistedRollbackSnapshot !== true ||
      normalizedTransition.application?.persistedRollbackSnapshotPresent === true) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.DIRECT_REPLACEMENT_ALLOWED,
      message: 'Acceptance transition can authorize verification only; replacement requires later persisted rollback evidence.',
    });
  }

  const expectedCanEnterMigrationVerification =
    expectedStatusId === POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION;
  if (normalizedTransition.application?.canEnterMigrationVerification !== expectedCanEnterMigrationVerification) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.TRANSITION_STATUS_MISMATCH,
      message: 'Acceptance transition migration-verification permission must match the transition status.',
    });
  }

  if (hasSideEffects(normalizedTransition.sideEffects)) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Library rebuild acceptance transition must not persist acceptance, create snapshots, or replace policy.',
    });
  }

  if (asArray(normalizedTransition.trace?.reasons).length === 0) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Library rebuild acceptance transition must include bounded trace reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyLibraryRebuildAcceptanceTransitionAudit({
  transition = null,
  proposal = null,
  now = new Date(),
} = {}) {
  const hasTransition = Boolean(transition && typeof transition === 'object');
  const validation = hasTransition
    ? validatePolicyLibraryRebuildAcceptanceTransition({ transition, proposal, now })
    : { ok: true, issueCount: 0, issues: [] };

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: hasTransition ? transition.statusId || null : null,
    canEnterMigrationVerification:
      hasTransition && transition.application?.canEnterMigrationVerification === true,
    canApplyReplacement: false,
    persistentReplayProtectionRequired:
      hasTransition && transition.replayProtection?.persistentRecordRequired === true,
    validation,
    nextStep: {
      stepId: 'migration_verifier_rollback',
      label: 'Migration Verifier And Rollback Path',
      reason: 'A current accepted rebuild proposal can now advance to bounded migration comparison; replacement still requires persisted rollback evidence.',
    },
  };
}

export {
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_AUDIT_RISK_IDS,
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_DECISION_IDS,
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_FINGERPRINT_VERSION,
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_REASON_IDS,
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_TRANSITION_VERSION,
  buildPolicyLibraryRebuildAcceptanceTransition,
  buildPolicyLibraryRebuildAcceptanceTransitionAudit,
  validatePolicyLibraryRebuildAcceptanceTransition,
};
