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
  POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS,
  POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS,
  POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS,
  POLICY_SERVER_AUTHORITY_TEST_RESET_VERSION,
  buildPolicyServerAuthorityTestReset,
  buildPolicyServerAuthorityTestResetAudit,
  listPolicyServerAuthorityTestResetArtifacts,
  validatePolicyServerAuthorityTestReset,
} from '../../services/policyServerAuthorityTestReset.mjs';

describe('policyServerAuthorityTestReset', () => {
  test('inventories every Phase 5R test artifact with a clean current-state audit', () => {
    const reset = buildPolicyServerAuthorityTestReset();

    expect(reset).toEqual(expect.objectContaining({
      version: POLICY_SERVER_AUTHORITY_TEST_RESET_VERSION,
    }));
    expect(reset.validation.ok).toBe(true);
    expect(reset.validation.issueCount).toBe(0);
    expect(reset.summary.artifactCount).toBeGreaterThanOrEqual(28);
    expect(reset.summary.coveredRequiredCoverageCount).toBe(
      reset.summary.requiredCoverageCount);
    expect(reset.summary.diagnosticShapeFrozen).toBe(false);
    expect(Object.values(reset.sideEffects).every(v => v === false)).toBe(true);
    expect(reset.nextStep.stepId).toBe('native_intent_change_admission');
  });

  test('every artifact exists on disk and imports its declared contract', () => {
    const reset = buildPolicyServerAuthorityTestReset();

    reset.artifactAvailability.forEach(availability => {
      expect(availability.exists).toBe(true);
      expect(availability.withinRepo).toBe(true);
      availability.contractMarkers.forEach(({ found }) => {
        expect(found).toBe(true);
      });
    });
  });

  test('all six required coverage areas are mapped', () => {
    const reset = buildPolicyServerAuthorityTestReset();

    expect(reset.coveragePlan.requiredCoverageIds).toEqual([
      'client_drafts_cannot_bypass_server_validation',
      'ai_output_cannot_become_question_text',
      'stale_questions_cannot_learn',
      'answers_are_idempotent',
      'learning_side_effects_are_allow_listed',
      'retained_preview_replay_side_effect_free',
    ]);
    expect(reset.coveragePlan.missingCoverageIds).toEqual([]);
  });

  test('fails closed when a required coverage area is unmapped', () => {
    const artifacts = listPolicyServerAuthorityTestResetArtifacts()
      .map(artifact => ({
        ...artifact,
        coverageIds: artifact.coverageIds.filter(
          id => id !== POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN,
        ),
      }));

    const reset = buildPolicyServerAuthorityTestReset({ artifacts });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.REQUIRED_COVERAGE_UNMAPPED,
      }),
    ]));
  });

  test('fails closed when an artifact path does not exist on disk', () => {
    const artifacts = listPolicyServerAuthorityTestResetArtifacts();
    artifacts.push({
      path: 'server/src/__tests__/services/nonExistentPhase5Test.test.mjs',
      owner: 'Test',
      decisionId: POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.KEEP_SERVER_CONTRACT_REGRESSION,
      coverageIds: ['client_drafts_cannot_bypass_server_validation'],
      contractIds: ['intent_contract_authority'],
      protectsAuthority: true,
      freezesDiagnosticShape: false,
      deleteAfterDiagnosticRemoval: false,
    });

    const reset = buildPolicyServerAuthorityTestReset({ artifacts });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_FILE_MISSING,
        artifactPath: 'server/src/__tests__/services/nonExistentPhase5Test.test.mjs',
      }),
    ]));
  });

  test('fails closed when an artifact does not import its declared contract marker', () => {
    const artifacts = listPolicyServerAuthorityTestResetArtifacts();
    artifacts[0] = {
      ...artifacts[0],
      contractIds: ['learning_guard'],
    };

    const reset = buildPolicyServerAuthorityTestReset({ artifacts });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_CONTRACT_MARKER_MISSING,
      }),
    ]));
  });

  test('rejects an artifact with an unknown decision ID', () => {
    const artifacts = listPolicyServerAuthorityTestResetArtifacts();
    artifacts[0] = {
      ...artifacts[0],
      decisionId: 'bogus_decision',
    };

    const reset = buildPolicyServerAuthorityTestReset({ artifacts });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_DECISION,
      }),
    ]));
  });

  test('rejects a server-authority artifact that does not set protectsAuthority', () => {
    const artifacts = listPolicyServerAuthorityTestResetArtifacts();
    artifacts[0] = {
      ...artifacts[0],
      protectsAuthority: false,
    };

    const reset = buildPolicyServerAuthorityTestReset({ artifacts });

    expect(reset.validation.ok).toBe(false);
    expect(reset.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.SERVER_AUTHORITY_NOT_PROTECTED,
      }),
    ]));
  });

  test('rejects a reset with an unsupported version', () => {
    const reset = buildPolicyServerAuthorityTestReset();
    const validation = validatePolicyServerAuthorityTestReset({
      ...reset,
      version: 'policy.server_authority_test_reset.v0',
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.VERSION_MISMATCH,
      }),
    ]));
  });

  test('rejects a reset that reports a performed side effect', () => {
    const reset = buildPolicyServerAuthorityTestReset();
    const tampered = {
      ...reset,
      sideEffects: { ...reset.sideEffects, testsDeleted: true },
    };

    const validation = validatePolicyServerAuthorityTestReset(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });

  test('the condensed audit mirrors the full validation outcome', () => {
    const reset = buildPolicyServerAuthorityTestReset();
    const audit = buildPolicyServerAuthorityTestResetAudit(reset);

    expect(audit.ok).toBe(true);
    expect(audit.artifactCount).toBe(reset.summary.artifactCount);
    expect(audit.coveredRequiredCoverageCount).toBe(audit.requiredCoverageCount);
    expect(audit.diagnosticShapeFrozen).toBe(false);
  });
});
