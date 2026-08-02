/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  buildPolicyControlledCompatibilityNamedScopeRemovalDryRun,
  validatePolicyControlledCompatibilityNamedScopeRemovalDryRun,
} from './policyControlledCompatibilityNamedScopeRemovalAdapter.mjs';
import {
  validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifactReplay,
} from './policyControlledCompatibilityNamedScopeRemovalReviewArtifact.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_VERSION,
  asArray,
  asObject,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterNextStep,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterSideEffects,
  buildRisk,
  determinePolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterStatusId,
} from './policyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterShared.mjs';

function buildFreshDryRunRisks(dryRun = {}) {
  const value = asObject(dryRun);
  const validation = validatePolicyControlledCompatibilityNamedScopeRemovalDryRun(value);
  const risks = [];

  if (value.readyForScopeRemovalReview !== true || value.riskCount !== 0) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
        .FRESH_DRY_RUN_NOT_READY,
      'Scope-aware removal replay requires a freshly regenerated, ready dry run.',
      {
        dryRunRiskIds: asArray(value.risks).map(risk => risk?.riskId).filter(Boolean),
        dryRunStatusId: value.statusId || null,
      }
    ));
  }
  if (validation.ok !== true || value.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
        .FRESH_DRY_RUN_VALIDATION_FAILED,
      'Scope-aware removal replay requires the fresh dry-run contract to validate.',
      { issueCount: validation.issueCount }
    ));
  }

  return risks;
}

function summarizeDryRun(dryRun = {}) {
  const value = asObject(dryRun);

  return {
    evaluationTime: value.evaluationTime || null,
    readyForScopeRemovalReview: value.readyForScopeRemovalReview === true,
    riskIds: asArray(value.risks).map(risk => risk?.riskId).filter(Boolean),
    statusId: value.statusId || null,
    validationOk: value.validation?.ok === true,
    executionPlanArtifactFingerprint:
      value.executionGate?.executionPlanArtifactFingerprint || null,
    resultFingerprint: value.dryRun?.resultFingerprint || null,
    scopeIdentity: value.selectedScope?.entryIdentity || null,
    sourceFingerprint: value.source?.fingerprint || null,
  };
}

function buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayDetails({
  now = new Date().toISOString(),
  review = null,
  reviewArtifact = null,
  scopeRemovalDryRun: callerSuppliedDryRun,
  ...dryRunInput
} = {}) {
  const callerSuppliedDryRunPresent = callerSuppliedDryRun !== undefined;
  const freshDryRun = callerSuppliedDryRunPresent
    ? null
    : buildPolicyControlledCompatibilityNamedScopeRemovalDryRun({
      ...dryRunInput,
      now,
    });
  const freshDryRunRisks = freshDryRun ? buildFreshDryRunRisks(freshDryRun) : [];
  const reviewValidation = freshDryRun && freshDryRunRisks.length === 0
    ? validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifactReplay({
      review,
      reviewArtifact,
      scopeRemovalDryRun: freshDryRun,
    })
    : null;
  const risks = [
    ...(callerSuppliedDryRunPresent ? [buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
        .CALLER_SUPPLIED_DRY_RUN,
      'Scope-aware removal replay refuses caller-supplied dry-run snapshots and requires a fresh server-derived replay.'
    )] : []),
    ...freshDryRunRisks,
    ...(reviewValidation?.ok === false ? [buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
        .REVIEW_ARTIFACT_REPLAY_FAILED,
      'Scope-aware removal review artifact does not match the fresh server-derived dry run.',
      {
        issueIds: reviewValidation.issues.map(issue => issue.riskId),
        issueCount: reviewValidation.issueCount,
      }
    )] : []),
  ];
  const readyForFutureRemovalAdmission = risks.length === 0;
  const result = {
    version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_VERSION,
    statusId: readyForFutureRemovalAdmission
      ? POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
        .READY_FOR_FUTURE_REMOVAL_ADMISSION
      : determinePolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterStatusId(risks),
    readyForFutureRemovalAdmission,
    replayedAt: typeof now === 'string' ? now : null,
    reviewArtifact: {
      fingerprint: reviewArtifact?.fingerprint || null,
      version: reviewArtifact?.version || null,
    },
    review: {
      reviewedAt: review?.reviewedAt || null,
      reviewedBy: review?.reviewedBy || null,
    },
    freshDryRun: freshDryRun ? summarizeDryRun(freshDryRun) : null,
    reviewValidation: reviewValidation ? {
      issueCount: reviewValidation.issueCount,
      issueIds: reviewValidation.issues.map(issue => issue.riskId),
      ok: reviewValidation.ok === true,
    } : null,
    riskCount: risks.length,
    risks,
    sideEffects: buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterSideEffects(),
    executionPolicy: {
      requireFreshServerDerivedDryRun: true,
      rejectCallerSuppliedDryRun: true,
      requireCurrentReviewArtifactValidation: true,
      prohibitSourceWrite: true,
      prohibitFileDeletion: true,
      prohibitStorageMutation: true,
      prohibitGitMutationCommands: true,
    },
    nextStep: buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterNextStep({
      readyForFutureRemovalAdmission,
    }),
  };

  const replay = {
    ...result,
    validation: validatePolicyControlledCompatibilityNamedScopeRemovalReviewReplay(result),
  };

  return {
    freshDryRun: replay.readyForFutureRemovalAdmission === true ? freshDryRun : null,
    replay,
  };
}

function buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplay(input = {}) {
  return buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayDetails(input).replay;
}

function validatePolicyControlledCompatibilityNamedScopeRemovalReviewReplay(replay = {}) {
  const issues = [];
  const value = asObject(replay);

  if (!Object.values(POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS)
    .includes(value.statusId)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
        .UNKNOWN_STATUS,
      'Scope-aware removal review replay status must be known.'
    ));
  }
  if (value.riskCount !== asArray(value.risks).length) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
        .RISK_COUNT_MISMATCH,
      'Scope-aware removal review replay risk count must match its risk list.'
    ));
  }
  if (value.readyForFutureRemovalAdmission !== (value.riskCount === 0)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
        .READY_STATE_MISMATCH,
      'Scope-aware removal review replay readiness must match its risk count.'
    ));
  }
  const expectedStatusId = value.riskCount === 0
    ? POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
      .READY_FOR_FUTURE_REMOVAL_ADMISSION
    : determinePolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterStatusId(value.risks);
  if (value.statusId !== expectedStatusId) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
        .STATUS_MISMATCH,
      'Scope-aware removal review replay status must match its readiness and risks.'
    ));
  }

  const policy = asObject(value.executionPolicy);
  if (policy.requireFreshServerDerivedDryRun !== true ||
      policy.rejectCallerSuppliedDryRun !== true ||
      policy.requireCurrentReviewArtifactValidation !== true ||
      policy.prohibitSourceWrite !== true ||
      policy.prohibitFileDeletion !== true ||
      policy.prohibitStorageMutation !== true ||
      policy.prohibitGitMutationCommands !== true) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
      'Scope-aware removal review replay must retain its read-only execution policy.'
    ));
  }
  const expectedSideEffects =
    buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterSideEffects();
  if (Object.keys(expectedSideEffects).some(
    sideEffectId => value.sideEffects?.[sideEffectId] !== false
  )) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
      'Scope-aware removal review replay must report every mutation-capable side effect as false.'
    ));
  }
  Object.entries(asObject(value.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true) {
      issues.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
        `Scope-aware removal review replay cannot report side effect "${sideEffectId}".`
      ));
    }
  });

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

function createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter(options = {}) {
  return {
    replay(input = {}) {
      return buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplay({
        ...options,
        ...input,
      });
    },
    replayForControlledApply(input = {}) {
      return buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayDetails({
        ...options,
        ...input,
      });
    },
  };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_VERSION,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplay,
  createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter,
  validatePolicyControlledCompatibilityNamedScopeRemovalReviewReplay,
};
