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
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_VERSION,
  asObject,
  buildPolicyControlledCompatibilityNamedScopeRemovalApplySideEffects,
  buildRisk,
  cleanString,
  normalizeActor,
  normalizeAuthorizationId,
  normalizeTimestamp,
} from './policyControlledCompatibilityNamedScopeRemovalApplyShared.mjs';

function summarizeAuthorization(authorization = {}) {
  const value = asObject(authorization);

  return {
    authorizationId: normalizeAuthorizationId(value.authorizationId),
    expiresAt: normalizeTimestamp(value.expiresAt),
    scopeIdentity: cleanString(value.reviewContext?.selectedEntryIdentity) || null,
  };
}

function buildResult({
  authorization = null,
  now,
  risks = [],
  sideEffects = buildPolicyControlledCompatibilityNamedScopeRemovalApplySideEffects(),
  statusId,
} = {}) {
  const result = {
    authorization: authorization ? summarizeAuthorization(authorization) : null,
    completedAt: normalizeTimestamp(now),
    executionPolicy: {
      allowBoundedSourceWriteAfterFinalReplay: true,
      prohibitApiSuppliedDryRun: true,
      prohibitApiSuppliedReviewArtifact: true,
      prohibitFileDeletion: true,
      prohibitGitMutationCommands: true,
      prohibitPathWidening: true,
      prohibitStorageMutation: true,
      prohibitWholeFileDeletion: true,
      requireAuthenticatedAdminActor: true,
      requireDurableRollbackEvidenceBeforeSourceWrite: true,
      requireFinalSourceFingerprintCheck: true,
      requireSingleUseExpiringAuthorization: true,
    },
    riskCount: risks.length,
    risks,
    sideEffects,
    statusId,
    version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_VERSION,
  };

  return {
    ...result,
    validation: validatePolicyControlledCompatibilityNamedScopeRemovalApply(result),
  };
}

function buildDependencyFailure(now, missingDependencyIds) {
  return buildResult({
    now,
    risks: [buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.DEPENDENCY_MISSING,
      'Controlled scope removal apply requires all server-owned dependencies.',
      { missingDependencyIds }
    )],
    statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_DEPENDENCY,
  });
}

