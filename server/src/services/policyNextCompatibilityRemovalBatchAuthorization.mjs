/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
  buildPolicyPostRemovalRuntimeVerification,
} from './policyPostRemovalRuntimeVerification.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS,
  validatePolicyPostRemovalRuntimeEvidenceArtifact,
} from './policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS,
  resolvePolicyNextCompatibilityRemovalBatchAuthorizationPathStateSource,
} from './policyNextCompatibilityRemovalBatchAuthorizationPathStateSource.mjs';

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_VERSION =
  'policy.next_compatibility_removal_batch_authorization.v3';

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS =
  Object.freeze({
    READY_FOR_NEXT_BATCH: 'ready_for_next_batch',
    COMPLETE_NO_REMAINING_PATHS: 'complete_no_remaining_paths',
    BLOCKED_BY_RUNTIME_EVIDENCE_INTEGRITY: 'blocked_by_runtime_evidence_integrity',
    BLOCKED_BY_POST_REMOVAL_VERIFICATION: 'blocked_by_post_removal_verification',
    BLOCKED_BY_EXECUTION_PLAN: 'blocked_by_execution_plan',
    BLOCKED_BY_PATH_STATE_EVIDENCE: 'blocked_by_path_state_evidence',
    BLOCKED_BY_SELECTION: 'blocked_by_selection',
    BLOCKED_BY_SCOPE: 'blocked_by_scope',
    BLOCKED_BY_AUTHORIZATION: 'blocked_by_authorization',
  });

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS =
  Object.freeze({
    RUNTIME_EVIDENCE_ARTIFACT_MISSING: 'runtime_evidence_artifact_missing',
    RUNTIME_EVIDENCE_ARTIFACT_INVALID: 'runtime_evidence_artifact_invalid',
    REVIEW_ARTIFACT_FINGERPRINT_MISSING: 'review_artifact_fingerprint_missing',
    REVIEW_ARTIFACT_FINGERPRINT_MISMATCH: 'review_artifact_fingerprint_mismatch',
    APPLIED_PATH_OUTSIDE_EXECUTION_MANIFEST: 'applied_path_outside_execution_manifest',
    POST_REMOVAL_NOT_VERIFIED: 'post_removal_not_verified',
    POST_REMOVAL_VALIDATION_FAILED: 'post_removal_validation_failed',
    EXECUTION_PLAN_ARTIFACT_INVALID: 'execution_plan_artifact_invalid',
    PATH_STATE_EVIDENCE_INVALID: 'path_state_evidence_invalid',
    PATH_STATE_EVIDENCE_ARTIFACT_MISMATCH: 'path_state_evidence_artifact_mismatch',
    PATH_STATE_EVIDENCE_MANIFEST_MISMATCH: 'path_state_evidence_manifest_mismatch',
    RUNTIME_APPLIED_PATH_STATE_MISMATCH: 'runtime_applied_path_state_mismatch',
    EXECUTION_PLAN_NOT_READY: 'execution_plan_not_ready',
    EXECUTION_PLAN_VALIDATION_FAILED: 'execution_plan_validation_failed',
    NO_MANIFEST_ENTRIES: 'no_manifest_entries',
    NO_PATHS_REQUESTED: 'no_paths_requested',
    REQUESTED_PATH_NOT_IN_MANIFEST: 'requested_path_not_in_manifest',
    REQUESTED_PATH_ALREADY_REMOVED: 'requested_path_already_removed',
    BATCH_SCOPE_TOO_BROAD: 'batch_scope_too_broad',
    MISSING_AUTHORIZATION_REASON: 'missing_authorization_reason',
    MISSING_AUTHORIZER: 'missing_authorizer',
    SIDE_EFFECT_PERFORMED: 'side_effect_performed',
    RISK_COUNT_MISMATCH: 'risk_count_mismatch',
    UNKNOWN_STATUS: 'unknown_status',
  });

