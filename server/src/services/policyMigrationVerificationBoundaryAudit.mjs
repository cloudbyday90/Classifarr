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
  listPolicyMigrationStaticImportPaths,
  listPolicyMigrationStaticSourceFiles,
  normalizePolicyMigrationSourceFile,
} from './policyMigrationStaticSourceInventory.mjs';

const POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_VERSION =
  'policy.migration_verification_boundary_audit.v1';

const POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_RISK_IDS = Object.freeze({
  MISSING_EXPECTED_IMPORTER: 'missing_expected_importer',
  UNEXPECTED_IMPORTER: 'unexpected_importer',
  ROUTE_IMPORTER: 'route_importer',
  INVALID_SOURCE_INVENTORY: 'invalid_source_inventory',
});

const PROTECTED_ARTIFACTS = Object.freeze([
  {
    path: 'server/src/services/policyMigrationVerificationCoordinator.mjs',
    allowedImporterPaths: [
      'server/src/services/policyMigrationVerificationRunHandoff.mjs',
    ],
  },
  {
    path: 'server/src/services/policyMigrationVerificationRunHandoff.mjs',
    allowedImporterPaths: [
      'server/src/services/policyLibraryRebuildCutoverOrchestrator.mjs',
    ],
  },
  {
    path: 'server/src/services/policyMigrationVerificationRunRepository.mjs',
    allowedImporterPaths: [
      'server/src/services/policyMigrationVerificationRunHandoff.mjs',
    ],
  },
  {
    path: 'server/src/services/policyLibraryRebuildVerificationRunBinding.mjs',
    allowedImporterPaths: [
      'server/src/services/policyLibraryRebuildReplacementGate.mjs',
      'server/src/services/policyLibraryRebuildSnapshotGate.mjs',
    ],
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function listPolicyMigrationVerificationBoundarySourceFiles() {
  return listPolicyMigrationStaticSourceFiles();
}

function buildIssue(riskId, message, path, importerPath = null) {
  return {
    riskId,
    message,
    path,
    ...(importerPath ? { importerPath } : {}),
  };
}

function buildPolicyMigrationVerificationBoundaryAudit({
  sourceFiles = listPolicyMigrationVerificationBoundarySourceFiles(),
} = {}) {
  const normalizedSourceFiles = asArray(sourceFiles).map(normalizePolicyMigrationSourceFile);
  const issues = [];

  if (normalizedSourceFiles.some(sourceFile => !sourceFile.path || sourceFile.source === null)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_RISK_IDS.INVALID_SOURCE_INVENTORY,
      'Migration verification topology auditing requires readable server module source.',
      'server/src',
    ));
  }

  const artifacts = PROTECTED_ARTIFACTS.map(artifact => {
    const importedByPaths = normalizedSourceFiles
      .filter(sourceFile =>
        listPolicyMigrationStaticImportPaths(sourceFile).includes(artifact.path))
      .map(sourceFile => sourceFile.path)
      .sort();
    const expectedImporterPaths = [...artifact.allowedImporterPaths].sort();

    expectedImporterPaths.forEach(importerPath => {
      if (!importedByPaths.includes(importerPath)) {
        issues.push(buildIssue(
          POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_RISK_IDS.MISSING_EXPECTED_IMPORTER,
          'The retained migration component must remain owned by its declared server boundary.',
          artifact.path,
          importerPath,
        ));
      }
    });

    importedByPaths
      .filter(importerPath => !expectedImporterPaths.includes(importerPath))
      .forEach(importerPath => {
        issues.push(buildIssue(
          importerPath.startsWith('server/src/routes/')
            ? POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_RISK_IDS.ROUTE_IMPORTER
            : POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_RISK_IDS.UNEXPECTED_IMPORTER,
          importerPath.startsWith('server/src/routes/')
            ? 'Policy authoring routes cannot import a retained migration verification component.'
            : 'Only the declared server boundary may import a retained migration verification component.',
          artifact.path,
          importerPath,
        ));
      });

    return {
      path: artifact.path,
      allowedImporterPaths: expectedImporterPaths,
      importedByPaths,
    };
  });

  return {
    version: POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_VERSION,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    normalWorkflowSurface: false,
    sideEffects: {
      databaseRead: false,
      verificationRunPersisted: false,
      policyStorageMutated: false,
      routingWritten: false,
      learningWritten: false,
      providerAccessed: false,
      schedulerTriggered: false,
    },
    artifacts,
  };
}

export {
  POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_RISK_IDS,
  POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_VERSION,
  buildPolicyMigrationVerificationBoundaryAudit,
  listPolicyMigrationVerificationBoundarySourceFiles,
  listPolicyMigrationStaticImportPaths as listStaticImportPaths,
};
