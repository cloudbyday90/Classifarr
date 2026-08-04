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
  POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_RISK_IDS,
  buildPolicyMigrationVerificationBoundaryAudit,
  listPolicyMigrationVerificationBoundarySourceFiles,
} from '../../services/policyMigrationVerificationBoundaryAudit.mjs';

describe('policyMigrationVerificationBoundaryAudit', () => {
  test('keeps retained migration verification modules off ordinary route surfaces', () => {
    const audit = buildPolicyMigrationVerificationBoundaryAudit();

    expect(audit).toEqual(expect.objectContaining({
      version: 'policy.migration_verification_boundary_audit.v1',
      ok: true,
      issueCount: 0,
      issues: [],
      normalWorkflowSurface: false,
    }));
    expect(audit.artifacts).toEqual([
      expect.objectContaining({
        path: 'server/src/services/policyMigrationVerificationCoordinator.mjs',
        importedByPaths: ['server/src/services/policyMigrationVerificationRunHandoff.mjs'],
      }),
      expect.objectContaining({
        path: 'server/src/services/policyMigrationVerificationRunHandoff.mjs',
        importedByPaths: ['server/src/services/policyLibraryRebuildCutoverOrchestrator.mjs'],
      }),
      expect.objectContaining({
        path: 'server/src/services/policyMigrationVerificationRunRepository.mjs',
        importedByPaths: ['server/src/services/policyMigrationVerificationRunHandoff.mjs'],
      }),
      expect.objectContaining({
        path: 'server/src/services/policyLibraryRebuildVerificationRunBinding.mjs',
        importedByPaths: [
          'server/src/services/policyLibraryRebuildReplacementGate.mjs',
          'server/src/services/policyLibraryRebuildSnapshotGate.mjs',
        ],
      }),
    ]);
  });

  test('fails closed when a policy route imports a retained verification component', () => {
    const sourceFiles = listPolicyMigrationVerificationBoundarySourceFiles();
    sourceFiles.push({
      path: 'server/src/routes/policiesRouteUnsafeMigrationVerifier.mjs',
      source: `import { createPolicyMigrationVerificationRunHandoff }
        from '../services/policyMigrationVerificationRunHandoff.mjs';`,
    });

    const audit = buildPolicyMigrationVerificationBoundaryAudit({ sourceFiles });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MIGRATION_VERIFICATION_BOUNDARY_AUDIT_RISK_IDS.ROUTE_IMPORTER,
        path: 'server/src/services/policyMigrationVerificationRunHandoff.mjs',
        importerPath: 'server/src/routes/policiesRouteUnsafeMigrationVerifier.mjs',
      }),
    ]));
  });
});