const DEFAULT_MAX_BATCH_SIZE = 3;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function normalizeText(value = '') {
  return String(value || '').trim();
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function uniqueNormalizedPaths(paths = []) {
  return [...new Set(asArray(paths).map(normalizePath).filter(Boolean))];
}

function getManifestEntries(executionPlan = {}) {
  return asArray(executionPlan.manifest?.entries)
    .map(entry => ({
      ...entry,
      path: normalizePath(entry?.path),
    }))
    .filter(entry => entry.path);
}

function evaluateRuntimeEvidenceArtifact(runtimeEvidenceArtifact = null) {
  const validation = validatePolicyPostRemovalRuntimeEvidenceArtifact(
    runtimeEvidenceArtifact
  );
  const risks = [];

  if (!validation.ok) {
    const missingArtifact = validation.issues.some(issue =>
      issue.riskId ===
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .MISSING_RUNTIME_EVIDENCE_ARTIFACT
    );
    risks.push(buildRisk(
      missingArtifact
        ? POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .RUNTIME_EVIDENCE_ARTIFACT_MISSING
        : POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .RUNTIME_EVIDENCE_ARTIFACT_INVALID,
      missingArtifact
        ? 'Next compatibility removal batch authorization requires a runtime evidence artifact.'
        : 'Next compatibility removal batch authorization requires an intact runtime evidence artifact.',
      {
        issueCount: validation.issueCount,
        issueRiskIds: validation.issues.map(issue => issue.riskId),
      }
    ));
  }

  return {
    validation,
    risks,
  };
}

async function evaluatePostRemovalVerification({
  runtimeEvidenceArtifact = null,
  runtimeEvidenceValidation = {},
} = {}) {
  const verification = await buildPolicyPostRemovalRuntimeVerification({
    runtimeEvidenceArtifact,
  });
  const risks = [];

  if (runtimeEvidenceValidation.ok) {
    if (
      verification.statusId !==
        POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED ||
      verification.verified !== true
    ) {
      risks.push(buildRisk(
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .POST_REMOVAL_NOT_VERIFIED,
        'Next compatibility removal batch authorization requires verified post-removal runtime evidence.',
        { statusId: verification.statusId || null }
      ));
    }

    if (verification.validation?.ok !== true) {
      risks.push(buildRisk(
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .POST_REMOVAL_VALIDATION_FAILED,
        'Next compatibility removal batch authorization requires valid post-removal runtime evidence.',
        { issueCount: verification.validation?.issueCount ?? null }
      ));
    }
  }

  return {
    verification,
    removedPaths: runtimeEvidenceValidation.ok
      ? uniqueNormalizedPaths(verification.applyEvidence?.appliedPaths)
      : [],
    reviewArtifactFingerprint:
      runtimeEvidenceValidation.reviewArtifactFingerprint || null,
    risks,
  };
}

function evaluateAuthorizationReviewContext({
  expectedReviewArtifactFingerprint = null,
  authorizationReviewArtifactFingerprint = '',
} = {}) {
  const risks = [];
  const reviewArtifactFingerprint = normalizeText(authorizationReviewArtifactFingerprint);

  if (!reviewArtifactFingerprint) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .REVIEW_ARTIFACT_FINGERPRINT_MISSING,
      'Next compatibility removal batch authorization requires the applied removal review artifact fingerprint in its authorization context.'
    ));
  } else if (reviewArtifactFingerprint !== expectedReviewArtifactFingerprint) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .REVIEW_ARTIFACT_FINGERPRINT_MISMATCH,
      'Next compatibility removal batch authorization context must be bound to the applied removal review artifact.',
      {
        expectedReviewArtifactFingerprint,
        actualReviewArtifactFingerprint: reviewArtifactFingerprint,
      }
    ));
  }

  return {
    reviewArtifactFingerprint: reviewArtifactFingerprint || null,
    risks,
  };
}

