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

import path from 'node:path';

import {
  createPolicyControlledCompatibilityNamedScopeRemovalApplyAdapter,
} from './policyControlledCompatibilityNamedScopeRemovalApply.mjs';
import {
  createPolicyControlledCompatibilityNamedScopeRemovalDatabaseScopeLock,
} from './policyControlledCompatibilityNamedScopeRemovalDatabaseScopeLock.mjs';
import {
  createPolicyControlledCompatibilityNamedScopeRemovalApplyOperationStore,
} from './policyControlledCompatibilityNamedScopeRemovalApplyOperationStore.mjs';
import {
  createPolicyControlledCompatibilityNamedScopeRemovalApplySourceWriter,
} from './policyControlledCompatibilityNamedScopeRemovalApplySourceWriter.mjs';
import {
  createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter,
} from './policyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_AUTHORIZATION_TTL_MS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_MAX_AUTHORIZATION_TTL_MS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_MIN_AUTHORIZATION_TTL_MS,
  resolvePolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfiguration,
} from './policyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfig.mjs';

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_VERSION =
  'policy.controlled_compatibility_named_scope_removal_production_admission.v1';

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS =
  Object.freeze({
    APPLY_COMPLETED: 'apply_completed',
    BLOCKED_BY_AUTHENTICATED_ACTOR: 'blocked_by_authenticated_actor',
    BLOCKED_BY_REVIEW_CONTEXT: 'blocked_by_review_context',
    ISSUED: 'issued',
  });

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_RISK_IDS =
  Object.freeze({
    AUTHENTICATED_ADMIN_REQUIRED: 'authenticated_admin_required',
    REVIEW_CONTEXT_UNAVAILABLE: 'review_context_unavailable',
  });

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeAuthenticatedAdminActor(authenticatedRequest = {}) {
  const user = asObject(asObject(authenticatedRequest).user);
  const rawId = user.id;
  const actorId = typeof rawId === 'string' || typeof rawId === 'number'
    ? String(rawId).trim()
    : '';

  return actorId && user.role === 'admin' ? { id: actorId, role: 'admin' } : null;
}

function readCurrentTime(now) {
  const currentTime = now();
  const timestampMs = Date.parse(typeof currentTime === 'string' ? currentTime.trim() : '');

  if (!Number.isFinite(timestampMs)) {
    throw new Error('Controlled scope removal production admission clock is invalid.');
  }

  return new Date(timestampMs).toISOString();
}

function buildAdmissionResult({
  apply = null,
  authorization = null,
  riskIds = [],
  statusId,
} = {}) {
  return {
    apply,
    authorization,
    riskIds,
    statusId,
    version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_VERSION,
  };
}

function createPolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionAdapter({
  authorizationTtlMs = POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_AUTHORIZATION_TTL_MS,
  evidenceRoot,
  getServerReviewContext,
  now = () => new Date().toISOString(),
  repoRoot,
  replayAdapterFactory = createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter,
  sourceWriterFactory = createPolicyControlledCompatibilityNamedScopeRemovalApplySourceWriter,
  withSessionAdvisoryLock,
} = {}) {
  if (typeof getServerReviewContext !== 'function' ||
      typeof replayAdapterFactory !== 'function' || typeof sourceWriterFactory !== 'function' ||
      typeof evidenceRoot !== 'string' || !path.isAbsolute(evidenceRoot) ||
      typeof repoRoot !== 'string' || !path.isAbsolute(repoRoot) ||
      !Number.isInteger(authorizationTtlMs) ||
      authorizationTtlMs < POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_MIN_AUTHORIZATION_TTL_MS ||
      authorizationTtlMs > POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_MAX_AUTHORIZATION_TTL_MS ||
      typeof now !== 'function') {
    throw new Error('Controlled scope removal production admission configuration is invalid.');
  }

  const authorizationStore = createPolicyControlledCompatibilityNamedScopeRemovalApplyOperationStore({
    evidenceRoot,
    now,
    repoRoot,
  });
  const scopeLock = createPolicyControlledCompatibilityNamedScopeRemovalDatabaseScopeLock({
    withSessionAdvisoryLock,
  });
  const sourceWriter = sourceWriterFactory();

  function buildApplyAdapter(currentTime) {
    return createPolicyControlledCompatibilityNamedScopeRemovalApplyAdapter({
      authorizationStore,
      now: currentTime,
      replayAdapter: replayAdapterFactory({ now: currentTime, repoRoot }),
      repoRoot,
      scopeLock,
      sourceWriter,
    });
  }

  async function issue({ authenticatedRequest } = {}) {
    const actor = normalizeAuthenticatedAdminActor(authenticatedRequest);
    if (!actor) {
      return buildAdmissionResult({
        riskIds: [
          POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_RISK_IDS
            .AUTHENTICATED_ADMIN_REQUIRED,
        ],
        statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS
          .BLOCKED_BY_AUTHENTICATED_ACTOR,
      });
    }

    const issuedAt = readCurrentTime(now);
    let reviewContext;
    try {
      reviewContext = await getServerReviewContext();
    } catch (_error) {
      return buildAdmissionResult({
        riskIds: [
          POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_RISK_IDS
            .REVIEW_CONTEXT_UNAVAILABLE,
        ],
        statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS
          .BLOCKED_BY_REVIEW_CONTEXT,
      });
    }

    try {
      const authorization = await authorizationStore.issueAuthorization({
        actor,
        expiresAt: new Date(Date.parse(issuedAt) + authorizationTtlMs).toISOString(),
        reviewContext,
      });
      return buildAdmissionResult({
        authorization,
        statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS
          .ISSUED,
      });
    } catch (_error) {
      return buildAdmissionResult({
        riskIds: [
          POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_RISK_IDS
            .REVIEW_CONTEXT_UNAVAILABLE,
        ],
        statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS
          .BLOCKED_BY_REVIEW_CONTEXT,
      });
    }
  }

  async function apply({ authenticatedRequest, authorizationId } = {}) {
    const actor = normalizeAuthenticatedAdminActor(authenticatedRequest);
    if (!actor) {
      return buildAdmissionResult({
        riskIds: [
          POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_RISK_IDS
            .AUTHENTICATED_ADMIN_REQUIRED,
        ],
        statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS
          .BLOCKED_BY_AUTHENTICATED_ACTOR,
      });
    }

    const result = await buildApplyAdapter(readCurrentTime(now)).apply({
      actor,
      authorizationId,
    });
    return buildAdmissionResult({
      apply: result,
      statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS
        .APPLY_COMPLETED,
    });
  }

  return { apply, issue };
}

function createPolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionFromEnvironment({
  environment = process.env,
  pathModule,
  ...options
} = {}) {
  const resolvedConfiguration =
    resolvePolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfiguration({
      environment,
      pathModule,
    });
  if (resolvedConfiguration.validation.ok !== true) {
    throw new Error('Controlled scope removal production admission environment is invalid.');
  }

  return createPolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionAdapter({
    ...options,
    ...resolvedConfiguration.configuration,
  });
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_VERSION,
  createPolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionAdapter,
  createPolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionFromEnvironment,
};
