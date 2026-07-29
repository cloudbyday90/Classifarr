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
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS,
  validatePolicyLibraryRebuildAcceptanceTransition,
} from './policyLibraryRebuildAcceptanceTransition.mjs';
import {
  validatePolicyLibraryPolicyRebuildProposal,
} from './policyLibraryPolicyRebuild.mjs';
import {
  POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS,
  buildPolicyMigrationRepresentativeClassificationSourceAudit,
  createPolicyMigrationRepresentativeClassificationSource,
} from './policyMigrationRepresentativeClassificationSource.mjs';
import {
  buildPolicyMigrationVerifierAudit,
  buildPolicyMigrationVerifierReportFromRebuildProposal,
} from './policyMigrationVerifierRollback.mjs';
import {
  POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS,
  POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS,
  buildPolicyMigrationVerificationCoordinatorResult,
} from './policyMigrationVerificationCoordinatorContract.mjs';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Migration verification coordination requires a valid server evaluation time.');
  }

  return date;
}

function policyContextFromAcceptanceTransition(acceptanceTransition = {}) {
  const policyContext = asObject(asObject(acceptanceTransition).policyContext);

  return {
    policyId: normalizePositiveInteger(policyContext.policyId ?? policyContext.policy_id),
    intentId: normalizePositiveInteger(policyContext.intentId ?? policyContext.intent_id),
    libraryId: normalizePositiveInteger(policyContext.libraryId ?? policyContext.library_id),
  };
}

function sourceDatabaseRead(sourceResult = {}) {
  return asObject(sourceResult).sideEffects?.databaseRead === true;
}