function evaluateExecutionPlan(executionPlan = {}) {
  const risks = [];
  const entries = getManifestEntries(executionPlan);

  if (
    executionPlan.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
    executionPlan.readyForExecutionGate !== true
  ) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .EXECUTION_PLAN_NOT_READY,
      'Next compatibility removal batch authorization requires a ready compatibility deletion execution plan.',
      { statusId: executionPlan.statusId || null }
    ));
  }

  if (executionPlan.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .EXECUTION_PLAN_VALIDATION_FAILED,
      'Next compatibility removal batch authorization requires a valid compatibility deletion execution plan.',
      { issueCount: executionPlan.validation?.issueCount ?? null }
    ));
  }

  if (entries.length === 0) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_MANIFEST_ENTRIES,
      'Next compatibility removal batch authorization requires approved manifest entries.'
    ));
  }

  return {
    entries,
    risks,
  };
}

function evaluatePathStateSource(pathStateSource = {}) {
  const riskIdMap = {
    [POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_INVALID]:
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_INVALID,
    [POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS
      .PATH_STATE_EVIDENCE_INVALID]:
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .PATH_STATE_EVIDENCE_INVALID,
    [POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS
      .PATH_STATE_EVIDENCE_ARTIFACT_MISMATCH]:
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .PATH_STATE_EVIDENCE_ARTIFACT_MISMATCH,
    [POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS
      .PATH_STATE_EVIDENCE_MANIFEST_MISMATCH]:
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .PATH_STATE_EVIDENCE_MANIFEST_MISMATCH,
  };

  return {
    risks: asArray(pathStateSource.issues).map(issue => buildRisk(
      riskIdMap[issue.riskId] ||
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .PATH_STATE_EVIDENCE_INVALID,
      issue.message || 'Next compatibility removal batch authorization requires a verified path-state source.',
      {
        pathStateSourceRiskId: issue.riskId || null,
        ...Object.fromEntries(
          Object.entries(issue).filter(([key]) => !['riskId', 'message'].includes(key))
        ),
      }
    )),
  };
}

function evaluateAppliedPathsAgainstExecutionManifest({
  manifestEntries = [],
  removedPaths = [],
} = {}) {
  if (manifestEntries.length === 0) {
    return [];
  }

  const manifestPathSet = new Set(manifestEntries.map(entry => entry.path));

  return uniqueNormalizedPaths(removedPaths)
    .filter(path => !manifestPathSet.has(path))
    .map(path => buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .APPLIED_PATH_OUTSIDE_EXECUTION_MANIFEST,
      'Applied removal runtime evidence contains a path outside the next-batch execution manifest.',
      { path }
    ));
}

function evaluateRuntimeAppliedPathsAgainstPathState({
  runtimeAppliedPaths = [],
  pathStateRemovedPaths = [],
} = {}) {
  const expected = uniqueNormalizedPaths(pathStateRemovedPaths).sort();
  const actual = uniqueNormalizedPaths(runtimeAppliedPaths).sort();

  if (
    expected.length === actual.length &&
    expected.every((path, index) => path === actual[index])
  ) {
    return [];
  }

  return [buildRisk(
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .RUNTIME_APPLIED_PATH_STATE_MISMATCH,
    'Next compatibility removal batch authorization requires runtime applied paths to match the replay-verified checkout path-state snapshot exactly.',
    {
      expectedRemovedPaths: expected,
      actualAppliedPaths: actual,
    }
  )];
}

function buildRemainingManifest({ manifestEntries = [], removedPaths = [] } = {}) {
  const removedPathSet = new Set(removedPaths);
  const remainingEntries = manifestEntries.filter(entry => !removedPathSet.has(entry.path));

  return {
    totalCount: manifestEntries.length,
    removedCount: manifestEntries.length - remainingEntries.length,
    remainingCount: remainingEntries.length,
    removedPaths,
    remainingPaths: remainingEntries.map(entry => entry.path),
    entries: remainingEntries,
  };
}

