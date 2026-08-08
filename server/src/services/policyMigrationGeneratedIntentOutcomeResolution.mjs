/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  listPolicyMigrationStaticImportPaths,
  listPolicyMigrationStaticSourceFiles,
  normalizePolicyMigrationSourceFile,
} from './policyMigrationStaticSourceInventory.mjs';
import { buildPolicyRuntimeEvidenceProjection } from './policyRuntimeEvidenceProjection.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_VERSION =
  'policy.migration_generated_intent_outcome_resolution.v1';

const POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH =
  'server/src/services/policyMigrationGeneratedIntentOutcome.mjs';

const POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH =
  'server/src/services/policyRuntimeEvidenceProjection.mjs';

const RESOLUTION_DECISION_IDS = Object.freeze({
  RETAIN_MIGRATION_ONLY: 'retain_migration_only',
  PROMOTE_TO_RUNTIME_EVIDENCE: 'promote_to_runtime_evidence',
  DELETE_IMMEDIATELY: 'delete_immediately',
});

const VERIFIER_CHAIN_EXIT_CRITERION_IDS = Object.freeze({
  NATIVE_MIGRATION_PARITY_PROVEN: 'native_migration_parity_proven',
  NATIVE_STORAGE_CUTOVER_COMPLETE: 'native_storage_cutover_complete',
  ROLLBACK_RETENTION_WINDOW_EXPIRED: 'rollback_retention_window_expired',
  NO_ACTIVE_REBUILD_BINDING: 'no_active_rebuild_binding',
});

const REQUIRED_VERIFIER_CHAIN_EXIT_CRITERIA = Object.freeze([
  VERIFIER_CHAIN_EXIT_CRITERION_IDS.NATIVE_MIGRATION_PARITY_PROVEN,
  VERIFIER_CHAIN_EXIT_CRITERION_IDS.NATIVE_STORAGE_CUTOVER_COMPLETE,
  VERIFIER_CHAIN_EXIT_CRITERION_IDS.ROLLBACK_RETENTION_WINDOW_EXPIRED,
  VERIFIER_CHAIN_EXIT_CRITERION_IDS.NO_ACTIVE_REBUILD_BINDING,
]);

const ALLOWED_REDUCER_IMPORTER_PATHS = Object.freeze([
  'server/src/services/policyMigrationRepresentativeClassificationSource.mjs',
  'server/src/services/policyMigrationVerifierRollback.mjs',
]);

const REDUCER_OUTPUT_FIELDS = Object.freeze([
  'destinationLibraryId',
  'destinationLibraryName',
  'statusId',
  'routeReady',
  'blocked',
  'needsReview',
  'confidenceScore',
  'confidenceLevel',
]);

const PROHIBITED_IMPORTER_PREFIXES = Object.freeze([
  'server/src/routes/',
]);

const PROHIBITED_IMPORTER_PATHS = Object.freeze([
  POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH,
]);

const POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS = Object.freeze({
  INVALID_RESOLUTION_VERSION: 'invalid_resolution_version',
  INVALID_RESOLUTION_DECISION: 'invalid_resolution_decision',
  UNSAFE_PROMOTION_FLAG: 'unsafe_promotion_flag',
  BROKEN_DELETION_BINDING: 'broken_deletion_binding',
  MISSING_EXPECTED_IMPORTER: 'missing_expected_importer',
  UNEXPECTED_IMPORTER: 'unexpected_importer',
  ROUTE_IMPORTER: 'route_importer',
  RUNTIME_EVIDENCE_IMPORTER: 'runtime_evidence_importer',
  RUNTIME_EVIDENCE_FIELD_OVERLAP: 'runtime_evidence_field_overlap',
  INVALID_RUNTIME_EVIDENCE_PROJECTION: 'invalid_runtime_evidence_projection',
  REDUCER_SOURCE_NOT_FOUND: 'reducer_source_not_found',
  INVALID_SOURCE_INVENTORY: 'invalid_source_inventory',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function listPolicyMigrationGeneratedIntentOutcomeResolutionSourceFiles() {
  return listPolicyMigrationStaticSourceFiles();
}

function buildIssue(riskId, message, path = null, importerPath = null) {
  return {
    riskId,
    message,
    ...(path ? { path } : {}),
    ...(importerPath ? { importerPath } : {}),
  };
}

function buildPolicyMigrationGeneratedIntentOutcomeResolutionContract() {
  return {
    version: POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_VERSION,
    decisionId: RESOLUTION_DECISION_IDS.RETAIN_MIGRATION_ONLY,
    promotedToRuntimeEvidence: false,
    reducerPath: POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
    runtimeEvidenceProjectionPath: POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH,
    allowedImporterPaths: ALLOWED_REDUCER_IMPORTER_PATHS,
    prohibitedImporterPrefixes: PROHIBITED_IMPORTER_PREFIXES,
    prohibitedImporterPaths: PROHIBITED_IMPORTER_PATHS,
    verifierChainExitCriterionIds: REQUIRED_VERIFIER_CHAIN_EXIT_CRITERIA,
    reducerOutputFields: REDUCER_OUTPUT_FIELDS,
    normalWorkflowSurface: false,
    sideEffectsAllowed: false,
  };
}

function validatePolicyMigrationGeneratedIntentOutcomeResolutionContract(contract = {}) {
  const issues = [];

  if (normalizeString(contract.version) !==
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_VERSION) {
    issues.push(buildIssue(
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.INVALID_RESOLUTION_VERSION,
      'Generated-intent outcome resolution must use the supported version.',
    ));
  }

  if (normalizeString(contract.decisionId) !== RESOLUTION_DECISION_IDS.RETAIN_MIGRATION_ONLY) {
    issues.push(buildIssue(
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.INVALID_RESOLUTION_DECISION,
      'Generated-intent outcome reducer must be retained as migration-only.',
    ));
  }

  if (contract.promotedToRuntimeEvidence === true) {
    issues.push(buildIssue(
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.UNSAFE_PROMOTION_FLAG,
      'Generated-intent outcome reducer must not be promoted into the runtime-evidence contract.',
    ));
  }

  const exitCriteria = asArray(contract.verifierChainExitCriterionIds).map(normalizeString);
  const missingCriteria = REQUIRED_VERIFIER_CHAIN_EXIT_CRITERIA.filter(
    criterion => !exitCriteria.includes(criterion)
  );
  if (missingCriteria.length > 0) {
    issues.push(buildIssue(
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.BROKEN_DELETION_BINDING,
      'Generated-intent outcome reducer deletion must remain bound to the full verifier chain exit criteria.',
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function checkReducerImportTopology({ sourceFiles, issues }) {
  const normalizedSourceFiles = asArray(sourceFiles).map(normalizePolicyMigrationSourceFile);
  const importers = normalizedSourceFiles
    .filter(sourceFile =>
      listPolicyMigrationStaticImportPaths(sourceFile)
        .includes(POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH))
    .map(sourceFile => sourceFile.path)
    .sort();

  ALLOWED_REDUCER_IMPORTER_PATHS.forEach(allowedImporter => {
    if (!importers.includes(allowedImporter)) {
      issues.push(buildIssue(
        POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.MISSING_EXPECTED_IMPORTER,
        'The generated-intent outcome reducer must remain imported by its declared migration-parity consumers.',
        POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
        allowedImporter,
      ));
    }
  });

  importers
    .filter(importer => !ALLOWED_REDUCER_IMPORTER_PATHS.includes(importer))
    .forEach(importer => {
      const isRoute = PROHIBITED_IMPORTER_PREFIXES.some(prefix => importer.startsWith(prefix));
      const isRuntimeEvidence = PROHIBITED_IMPORTER_PATHS.includes(importer);

      if (isRoute) {
        issues.push(buildIssue(
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.ROUTE_IMPORTER,
          'Policy routes cannot import the generated-intent outcome reducer.',
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
          importer,
        ));
      } else if (isRuntimeEvidence) {
        issues.push(buildIssue(
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.RUNTIME_EVIDENCE_IMPORTER,
          'The runtime-evidence projection cannot import the generated-intent outcome reducer.',
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
          importer,
        ));
      } else {
        issues.push(buildIssue(
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.UNEXPECTED_IMPORTER,
          'Only declared migration-parity consumers may import the generated-intent outcome reducer.',
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
          importer,
        ));
      }
    });

  return importers;
}

function checkRuntimeEvidenceFieldOverlap({ buildRuntimeEvidenceProjection, issues }) {
  let runtimeEvidenceProjection;
  try {
    runtimeEvidenceProjection = buildRuntimeEvidenceProjection();
  } catch {
    issues.push(buildIssue(
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS
        .INVALID_RUNTIME_EVIDENCE_PROJECTION,
      'The runtime-evidence projection must be available for migration boundary auditing.',
      POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH,
    ));
    return [];
  }

  if (!isObject(runtimeEvidenceProjection)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS
        .INVALID_RUNTIME_EVIDENCE_PROJECTION,
      'The runtime-evidence projection must return a top-level object for migration boundary auditing.',
      POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH,
    ));
    return [];
  }

  const runtimeEvidenceOutputFields = Object.keys(runtimeEvidenceProjection).sort();
  const overlappingFields = REDUCER_OUTPUT_FIELDS.filter(field =>
    runtimeEvidenceOutputFields.includes(field));

  if (overlappingFields.length > 0) {
    issues.push(buildIssue(
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.RUNTIME_EVIDENCE_FIELD_OVERLAP,
      'The runtime-evidence projection top-level contract must not expose generated-intent outcome comparison fields.',
      POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH,
    ));
  }

  return runtimeEvidenceOutputFields;
}

function buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit({
  sourceFiles = listPolicyMigrationGeneratedIntentOutcomeResolutionSourceFiles(),
  exists = existsSync,
  buildRuntimeEvidenceProjection = buildPolicyRuntimeEvidenceProjection,
} = {}) {
  const normalizedSourceFiles = asArray(sourceFiles).map(normalizePolicyMigrationSourceFile);
  const contract = buildPolicyMigrationGeneratedIntentOutcomeResolutionContract();
  const issues = [];

  if (normalizedSourceFiles.some(sourceFile => !sourceFile.path || sourceFile.source === null)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.INVALID_SOURCE_INVENTORY,
      'Generated-intent outcome resolution auditing requires readable server module source.',
      'server/src',
    ));
  }

  const reducerExists = exists(resolve(REPO_ROOT, POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH));
  if (!reducerExists) {
    issues.push(buildIssue(
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.REDUCER_SOURCE_NOT_FOUND,
      'The generated-intent outcome reducer must remain present while migration verification is active.',
      POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
    ));
  }

  issues.push(...validatePolicyMigrationGeneratedIntentOutcomeResolutionContract(contract).issues);

  const importers = checkReducerImportTopology({ sourceFiles: normalizedSourceFiles, issues });
  const runtimeEvidenceOutputFields = checkRuntimeEvidenceFieldOverlap({
    buildRuntimeEvidenceProjection,
    issues,
  });

  return {
    version: POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_VERSION,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    decisionId: contract.decisionId,
    promotedToRuntimeEvidence: contract.promotedToRuntimeEvidence,
    reducerPath: contract.reducerPath,
    allowedImporterPaths: contract.allowedImporterPaths,
    prohibitedImporterPrefixes: contract.prohibitedImporterPrefixes,
    prohibitedImporterPaths: contract.prohibitedImporterPaths,
    verifierChainExitCriterionIds: contract.verifierChainExitCriterionIds,
    importedByPaths: importers,
    runtimeEvidenceOutputFields,
    normalWorkflowSurface: false,
    sideEffects: {
      databaseRead: false,
      policyStorageMutated: false,
      routingWritten: false,
      learningWritten: false,
      providerAccessed: false,
      schedulerTriggered: false,
    },
    nextStep: issues.length === 0
      ? {
        stepId: 'final_verifier_deletion_or_promotion_gate',
        label: 'Final verifier deletion or promotion gate',
      }
      : null,
  };
}

export {
  ALLOWED_REDUCER_IMPORTER_PATHS,
  POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
  POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS,
  POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_VERSION,
  POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH,
  REDUCER_OUTPUT_FIELDS,
  RESOLUTION_DECISION_IDS,
  VERIFIER_CHAIN_EXIT_CRITERION_IDS,
  buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit,
  buildPolicyMigrationGeneratedIntentOutcomeResolutionContract,
  listPolicyMigrationGeneratedIntentOutcomeResolutionSourceFiles,
  listPolicyMigrationStaticImportPaths as listStaticImportPaths,
  validatePolicyMigrationGeneratedIntentOutcomeResolutionContract,
};
