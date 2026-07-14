import {
  POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS,
  POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS,
  POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS,
  POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS,
  buildPolicyStorageClosureValidationEvidence,
  buildValidationCheckEvidence,
  commandToString,
} from '../../services/policyStorageClosureValidationEvidence.mjs';

function commandResults(overrides = {}) {
  return POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS.map(commandSpec => ({
    checkId: commandSpec.checkId,
    exitCode: 0,
    signal: null,
    durationMs: 12,
    startedAt: '2026-07-01T00:00:00.000Z',
    finishedAt: '2026-07-01T00:00:01.000Z',
    ...overrides[commandSpec.checkId],
  }));
}

describe('policyStorageClosureValidationEvidence', () => {
  test('defines checkpoint-compatible validation command evidence', () => {
    const evidence = buildPolicyStorageClosureValidationEvidence({
      commandResults: commandResults(),
    });

    expect(evidence.statusId).toBe(POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.PASSED);
    expect(evidence.complete).toBe(true);
    expect(evidence.checkCount).toBe(POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS.length);
    expect(evidence.passedCount).toBe(POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS.length);
    expect(evidence.riskCount).toBe(0);
    expect(evidence.focused).toEqual(expect.objectContaining({
      passed: true,
      exitCode: 0,
      command: expect.stringContaining('policyStorageClosureCurrentEvidenceCollector'),
    }));
    expect(evidence.focused.command)
      .toContain('policyStorageClosureFinalRemovalAudit');
    expect(evidence.focused.command)
      .toContain('policyCompatibilityDeletionExecutionPlanArtifact');
    expect(evidence.focused.command)
      .toContain('policyControlledCompatibilityRemovalBatchArtifact');
    expect(evidence.focused.command).toContain('policyActiveIntentIntegrity');
    expect(evidence.focused.command).toContain('policyCandidateAuthorityEligibility');
    expect(evidence.focused.command).toContain('policyNativeIntentAuthority');
    expect(evidence.focused.command).toContain('policyNativeIntentReversion');
    expect(evidence.focused.command).toContain('policyRollbackSnapshotRetention');
    expect(evidence.focused.command).toContain('backupRestoreTables[.]nativePolicyIntent');
    expect(evidence.lint.command).toBe('npm run lint');
    expect(evidence.markdown.command).toContain('markdownlint-cli2');
    expect(evidence.markdown.command)
      .toContain('policy-storage-closure-evidence-run-module-cutover.md');
    expect(evidence.markdown.command)
      .toContain('policy-storage-closure-final-removal-audit.md');
    expect(evidence.markdown.command)
      .toContain('policy-storage-closure-final-removal-audit-module-cutover.md');
    expect(evidence.markdown.command)
      .toContain('policy-storage-completion-status-audit.md');
    expect(evidence.markdown.command)
      .toContain('policy-compatibility-deletion-execution-plan-artifact.md');
    expect(evidence.markdown.command)
      .toContain('policy-compatibility-deletion-execution-plan-artifact-module-cutover.md');
    expect(evidence.markdown.command)
      .toContain('policy-controlled-compatibility-removal-batch-artifact.md');
    expect(evidence.markdown.command)
      .toContain('policy-controlled-compatibility-removal-batch-artifact-module-cutover.md');
    expect(evidence.markdown.command)
      .toContain('policy-storage-closure-validation-evidence-module-cutover.md');
    expect(evidence.markdown.command)
      .toContain('policy-replay-migration-verifier-retirement.md');
    expect(evidence.markdown.command)
      .toContain('policy-impact-migration-verifier-retirement.md');
    expect(evidence.markdown.command)
      .toContain('policy-rollback-snapshot-retention.md');
    expect(evidence.full.command).toBe('npm --prefix server test');
  });

  test('formats command strings from command specs', () => {
    expect(commandToString({
      command: 'node',
      args: ['script.mjs', '--flag'],
    })).toBe('node script.mjs --flag');
  });

  test('builds failed check evidence with bounded failure metadata', () => {
    const evidence = buildValidationCheckEvidence({
      commandSpec: POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS[0],
      commandResult: {
        exitCode: 1,
        signal: null,
        durationMs: 50,
        message: 'focused failed',
      },
    });

    expect(evidence).toEqual(expect.objectContaining({
      passed: false,
      exitCode: 1,
      durationMs: 50,
      message: 'focused failed',
    }));
  });

  test('fails when any configured validation command fails', () => {
    const evidence = buildPolicyStorageClosureValidationEvidence({
      commandResults: commandResults({
        [POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS.FULL]: {
          exitCode: 1,
          message: 'full suite failed',
        },
      }),
    });

    expect(evidence.statusId).toBe(POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.FAILED);
    expect(evidence.complete).toBe(false);
    expect(evidence.full).toEqual(expect.objectContaining({
      passed: false,
      exitCode: 1,
      message: 'full suite failed',
    }));
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.CHECK_FAILED,
        checkId: POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS.FULL,
      }),
    ]));
  });

  test('marks evidence incomplete when a configured check result is missing', () => {
    const evidence = buildPolicyStorageClosureValidationEvidence({
      commandResults: commandResults()
        .filter(result => result.checkId !== POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS.MARKDOWN),
    });

    expect(evidence.statusId).toBe(POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.INCOMPLETE);
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.MISSING_CHECK_RESULT,
        checkId: POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS.MARKDOWN,
      }),
    ]));
  });

  test('rejects unknown command results and reported side effects', () => {
    const evidence = buildPolicyStorageClosureValidationEvidence({
      commandResults: [
        ...commandResults(),
        {
          checkId: 'unexpected',
          exitCode: 0,
        },
      ],
      sideEffects: {
        filesWritten: true,
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(evidence.statusId).toBe(POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.FAILED);
    expect(evidence.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.UNKNOWN_CHECK_ID,
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
    ]));
  });
});