function evaluateRequestedBatch({
  requestedPaths = [],
  manifestEntries = [],
  remainingManifest = {},
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
} = {}) {
  const risks = [];
  const normalizedRequestedPaths = uniqueNormalizedPaths(requestedPaths);
  const manifestPathSet = new Set(manifestEntries.map(entry => entry.path));
  const remainingPathSet = new Set(asArray(remainingManifest.remainingPaths));
  const removedPathSet = new Set(asArray(remainingManifest.removedPaths));

  if (remainingManifest.remainingCount === 0) {
    return {
      requestedPaths: normalizedRequestedPaths,
      entries: [],
      risks,
    };
  }

  if (normalizedRequestedPaths.length === 0) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_PATHS_REQUESTED,
      'Next compatibility removal batch authorization requires at least one requested remaining path.'
    ));
  }

  if (normalizedRequestedPaths.length > maxBatchSize) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.BATCH_SCOPE_TOO_BROAD,
      'Next compatibility removal batch is wider than the configured maximum batch size.',
      {
        requestedCount: normalizedRequestedPaths.length,
        maxBatchSize,
      }
    ));
  }

  normalizedRequestedPaths.forEach(path => {
    if (!manifestPathSet.has(path)) {
      risks.push(buildRisk(
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .REQUESTED_PATH_NOT_IN_MANIFEST,
        'Requested compatibility removal path is not in the approved manifest.',
        { path }
      ));
    } else if (removedPathSet.has(path) || !remainingPathSet.has(path)) {
      risks.push(buildRisk(
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .REQUESTED_PATH_ALREADY_REMOVED,
        'Requested compatibility removal path was already removed and cannot re-enter a batch.',
        { path }
      ));
    }
  });

  const requestedPathSet = new Set(normalizedRequestedPaths);
  const entries = asArray(remainingManifest.entries)
    .filter(entry => requestedPathSet.has(entry.path));

  return {
    requestedPaths: normalizedRequestedPaths,
    entries,
    risks,
  };
}

function evaluateAuthorization({
  remainingCount = 0,
  authorizationReason = '',
  authorizedBy = '',
} = {}) {
  if (remainingCount === 0) {
    return [];
  }

  const risks = [];

  if (!normalizeText(authorizationReason)) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
        .MISSING_AUTHORIZATION_REASON,
      'Next compatibility removal batch authorization requires an authorization reason.'
    ));
  }

  if (!normalizeText(authorizedBy)) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.MISSING_AUTHORIZER,
      'Next compatibility removal batch authorization requires the authorizing operator.'
    ));
  }

  return risks;
}

function determineStatusId({ risks = [], remainingCount = 0 } = {}) {
  if (risks.some(risk => [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .RUNTIME_EVIDENCE_ARTIFACT_MISSING,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .RUNTIME_EVIDENCE_ARTIFACT_INVALID,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .REVIEW_ARTIFACT_FINGERPRINT_MISSING,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .REVIEW_ARTIFACT_FINGERPRINT_MISMATCH,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .APPLIED_PATH_OUTSIDE_EXECUTION_MANIFEST,
  ].includes(risk.riskId))) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_RUNTIME_EVIDENCE_INTEGRITY;
  }

  if (risks.some(risk => [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .POST_REMOVAL_NOT_VERIFIED,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .POST_REMOVAL_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_POST_REMOVAL_VERIFICATION;
  }

  if (risks.some(risk => [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_INVALID,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .EXECUTION_PLAN_NOT_READY,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .EXECUTION_PLAN_VALIDATION_FAILED,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_MANIFEST_ENTRIES,
  ].includes(risk.riskId))) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_EXECUTION_PLAN;
  }

  if (risks.some(risk => [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .PATH_STATE_EVIDENCE_INVALID,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .PATH_STATE_EVIDENCE_ARTIFACT_MISMATCH,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .PATH_STATE_EVIDENCE_MANIFEST_MISMATCH,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .RUNTIME_APPLIED_PATH_STATE_MISMATCH,
  ].includes(risk.riskId))) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_PATH_STATE_EVIDENCE;
  }

  if (remainingCount === 0) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .COMPLETE_NO_REMAINING_PATHS;
  }

  if (risks.some(risk => risk.riskId ===
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.BATCH_SCOPE_TOO_BROAD)) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_SCOPE;
  }

  if (risks.some(risk => [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.NO_PATHS_REQUESTED,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .REQUESTED_PATH_NOT_IN_MANIFEST,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .REQUESTED_PATH_ALREADY_REMOVED,
  ].includes(risk.riskId))) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_SELECTION;
  }

  if (risks.some(risk => [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
      .MISSING_AUTHORIZATION_REASON,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.MISSING_AUTHORIZER,
  ].includes(risk.riskId))) {
    return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .BLOCKED_BY_AUTHORIZATION;
  }

  return POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS.READY_FOR_NEXT_BATCH;
}

