import {
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
} from './policyEvidenceQuality.mjs';
import {
  POLICY_LEARNING_DECISION_IDS,
} from './policyLearningGuard.mjs';
import {
  POLICY_GUARDED_OUTCOME_PROJECTION_VERSION,
  validatePolicyGuardedOutcomeProjection,
} from './policyGuardedOutcomeProjection.mjs';

const POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_VERSION =
  'policy.library_rebuild_readiness_handoff.v1';
const POLICY_LIBRARY_REBUILD_READINESS_SUMMARY_VERSION =
  'policy.library_rebuild_readiness_summary.v1';

const POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_INTENT_BOUNDARY: 'blocked_by_intent_boundary',
  INVALID_GUARDED_OUTCOMES: 'invalid_guarded_outcomes',
  INVALID_HANDOFF: 'invalid_handoff',
});

const POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS = Object.freeze({
  MISSING_BOUNDED_INTENT: 'missing_bounded_intent',
  INTENT_AUDIT_NOT_PASSING: 'intent_audit_not_passing',
  INTENT_FINGERPRINT_AUDIT_NOT_PASSING: 'intent_fingerprint_audit_not_passing',
  MISSING_INTENT_FINGERPRINT: 'missing_intent_fingerprint',
  INTENT_FINGERPRINT_MISMATCH: 'intent_fingerprint_mismatch',
  MISSING_INTENT_QUALITY: 'missing_intent_quality',
  INSUFFICIENT_INTENT_QUALITY: 'insufficient_intent_quality',
  INVALID_GUARDED_OUTCOME_PROJECTION: 'invalid_guarded_outcome_projection',
  UNKNOWN_STATUS: 'unknown_status',
  INVALID_READINESS_SUMMARY: 'invalid_readiness_summary',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const REQUIRED_SIDE_EFFECT_IDS = Object.freeze([
  'learningWritten',
  'routingWritten',
  'policyStorageMutated',
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

function normalizeFingerprint(value = {}) {
  const source = asObject(value);

  return {
    version: normalizeString(source.version) || null,
    algorithm: normalizeString(source.algorithm) || null,
    fingerprint: normalizeString(source.fingerprint).toLowerCase() || null,
  };
}

function normalizeQuality(quality = {}) {
  const source = asObject(quality);

  return {
    version: normalizeString(source.version) || null,
    statusId: normalizeString(source.statusId) || null,
    nextActionId: normalizeString(source.nextActionId) || null,
    reasonIds: asArray(source.reasonIds)
      .map(reasonId => normalizeString(reasonId))
      .filter(Boolean)
      .sort(),
  };
}

function qualitySnapshotsMatch(left = {}, right = {}) {
  const leftQuality = normalizeQuality(left);
  const rightQuality = normalizeQuality(right);

  return Boolean(leftQuality.statusId) &&
    leftQuality.version === rightQuality.version &&
    leftQuality.statusId === rightQuality.statusId &&
    leftQuality.nextActionId === rightQuality.nextActionId &&
    leftQuality.reasonIds.join('|') === rightQuality.reasonIds.join('|');
}

function buildIntentBoundarySnapshot(boundedIntentResult = {}) {
  const source = asObject(boundedIntentResult);
  const wrapperBoundary = asObject(source.evidenceBoundary);
  const intent = asObject(source.intent);
  const intentBoundary = asObject(intent.evidenceBoundary);
  const wrapperFingerprint = normalizeFingerprint(wrapperBoundary.projectionFingerprint);
  const intentFingerprint = normalizeFingerprint(intentBoundary.projectionFingerprint);

  return {
    statusId: normalizeString(source.statusId) || null,
    intentVersion: normalizeString(intent.version) || null,
    intentAuditOk: source.intentAudit?.ok === true,
    evidenceFingerprintAuditOk: source.evidenceFingerprintAudit?.ok === true,
    evidenceBoundary: {
      quality: normalizeQuality(wrapperBoundary.quality),
      projectionFingerprint: wrapperFingerprint,
    },
    intentEvidenceBoundary: {
      quality: normalizeQuality(intentBoundary.quality),
      projectionFingerprint: intentFingerprint,
    },
  };
}

function deriveReadinessDecision(guardedOutcomeProjection = {}) {
  const summary = asObject(guardedOutcomeProjection.summary);
  const decisionId = summary.hasPolicyEditRequirement === true
    ? POLICY_LEARNING_DECISION_IDS.POLICY_EDIT_REQUIRED
    : summary.hasBlockedLearning === true
      ? POLICY_LEARNING_DECISION_IDS.BLOCKED
      : POLICY_LEARNING_DECISION_IDS.OUTCOME_ONLY;

  return {
    version: POLICY_LIBRARY_REBUILD_READINESS_SUMMARY_VERSION,
    learning: {
      decisionId,
      writesPerformed: false,
    },
    profileRefresh: {
      queue: false,
    },
  };
}

function buildIssue(riskId, message) {
  return { riskId, message };
}

function buildPolicyLibraryRebuildReadinessHandoffAudit(handoff = {}) {
  const source = asObject(handoff);
  const issues = [];
  const intentBoundary = asObject(source.intentBoundary);
  const evidenceBoundary = asObject(intentBoundary.evidenceBoundary);
  const intentEvidenceBoundary = asObject(intentBoundary.intentEvidenceBoundary);
  const fingerprint = normalizeFingerprint(evidenceBoundary.projectionFingerprint);
  const intentFingerprint = normalizeFingerprint(intentEvidenceBoundary.projectionFingerprint);
  const quality = normalizeQuality(evidenceBoundary.quality);
  const intentQuality = normalizeQuality(intentEvidenceBoundary.quality);
  const decision = asObject(source.decision);
  const learning = asObject(decision.learning);
  const profileRefresh = asObject(decision.profileRefresh);
  const knownStatus = Object.values(POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS)
    .includes(source.statusId);

  if (source.version !== POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_VERSION) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
      'Library rebuild readiness handoff must use the current contract version.'
    ));
  }

  if (!knownStatus) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.UNKNOWN_STATUS,
      'Library rebuild readiness handoff returned an unknown status.'
    ));
  }

  if (source.ok !== true && source.ok !== false) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
      'Library rebuild readiness handoff must explicitly report whether it is ready.'
    ));
  }

  const issueCount = Number(source.issueCount);
  const handoffIssues = asArray(source.issues);
  if (!Number.isFinite(issueCount) || issueCount < 0 || issueCount !== handoffIssues.length) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
      'Library rebuild readiness handoff must retain a matching bounded issue count.'
    ));
  }

  if (source.ok === true) {
    if (source.statusId !== POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.READY) {
      issues.push(buildIssue(
        POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
        'Ready library rebuild readiness handoff requires the ready status.'
      ));
    }

    if (
      intentBoundary.statusId !== 'ready' ||
      intentBoundary.intentVersion !== 'policy.intent.v1' ||
      intentBoundary.intentAuditOk !== true ||
      intentBoundary.evidenceFingerprintAuditOk !== true ||
      fingerprint.algorithm !== 'sha256' ||
      !SHA256_FINGERPRINT_PATTERN.test(fingerprint.fingerprint || '') ||
      fingerprint.fingerprint !== intentFingerprint.fingerprint ||
      !qualitySnapshotsMatch(quality, intentQuality)
    ) {
      issues.push(buildIssue(
        POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
        'Ready library rebuild readiness handoff requires verified intent provenance.'
      ));
    }

    if (
      decision.version !== POLICY_LIBRARY_REBUILD_READINESS_SUMMARY_VERSION ||
      !Object.values(POLICY_LEARNING_DECISION_IDS).includes(learning.decisionId) ||
      learning.writesPerformed !== false ||
      profileRefresh.queue !== false
    ) {
      issues.push(buildIssue(
        POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
        'Ready library rebuild readiness handoff requires a side-effect-free derived decision.'
      ));
    }
  } else if (
    source.statusId === POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.READY ||
    source.decision !== null ||
    source.nextStep !== null
  ) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
      'A blocked library rebuild readiness handoff cannot claim ready status or retain a derived decision or next step.'
    ));
  }

  const sideEffects = asObject(source.sideEffects);
  REQUIRED_SIDE_EFFECT_IDS.forEach(sideEffectId => {
    if (sideEffects[sideEffectId] !== false) {
      issues.push(buildIssue(
        sideEffects[sideEffectId] === true
          ? POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.UNSAFE_SIDE_EFFECT
          : POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
        sideEffects[sideEffectId] === true
          ? `Library rebuild readiness handoff cannot perform side effect "${sideEffectId}".`
          : `Library rebuild readiness handoff must explicitly disable side effect "${sideEffectId}".`
      ));
    }
  });

  return {
    version: `${POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_VERSION}.audit`,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyLibraryRebuildReadinessHandoff({
  boundedIntentResult,
  guardedOutcomeProjection,
} = {}) {
  const issues = [];
  const intentBoundary = buildIntentBoundarySnapshot(boundedIntentResult);
  const guardedProjection = asObject(guardedOutcomeProjection);

  if (boundedIntentResult?.ok !== true || !boundedIntentResult?.intent) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.MISSING_BOUNDED_INTENT,
      'Library rebuild readiness requires a successful bounded intent result.'
    ));
  }

  if (boundedIntentResult?.ok === true && boundedIntentResult.intentAudit?.ok !== true) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INTENT_AUDIT_NOT_PASSING,
      'Library rebuild readiness requires a passing bounded intent audit.'
    ));
  }

  if (boundedIntentResult?.ok === true && boundedIntentResult.evidenceFingerprintAudit?.ok !== true) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INTENT_FINGERPRINT_AUDIT_NOT_PASSING,
      'Library rebuild readiness requires a passing bounded intent fingerprint audit.'
    ));
  }

  const fingerprint = asObject(intentBoundary.evidenceBoundary).projectionFingerprint;
  const intentFingerprint = asObject(intentBoundary.intentEvidenceBoundary).projectionFingerprint;
  if (
    fingerprint.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(fingerprint.fingerprint || '')
  ) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.MISSING_INTENT_FINGERPRINT,
      'Library rebuild readiness requires the bounded intent evidence fingerprint.'
    ));
  } else if (fingerprint.fingerprint !== intentFingerprint.fingerprint) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INTENT_FINGERPRINT_MISMATCH,
      'Library rebuild readiness requires matching bounded intent fingerprints.'
    ));
  }

  const quality = asObject(intentBoundary.evidenceBoundary).quality;
  const intentQuality = asObject(intentBoundary.intentEvidenceBoundary).quality;
  if (!quality.statusId || !intentQuality.statusId) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.MISSING_INTENT_QUALITY,
      'Library rebuild readiness requires bounded intent quality snapshots.'
    ));
  } else if (
    quality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT ||
    intentQuality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT
  ) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INSUFFICIENT_INTENT_QUALITY,
      'Library rebuild readiness requires usable bounded intent quality.'
    ));
  } else if (!qualitySnapshotsMatch(quality, intentQuality)) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
      'Library rebuild readiness requires matching bounded intent quality snapshots.'
    ));
  }

  if (
    guardedProjection.version !== POLICY_GUARDED_OUTCOME_PROJECTION_VERSION ||
    !validatePolicyGuardedOutcomeProjection(guardedProjection).ok
  ) {
    issues.push(buildIssue(
      POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_GUARDED_OUTCOME_PROJECTION,
      'Library rebuild readiness requires a valid guarded-outcome projection.'
    ));
  }

  const decision = deriveReadinessDecision(guardedProjection);
  const handoff = {
    version: POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_VERSION,
    ok: issues.length === 0,
    statusId: issues.length === 0
      ? POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.READY
      : issues.some(issue => issue.riskId ===
        POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_GUARDED_OUTCOME_PROJECTION)
        ? POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.INVALID_GUARDED_OUTCOMES
        : POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY,
    intentBoundary,
    decision: issues.length === 0 ? decision : null,
    issueCount: issues.length,
    issues,
    sideEffects: {
      learningWritten: false,
      routingWritten: false,
      policyStorageMutated: false,
    },
    nextStep: issues.length === 0
      ? {
          stepId: 'automation_readiness',
          label: 'Automation Readiness',
          reason: 'Verified intent and guarded outcome state are ready for automation readiness evaluation.',
        }
      : null,
  };
  const learningAudit = buildPolicyLibraryRebuildReadinessHandoffAudit(handoff);
  const ok = handoff.ok === true && learningAudit.ok === true;

  return {
    ...handoff,
    ok,
    statusId: ok
      ? POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.READY
      : handoff.statusId === POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.READY
        ? POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.INVALID_HANDOFF
        : handoff.statusId,
    learningAudit,
    issueCount: handoff.issueCount + learningAudit.issueCount,
    issues: [...handoff.issues, ...learningAudit.issues],
    nextStep: ok ? handoff.nextStep : null,
  };
}

export {
  POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS,
  POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_VERSION,
  POLICY_LIBRARY_REBUILD_READINESS_SUMMARY_VERSION,
  buildPolicyLibraryRebuildReadinessHandoff,
  buildPolicyLibraryRebuildReadinessHandoffAudit,
};