async function applyPolicyControlledCompatibilityNamedScopeRemoval({
  actor,
  authorizationId,
  authorizationStore,
  now = new Date().toISOString(),
  replayAdapter,
  repoRoot,
  scopeLock,
  sourceWriter,
} = {}) {
  const missingDependencyIds = [
    typeof authorizationStore?.getAuthorization === 'function' &&
      typeof authorizationStore?.consumeAuthorization === 'function' &&
      typeof authorizationStore?.writeRollbackEvidence === 'function' &&
      typeof authorizationStore?.recordOutcome === 'function'
      ? null : 'authorization_store',
    typeof replayAdapter?.replayForControlledApply === 'function' ? null : 'replay_adapter',
    typeof scopeLock?.withScopeLock === 'function' ? null : 'scope_lock',
    typeof sourceWriter?.prepare === 'function' && typeof sourceWriter?.apply === 'function' &&
      typeof sourceWriter?.restore === 'function'
      ? null : 'source_writer',
    typeof repoRoot === 'string' && repoRoot ? null : 'repo_root',
  ].filter(Boolean);
  if (missingDependencyIds.length > 0) return buildDependencyFailure(now, missingDependencyIds);

  const normalizedAuthorizationId = normalizeAuthorizationId(authorizationId);
  const normalizedActor = normalizeActor(actor);
  if (!normalizedAuthorizationId) {
    return buildResult({
      now,
      risks: [buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.AUTHORIZATION_INVALID,
        'Controlled scope removal apply requires a valid authorization ID.'
      )],
      statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION,
    });
  }

  let authorizationLookup;
  try {
    authorizationLookup = await authorizationStore.getAuthorization({
      authorizationId: normalizedAuthorizationId,
    });
  } catch (_error) {
    authorizationLookup = { statusId: 'authorization_not_found' };
  }
  if (authorizationLookup?.statusId !== 'available' || !authorizationLookup.authorization) {
    const riskId = {
      authorization_already_consumed:
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS
          .AUTHORIZATION_ALREADY_CONSUMED,
      authorization_not_found:
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.AUTHORIZATION_MISSING,
    }[authorizationLookup?.statusId] ||
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.AUTHORIZATION_INVALID;
    return buildResult({
      now,
      risks: [buildRisk(
        riskId,
        'Controlled scope removal apply requires an available server-owned authorization.'
      )],
      statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION,
    });
  }

  const scopeIdentity = cleanString(authorizationLookup.authorization.reviewContext?.selectedEntryIdentity);
  if (!scopeIdentity.startsWith('named_test_scope:')) {
    return buildResult({
      authorization: authorizationLookup.authorization,
      now,
      risks: [buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.AUTHORIZATION_INVALID,
        'Controlled scope removal authorization must bind one named scope identity.'
      )],
      statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION,
    });
  }

  let lockResult;
  try {
    lockResult = await scopeLock.withScopeLock({ scopeIdentity }, async () => {
      let consumption;
      try {
        consumption = await authorizationStore.consumeAuthorization({
          actor: normalizedActor,
          authorizationId: normalizedAuthorizationId,
          consumedAt: now,
        });
      } catch (_error) {
        consumption = { statusId: 'invalid_authorization' };
      }

      if (consumption?.statusId !== 'consumed' || !consumption.authorization) {
        const riskId = {
          authorization_actor_mismatch:
            POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS
              .AUTHORIZATION_ACTOR_MISMATCH,
          authorization_already_consumed:
            POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS
              .AUTHORIZATION_ALREADY_CONSUMED,
          authorization_expired:
            POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.AUTHORIZATION_EXPIRED,
        }[consumption?.statusId] ||
          POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.AUTHORIZATION_INVALID;
        return buildResult({
          authorization: authorizationLookup.authorization,
          now,
          risks: [buildRisk(riskId, 'Controlled scope removal authorization cannot be consumed.')],
          statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
            .BLOCKED_BY_AUTHORIZATION,
        });
      }

      const authorization = consumption.authorization;
      const sideEffects = buildPolicyControlledCompatibilityNamedScopeRemovalApplySideEffects();
      sideEffects.authorizationConsumed = true;
      let replayDetails;
      try {
        replayDetails = replayAdapter.replayForControlledApply(authorization.reviewContext);
      } catch (_error) {
        replayDetails = null;
      }
      if (replayDetails?.replay?.readyForFutureRemovalAdmission !== true ||
          replayDetails?.replay?.validation?.ok !== true || !replayDetails.freshDryRun) {
        return buildResult({
          authorization,
          now,
          risks: [buildRisk(
            POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.FINAL_REPLAY_BLOCKED,
            'Controlled scope removal apply requires a ready final server-derived replay.',
            { replayStatusId: replayDetails?.replay?.statusId || null }
          )],
          sideEffects,
          statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
            .BLOCKED_BY_REPLAY,
        });
      }

      let prepared;
      try {
        prepared = await sourceWriter.prepare({
          repoRoot,
          scopeRemovalDryRun: replayDetails.freshDryRun,
        });
      } catch (_error) {
        return buildResult({
          authorization,
          now,
          risks: [buildRisk(
            POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.SOURCE_PREPARE_FAILED,
            'Controlled scope removal source cannot be prepared from the final replay.'
          )],
          sideEffects,
          statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
            .BLOCKED_BY_SOURCE,
        });
      }

      let rollbackEvidence;
      try {
        rollbackEvidence = await authorizationStore.writeRollbackEvidence({
          authorization,
          originalSourceText: prepared.originalSourceText,
          resultFingerprint: prepared.resultFingerprint,
          sourceFingerprint: prepared.sourceFingerprint,
          sourcePath: prepared.relativeSourcePath,
          writtenAt: now,
        });
        sideEffects.rollbackEvidenceWritten = true;
      } catch (_error) {
        return buildResult({
          authorization,
          now,
          risks: [buildRisk(
            POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS
              .ROLLBACK_EVIDENCE_WRITE_FAILED,
            'Controlled scope removal stops when durable rollback evidence cannot be written.'
          )],
          sideEffects,
          statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
            .BLOCKED_BY_ROLLBACK_EVIDENCE,
        });
      }

      try {
        await sourceWriter.apply(prepared);
        sideEffects.sourceWritten = true;
      } catch (_error) {
        return buildResult({
          authorization,
          now,
          risks: [buildRisk(
            POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.SOURCE_APPLY_FAILED,
            'Controlled scope removal source write failed after rollback evidence was prepared.',
            { rollbackEvidenceId: rollbackEvidence.evidenceId }
          )],
          sideEffects,
          statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
            .BLOCKED_BY_SOURCE,
        });
      }

      try {
        await authorizationStore.recordOutcome({
          authorization,
          outcomeId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS.APPLIED,
          resultFingerprint: prepared.resultFingerprint,
          writtenAt: now,
        });
        sideEffects.applyAuditWritten = true;
      } catch (_error) {
        try {
          await sourceWriter.restore(prepared);
          sideEffects.sourceRestored = true;
        } catch (_restoreError) {
          return buildResult({
            authorization,
            now,
            risks: [buildRisk(
              POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.ROLLBACK_FAILED,
              'Controlled scope removal source write completed but audit persistence and rollback both failed.',
              { rollbackEvidenceId: rollbackEvidence.evidenceId }
            )],
            sideEffects,
            statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
              .BLOCKED_BY_SOURCE,
          });
        }
        return buildResult({
          authorization,
          now,
          risks: [buildRisk(
            POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.APPLY_AUDIT_WRITE_FAILED,
            'Controlled scope removal restored source because durable apply audit evidence could not be written.',
            { rollbackEvidenceId: rollbackEvidence.evidenceId }
          )],
          sideEffects,
          statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
            .ROLLED_BACK_AFTER_AUDIT_FAILURE,
        });
      }

      return buildResult({
        authorization,
        now,
        sideEffects,
        statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      });
    });
  } catch (_error) {
    lockResult = { acquired: false };
  }

  if (lockResult?.acquired !== true) {
    return buildResult({
      authorization: authorizationLookup.authorization,
      now,
      risks: [buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.LOCK_NOT_ACQUIRED,
        'Controlled scope removal requires an exclusive scope lock before consuming authorization.'
      )],
      statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS.BLOCKED_BY_LOCK,
    });
  }

  return lockResult.value || buildDependencyFailure(now, ['scope_lock_result']);
}