function createPolicyMigrationVerificationCoordinator({
  representativeClassificationSource = createPolicyMigrationRepresentativeClassificationSource(),
  buildVerifierReport = buildPolicyMigrationVerifierReportFromRebuildProposal,
  buildVerifierAudit = buildPolicyMigrationVerifierAudit,
  buildSourceAudit = buildPolicyMigrationRepresentativeClassificationSourceAudit,
} = {}) {
  async function coordinateMigrationVerification({
    proposal = {},
    acceptanceTransition = {},
    migrationPlan,
    maxClassifications,
    maxDifferences,
    confidenceDeltaThreshold,
    deletionCriteria,
    now = new Date(),
  } = {}) {
    let evaluatedAt;
    try {
      evaluatedAt = normalizeDate(now);
    } catch {
      return buildPolicyMigrationVerificationCoordinatorResult({
        statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.COORDINATION_FAILED,
        ok: false,
        issueRiskId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.COORDINATION_FAILED,
      });
    }

    const normalizedProposal = asObject(proposal);
    const normalizedTransition = asObject(acceptanceTransition);
    const policyContext = policyContextFromAcceptanceTransition(normalizedTransition);
    const proposalValidation = validatePolicyLibraryPolicyRebuildProposal(normalizedProposal);
    if (!proposalValidation.ok) {
      return buildPolicyMigrationVerificationCoordinatorResult({
        statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.INVALID_REBUILD_PROPOSAL,
        ok: false,
        evaluatedAt: evaluatedAt.toISOString(),
        policyContext,
        acceptanceTransition: normalizedTransition,
        issueRiskId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.INVALID_REBUILD_PROPOSAL,
      });
    }

    const transitionValidation = validatePolicyLibraryRebuildAcceptanceTransition({
      transition: normalizedTransition,
      proposal: normalizedProposal,
      now: evaluatedAt,
    });
    if (!transitionValidation.ok ||
        normalizedTransition.statusId !==
          POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION ||
        normalizedTransition.application?.canEnterMigrationVerification !== true) {
      return buildPolicyMigrationVerificationCoordinatorResult({
        statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.INVALID_ACCEPTANCE_TRANSITION,
        ok: false,
        evaluatedAt: evaluatedAt.toISOString(),
        policyContext,
        acceptanceTransition: normalizedTransition,
        issueRiskId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS
          .INVALID_ACCEPTANCE_TRANSITION,
      });
    }

    if (!representativeClassificationSource ||
        typeof representativeClassificationSource.collectRepresentativeClassifications !== 'function') {
      return buildPolicyMigrationVerificationCoordinatorResult({
        statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.SOURCE_UNAVAILABLE,
        ok: false,
        evaluatedAt: evaluatedAt.toISOString(),
        policyContext,
        acceptanceTransition: normalizedTransition,
        issueRiskId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.SOURCE_UNAVAILABLE,
      });
    }

    try {
      const sourceResult = await representativeClassificationSource
        .collectRepresentativeClassifications({
          policyContext: {
            policyId: policyContext.policyId,
            libraryId: policyContext.libraryId,
          },
          proposal: normalizedProposal,
          maxClassifications,
        });
      const sourceAudit = buildSourceAudit(sourceResult);
      const databaseRead = sourceDatabaseRead(sourceResult);

      if (!sourceAudit.ok) {
        return buildPolicyMigrationVerificationCoordinatorResult({
          statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.SOURCE_AUDIT_FAILED,
          ok: false,
          evaluatedAt: evaluatedAt.toISOString(),
          policyContext,
          acceptanceTransition: normalizedTransition,
          sourceResult,
          sourceAudit,
          databaseRead,
          issueRiskId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.SOURCE_AUDIT_FAILED,
        });
      }

      if (sourceResult?.statusId ===
          POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS
            .INSUFFICIENT_REPRESENTATIVE_COVERAGE &&
          sourceResult.ok === true && sourceResult.ready === false) {
        return buildPolicyMigrationVerificationCoordinatorResult({
          statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS
            .INSUFFICIENT_REPRESENTATIVE_COVERAGE,
          ok: true,
          evaluatedAt: evaluatedAt.toISOString(),
          policyContext,
          acceptanceTransition: normalizedTransition,
          sourceResult,
          sourceAudit,
          databaseRead,
        });
      }

      if (sourceResult?.statusId !==
          POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.READY ||
          sourceResult.ok !== true || sourceResult.ready !== true) {
        return buildPolicyMigrationVerificationCoordinatorResult({
          statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.SOURCE_UNAVAILABLE,
          ok: false,
          evaluatedAt: evaluatedAt.toISOString(),
          policyContext,
          acceptanceTransition: normalizedTransition,
          sourceResult,
          sourceAudit,
          databaseRead,
          issueRiskId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.SOURCE_UNAVAILABLE,
        });
      }

      const verifierReport = buildVerifierReport({
        proposal: normalizedProposal,
        acceptanceTransition: normalizedTransition,
        representativeClassifications: sourceResult.representativeClassifications,
        migrationPlan,
        maxDifferences,
        confidenceDeltaThreshold,
        deletionCriteria,
        now: evaluatedAt,
      });
      const verifierAudit = buildVerifierAudit(verifierReport);
      if (!verifierAudit.ok) {
        return buildPolicyMigrationVerificationCoordinatorResult({
          statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.VERIFIER_AUDIT_FAILED,
          ok: false,
          evaluatedAt: evaluatedAt.toISOString(),
          policyContext,
          acceptanceTransition: normalizedTransition,
          sourceResult,
          sourceAudit,
          verifierAudit,
          databaseRead,
          issueRiskId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.VERIFIER_AUDIT_FAILED,
        });
      }

      return buildPolicyMigrationVerificationCoordinatorResult({
        statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.READY,
        ok: true,
        evaluatedAt: evaluatedAt.toISOString(),
        policyContext,
        acceptanceTransition: normalizedTransition,
        sourceResult,
        sourceAudit,
        verifierReport,
        verifierAudit,
        databaseRead,
      });
    } catch {
      return buildPolicyMigrationVerificationCoordinatorResult({
        statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.COORDINATION_FAILED,
        ok: false,
        evaluatedAt: evaluatedAt.toISOString(),
        policyContext,
        acceptanceTransition: normalizedTransition,
        issueRiskId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.COORDINATION_FAILED,
      });
    }
  }

  return {
    coordinateMigrationVerification,
  };
}

export {
  createPolicyMigrationVerificationCoordinator,
};
