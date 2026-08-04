/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import {
  createPolicyMigrationVerificationCoordinator,
} from './policyMigrationVerificationCoordinator.mjs';
import {
  buildPolicyMigrationVerificationInvocationAdmission,
} from './policyMigrationVerificationInvocationBoundary.mjs';
import {
  POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS,
  buildPolicyMigrationVerificationCoordinatorAudit,
} from './policyMigrationVerificationCoordinatorContract.mjs';
import {
  POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS,
  POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS,
  buildPolicyMigrationVerificationRunResult,
  validateCoordinatorForPersistence,
  validatePolicyMigrationVerificationRunResult,
} from './policyMigrationVerificationRunContract.mjs';
import {
  policyMigrationVerificationRunRepository,
} from './policyMigrationVerificationRunRepository.mjs';

function createPolicyMigrationVerificationRunHandoff({
  db = defaultDb,
  coordinator = createPolicyMigrationVerificationCoordinator(),
  verificationRunRepository = policyMigrationVerificationRunRepository,
  invocationScopeId = null,
} = {}) {
  function buildAuditedPersistenceResult({
    statusId,
    coordinatorResult,
    verificationRun,
  }) {
    const result = buildPolicyMigrationVerificationRunResult({
      statusId,
      coordinatorResult,
      verificationRun,
    });

    return validatePolicyMigrationVerificationRunResult(result).ok
      ? result
      : buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_FAILED,
        coordinatorResult,
      });
  }

  async function recordMigrationVerificationRun(input = {}) {
    const invocationAdmission = buildPolicyMigrationVerificationInvocationAdmission({
      invocationScopeId,
      input,
    });
    if (!invocationAdmission.ok) {
      return buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.BOUNDARY_REJECTED,
        persistenceError: invocationAdmission.issues[0]?.riskId,
      });
    }

    if (!coordinator || typeof coordinator.coordinateMigrationVerification !== 'function') {
      return buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.COORDINATOR_AUDIT_FAILED,
      });
    }

    let coordinatorResult;
    try {
      coordinatorResult = await coordinator.coordinateMigrationVerification(
        invocationAdmission.acceptedInput
      );
    } catch {
      return buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.COORDINATOR_AUDIT_FAILED,
      });
    }

    const coordinatorAudit = buildPolicyMigrationVerificationCoordinatorAudit(coordinatorResult);
    if (!coordinatorAudit.ok) {
      return buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.COORDINATOR_AUDIT_FAILED,
        coordinatorResult,
      });
    }

    if (coordinatorResult.statusId !== POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.READY ||
        coordinatorResult.ok !== true) {
      return buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.NOT_READY,
        coordinatorResult,
      });
    }

    const persistenceValidation = validateCoordinatorForPersistence(coordinatorResult);
    if (!persistenceValidation.ok) {
      return buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.COORDINATOR_AUDIT_FAILED,
        coordinatorResult,
      });
    }

    if (typeof db?.withTransaction !== 'function' ||
        !verificationRunRepository || typeof verificationRunRepository.claim !== 'function') {
      return buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_BOUNDARY_UNAVAILABLE,
        coordinatorResult,
        persistenceError:
          POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.PERSISTENCE_BOUNDARY_UNAVAILABLE,
      });
    }

    try {
      const claim = await db.withTransaction(client =>
        verificationRunRepository.claim({ client, coordinatorResult })
      );
      if (claim?.claimed === true) {
        return buildAuditedPersistenceResult({
          statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTED,
          coordinatorResult,
          verificationRun: claim.verificationRun,
        });
      }

      if (claim?.replayed === true) {
        return buildAuditedPersistenceResult({
          statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.REPLAYED,
          coordinatorResult,
          verificationRun: claim.verificationRun,
        });
      }

      return buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_FAILED,
        coordinatorResult,
        persistenceError: POLICY_MIGRATION_VERIFICATION_RUN_RISK_IDS.REPOSITORY_CONFLICT,
      });
    } catch {
      return buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_FAILED,
        coordinatorResult,
      });
    }
  }

  return {
    recordMigrationVerificationRun,
  };
}

export {
  createPolicyMigrationVerificationRunHandoff,
};