function validatePolicyControlledCompatibilityNamedScopeRemovalApply(result = {}) {
  const value = asObject(result);
  const issues = [];

  if (!Object.values(POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS)
    .includes(value.statusId)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.UNKNOWN_STATUS,
      'Controlled scope removal apply status must be known.'
    ));
  }
  const policy = asObject(value.executionPolicy);
  if (policy.requireAuthenticatedAdminActor !== true ||
      policy.requireSingleUseExpiringAuthorization !== true ||
      policy.requireFinalSourceFingerprintCheck !== true ||
      policy.requireDurableRollbackEvidenceBeforeSourceWrite !== true ||
      policy.prohibitApiSuppliedDryRun !== true || policy.prohibitApiSuppliedReviewArtifact !== true ||
      policy.prohibitWholeFileDeletion !== true || policy.prohibitPathWidening !== true ||
      policy.prohibitFileDeletion !== true || policy.prohibitStorageMutation !== true ||
      policy.prohibitGitMutationCommands !== true) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Controlled scope removal apply must preserve its scoped mutation policy.'
    ));
  }
  const sideEffects = asObject(value.sideEffects);
  if (sideEffects.filesDeleted === true || sideEffects.storageChanged === true ||
      sideEffects.gitCommandsRun === true) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'Controlled scope removal apply cannot report file deletion, storage mutation, or Git mutation.'
    ));
  }
  if (value.statusId === POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS.APPLIED &&
      (sideEffects.authorizationConsumed !== true || sideEffects.rollbackEvidenceWritten !== true ||
      sideEffects.sourceWritten !== true || sideEffects.applyAuditWritten !== true ||
      sideEffects.sourceRestored === true || value.riskCount !== 0)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      'A completed controlled scope removal apply requires one authorization, rollback evidence, source write, and audit outcome.'
    ));
  }

  return { issueCount: issues.length, issues, ok: issues.length === 0 };
}

function createPolicyControlledCompatibilityNamedScopeRemovalApplyAdapter(options = {}) {
  return {
    apply({ actor, authorizationId } = {}) {
      return applyPolicyControlledCompatibilityNamedScopeRemoval({
        ...options,
        actor,
        authorizationId,
      });
    },
  };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_VERSION,
  applyPolicyControlledCompatibilityNamedScopeRemoval,
  createPolicyControlledCompatibilityNamedScopeRemovalApplyAdapter,
  validatePolicyControlledCompatibilityNamedScopeRemovalApply,
};
