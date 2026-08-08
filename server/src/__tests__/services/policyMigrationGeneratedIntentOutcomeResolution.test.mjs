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
  POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
  POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS,
  POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_VERSION,
  POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH,
  RESOLUTION_DECISION_IDS,
  buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit,
  buildPolicyMigrationGeneratedIntentOutcomeResolutionContract,
  listPolicyMigrationGeneratedIntentOutcomeResolutionSourceFiles,
  validatePolicyMigrationGeneratedIntentOutcomeResolutionContract,
} from '../../services/policyMigrationGeneratedIntentOutcomeResolution.mjs';

const REDUCER_IMPORT_LINE =
  `import { buildPolicyMigrationGeneratedIntentOutcome } from './policyMigrationGeneratedIntentOutcome.mjs';`;

function buildSourceFile(path, source) {
  return { path, source };
}

describe('policyMigrationGeneratedIntentOutcomeResolution', () => {
  test('retains the reducer as migration-only with a clean current-state audit', () => {
    const audit = buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit();

    expect(audit).toEqual(expect.objectContaining({
      version: POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_VERSION,
      ok: true,
      issueCount: 0,
      issues: [],
      decisionId: RESOLUTION_DECISION_IDS.RETAIN_MIGRATION_ONLY,
      promotedToRuntimeEvidence: false,
      normalWorkflowSurface: false,
      nextStep: expect.objectContaining({
        stepId: 'final_verifier_deletion_or_promotion_gate',
      }),
    }));
    expect(audit.allowedImporterPaths).toEqual([
      'server/src/services/policyMigrationRepresentativeClassificationSource.mjs',
      'server/src/services/policyMigrationVerifierRollback.mjs',
    ]);
    expect(audit.importedByPaths).toEqual(expect.arrayContaining(audit.allowedImporterPaths));
  });

  test('the resolution contract refuses promotion and binds deletion to the verifier chain', () => {
    const contract = buildPolicyMigrationGeneratedIntentOutcomeResolutionContract();
    const validation = validatePolicyMigrationGeneratedIntentOutcomeResolutionContract(contract);

    expect(contract.decisionId).toBe(RESOLUTION_DECISION_IDS.RETAIN_MIGRATION_ONLY);
    expect(contract.promotedToRuntimeEvidence).toBe(false);
    expect(contract.verifierChainExitCriterionIds).toEqual(expect.arrayContaining([
      'native_migration_parity_proven',
      'native_storage_cutover_complete',
      'rollback_retention_window_expired',
      'no_active_rebuild_binding',
    ]));
    expect(validation.ok).toBe(true);
  });

  test('fails closed when an expected migration-parity importer is missing', () => {
    const sourceFiles = listPolicyMigrationGeneratedIntentOutcomeResolutionSourceFiles()
      .filter(file => file.path !==
        'server/src/services/policyMigrationRepresentativeClassificationSource.mjs');

    const audit = buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit({ sourceFiles });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.MISSING_EXPECTED_IMPORTER,
        path: POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
        importerPath:
          'server/src/services/policyMigrationRepresentativeClassificationSource.mjs',
      }),
    ]));
  });

  test('fails closed when an unexpected non-migration module imports the reducer', () => {
    const sourceFiles = listPolicyMigrationGeneratedIntentOutcomeResolutionSourceFiles();
    sourceFiles.push(buildSourceFile(
      'server/src/services/policyClassificationRuntimeEngine.mjs',
      REDUCER_IMPORT_LINE,
    ));

    const audit = buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit({ sourceFiles });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.UNEXPECTED_IMPORTER,
        path: POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
        importerPath: 'server/src/services/policyClassificationRuntimeEngine.mjs',
      }),
    ]));
  });

  test('fails closed when a policy route imports the reducer', () => {
    const sourceFiles = listPolicyMigrationGeneratedIntentOutcomeResolutionSourceFiles();
    sourceFiles.push(buildSourceFile(
      'server/src/routes/policiesRouteUnsafeReducer.mjs',
      `import { buildPolicyMigrationGeneratedIntentOutcome } from '../services/policyMigrationGeneratedIntentOutcome.mjs';`,
    ));

    const audit = buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit({ sourceFiles });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.ROUTE_IMPORTER,
        path: POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
        importerPath: 'server/src/routes/policiesRouteUnsafeReducer.mjs',
      }),
    ]));
  });

  test('fails closed when the runtime-evidence projection imports the reducer', () => {
    const sourceFiles = listPolicyMigrationGeneratedIntentOutcomeResolutionSourceFiles().map(file => {
      if (file.path === POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH) {
        return buildSourceFile(file.path, `${file.source}\n${REDUCER_IMPORT_LINE}\n`);
      }
      return file;
    });

    const audit = buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit({ sourceFiles });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.RUNTIME_EVIDENCE_IMPORTER,
        path: POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
        importerPath: POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH,
      }),
    ]));
  });

  test('fails closed when the runtime-evidence top-level contract exposes a comparison field', () => {
    const audit = buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit({
      buildRuntimeEvidenceProjection: () => ({
        version: 'policy.runtime_evidence_projection.v1',
        routeReady: true,
      }),
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.RUNTIME_EVIDENCE_FIELD_OVERLAP,
        path: POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH,
      }),
    ]));
  });

  test('fails closed when the runtime-evidence contract cannot be built', () => {
    const audit = buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit({
      buildRuntimeEvidenceProjection: () => {
        throw new Error('unexpected runtime projection failure');
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.INVALID_RUNTIME_EVIDENCE_PROJECTION,
        path: POLICY_RUNTIME_EVIDENCE_PROJECTION_PATH,
      }),
    ]));
  });

  test('rejects a contract that marks the reducer as promoted to runtime evidence', () => {
    const contract = {
      ...buildPolicyMigrationGeneratedIntentOutcomeResolutionContract(),
      promotedToRuntimeEvidence: true,
    };

    const validation = validatePolicyMigrationGeneratedIntentOutcomeResolutionContract(contract);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.UNSAFE_PROMOTION_FLAG,
      }),
    ]));
  });

  test('rejects a contract with a broken verifier-chain deletion binding', () => {
    const contract = {
      ...buildPolicyMigrationGeneratedIntentOutcomeResolutionContract(),
      verifierChainExitCriterionIds: ['native_migration_parity_proven'],
    };

    const validation = validatePolicyMigrationGeneratedIntentOutcomeResolutionContract(contract);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.BROKEN_DELETION_BINDING,
      }),
    ]));
  });

  test('rejects a contract with an unsupported version', () => {
    const contract = {
      ...buildPolicyMigrationGeneratedIntentOutcomeResolutionContract(),
      version: 'policy.migration_generated_intent_outcome_resolution.v0',
    };

    const validation = validatePolicyMigrationGeneratedIntentOutcomeResolutionContract(contract);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.INVALID_RESOLUTION_VERSION,
      }),
    ]));
  });

  test('fails closed when the reducer source is absent before verifier deletion', () => {
    const audit = buildPolicyMigrationGeneratedIntentOutcomeResolutionAudit({
      exists: () => false,
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_RESOLUTION_RISK_IDS.REDUCER_SOURCE_NOT_FOUND,
        path: POLICY_MIGRATION_GENERATED_INTENT_OUTCOME_PATH,
      }),
    ]));
  });
});