async function buildPolicyNextCompatibilityRemovalBatchAuthorization({
  runtimeEvidenceArtifact = null,
  executionPlanArtifact = null,
  pathStateEvidence = null,
  requestedPaths = [],
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
  authorizationReason = '',
  authorizedBy = '',
  reviewArtifactFingerprint = '',
} = {}) {
  const pathStateSource =
    resolvePolicyNextCompatibilityRemovalBatchAuthorizationPathStateSource({
      executionPlanArtifact,
      pathStateEvidence,
    });
  const pathStateSourceEvaluation = evaluatePathStateSource(pathStateSource);
  const resolvedExecutionPlan = pathStateSource.executionPlan || {};
  const runtimeEvidenceEvaluation = evaluateRuntimeEvidenceArtifact(
    runtimeEvidenceArtifact
  );
  const postRemovalEvaluation = await evaluatePostRemovalVerification({
    runtimeEvidenceArtifact,
    runtimeEvidenceValidation: runtimeEvidenceEvaluation.validation,
  });
  const reviewContextEvaluation = evaluateAuthorizationReviewContext({
    expectedReviewArtifactFingerprint:
      postRemovalEvaluation.reviewArtifactFingerprint,
    authorizationReviewArtifactFingerprint: reviewArtifactFingerprint,
  });
  const executionPlanEvaluation = evaluateExecutionPlan(resolvedExecutionPlan);
  const appliedPathRisks = evaluateAppliedPathsAgainstExecutionManifest({
    manifestEntries: executionPlanEvaluation.entries,
    removedPaths: postRemovalEvaluation.removedPaths,
  });
  const appliedPathStateRisks = evaluateRuntimeAppliedPathsAgainstPathState({
    runtimeAppliedPaths: postRemovalEvaluation.removedPaths,
    pathStateRemovedPaths: pathStateSource.pathState.removedPaths,
  });
  const remainingManifest = buildRemainingManifest({
    manifestEntries: executionPlanEvaluation.entries,
    removedPaths: pathStateSource.pathState.removedPaths,
  });
  const batchEvaluation = evaluateRequestedBatch({
    requestedPaths,
    manifestEntries: executionPlanEvaluation.entries,
    remainingManifest,
    maxBatchSize,
  });
  const risks = [
    ...runtimeEvidenceEvaluation.risks,
    ...postRemovalEvaluation.risks,
    ...reviewContextEvaluation.risks,
    ...pathStateSourceEvaluation.risks,
    ...executionPlanEvaluation.risks,
    ...appliedPathRisks,
    ...appliedPathStateRisks,
    ...batchEvaluation.risks,
    ...evaluateAuthorization({
      remainingCount: remainingManifest.remainingCount,
      authorizationReason,
      authorizedBy,
    }),
  ];
  const statusId = determineStatusId({
    risks,
    remainingCount: remainingManifest.remainingCount,
  });
  const authorization = {
    version: POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_VERSION,
    statusId,
    readyForNextBatch:
      statusId ===
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS.READY_FOR_NEXT_BATCH,
    completedNoRemainingPaths:
      statusId ===
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS,
    runtimeEvidenceArtifact: {
      valid: runtimeEvidenceEvaluation.validation.ok,
      fingerprint: runtimeEvidenceArtifact?.fingerprint || null,
      reviewArtifactFingerprint:
        postRemovalEvaluation.reviewArtifactFingerprint,
    },
    postRemovalVerification: {
      statusId: postRemovalEvaluation.verification.statusId || null,
      verified: postRemovalEvaluation.verification.verified === true,
      validationOk: postRemovalEvaluation.verification.validation?.ok === true,
      appliedPathCount: postRemovalEvaluation.removedPaths.length,
      reviewArtifactFingerprint:
        postRemovalEvaluation.reviewArtifactFingerprint,
    },
    pathStateEvidence: {
      valid: pathStateSource.ok,
      fingerprint: pathStateSource.pathStateEvidenceFingerprint,
      executionPlanArtifactFingerprint:
        pathStateSource.executionPlanArtifactFingerprint,
      totalCount: pathStateSource.pathState.totalCount,
      existingCount: pathStateSource.pathState.existingCount,
      removedCount: pathStateSource.pathState.removedCount,
    },
    authorizationContext: {
      reviewArtifactFingerprint:
        reviewContextEvaluation.reviewArtifactFingerprint,
    },
    executionPlan: {
      statusId: resolvedExecutionPlan.statusId || null,
      readyForExecutionGate: resolvedExecutionPlan.readyForExecutionGate === true,
      validationOk: resolvedExecutionPlan.validation?.ok === true,
      manifestEntryCount: executionPlanEvaluation.entries.length,
      artifactFingerprint: pathStateSource.executionPlanArtifactFingerprint,
    },
    remainingManifest,
    authorizedBatch: {
      requestedCount: batchEvaluation.requestedPaths.length,
      authorizedCount:
        statusId ===
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS.READY_FOR_NEXT_BATCH
          ? batchEvaluation.entries.length
          : 0,
      maxBatchSize,
      authorizedBy: normalizeText(authorizedBy) || null,
      authorizationReason: normalizeText(authorizationReason) || null,
      entries:
        statusId ===
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS.READY_FOR_NEXT_BATCH
          ? batchEvaluation.entries
          : [],
    },
    riskCount: risks.length,
    risks,
    executionPolicy: {
      executeDeletionNow: false,
      requireControlledRemovalBatchBuilder: true,
      requireRuntimeEvidenceArtifactIntegrity: true,
      requireVerifiedPostRemoval: true,
      requireAppliedReviewArtifactContext: true,
      requireAppliedPathsInExecutionManifest: true,
      requireReplayVerifiedPathStateEvidence: true,
      requireExactPathStateArtifactBinding: true,
      requireRuntimeAppliedPathsMatchPathState: true,
      requirePathStateDerivedRemainingManifest: true,
      requireRemainingManifestPath: true,
      requireSmallBatch: true,
      preventAlreadyRemovedPathReuse: true,
    },
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
    },
    nextStep: {
      stepId: 'compatibility_removal_completion_audit',
      label: 'Compatibility Removal Completion Audit',
      reason:
        'After the next batch is authorized, the removal loop should either run the next controlled removal batch or audit that no approved compatibility paths remain.',
    },
  };

  return {
    ...authorization,
    validation:
      validatePolicyNextCompatibilityRemovalBatchAuthorization(authorization),
  };
}

function validatePolicyNextCompatibilityRemovalBatchAuthorization(
  authorization = {}
) {
  const issues = [];

  if (!Object.values(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS)
    .includes(authorization.statusId)) {
    issues.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.UNKNOWN_STATUS,
      'Next compatibility removal batch authorization status must be known.'
    ));
  }

  if (authorization.riskCount !== asArray(authorization.risks).length) {
    issues.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS.RISK_COUNT_MISMATCH,
      'Next compatibility removal batch authorization risk count must match risk list length.'
    ));
  }

  Object.entries(authorization.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
        `Next compatibility removal batch authorization cannot perform side effect "${key}".`
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_RISK_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_VERSION,
  buildPolicyNextCompatibilityRemovalBatchAuthorization,
  validatePolicyNextCompatibilityRemovalBatchAuthorization,
};
