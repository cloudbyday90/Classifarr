import {
  PHASE8R_VALIDATION_CHECK_IDS,
  PHASE8R_VALIDATION_COMMANDS,
  PHASE8R_VALIDATION_EVIDENCE_RISK_IDS,
  PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS,
  buildPolicyBuilderPhase8ValidationEvidence,
  buildValidationCheckEvidence,
  commandToString,
} from '../../services/policyBuilderPhase8ValidationEvidence.mjs';

function commandResults(overrides = {}) {
  return PHASE8R_VALIDATION_COMMANDS.map(commandSpec => ({
    checkId: commandSpec.checkId,
    exitCode: 0,
    signal: null,
    durationMs: 12,
    startedAt: '2026-07-01T00:00:00.000Z',
    finishedAt: '2026-07-01T00:00:01.000Z',
    ...overrides[commandSpec.checkId],
  }));
}

describe('policyBuilderPhase8ValidationEvidence', () => {
  test('defines checkpoint-compatible validation command evidence', () => {
    const evidence = buildPolicyBuilderPhase8ValidationEvidence({
      commandResults: commandResults(),
    });

    expect(evidence.statusId).toBe(PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS.PASSED);
    expect(evidence.complete).toBe(true);
    expect(evidence.checkCount).toBe(PHASE8R_VALIDATION_COMMANDS.length);
    expect(evidence.passedCount).toBe(PHASE8R_VALIDATION_COMMANDS.length);
    expect(evidence.riskCount).toBe(0);
    expect(evidence.focused).toEqual(expect.objectContaining({
      passed: true,
      exitCode: 0,
      command: expect.stringContaining('policyBuilderPhase8CurrentEvidenceCollector'),
    }));
    expect(evidence.focused.command)
      .toContain('policyBuilderPhase8FinalRemovalAuditEvidence');
    expect(evidence.lint.command).toBe('npm run lint');
    expect(evidence.markdown.command).toContain('markdownlint-cli2');
    expect(evidence.markdown.command)
      .toContain('policy-builder-phase-8r-final-removal-audit-exporter.md');
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
      commandSpec: PHASE8R_VALIDATION_COMMANDS[0],
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
    const evidence = buildPolicyBuilderPhase8ValidationEvidence({
      commandResults: commandResults({
        [PHASE8R_VALIDATION_CHECK_IDS.FULL]: {
          exitCode: 1,
          message: 'full suite failed',
        },
      }),
    });

    expect(evidence.statusId).toBe(PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS.FAILED);
    expect(evidence.complete).toBe(false);
    expect(evidence.full).toEqual(expect.objectContaining({
      passed: false,
      exitCode: 1,
      message: 'full suite failed',
    }));
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_VALIDATION_EVIDENCE_RISK_IDS.CHECK_FAILED,
        checkId: PHASE8R_VALIDATION_CHECK_IDS.FULL,
      }),
    ]));
  });

  test('marks evidence incomplete when a configured check result is missing', () => {
    const evidence = buildPolicyBuilderPhase8ValidationEvidence({
      commandResults: commandResults()
        .filter(result => result.checkId !== PHASE8R_VALIDATION_CHECK_IDS.MARKDOWN),
    });

    expect(evidence.statusId).toBe(PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS.INCOMPLETE);
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_VALIDATION_EVIDENCE_RISK_IDS.MISSING_CHECK_RESULT,
        checkId: PHASE8R_VALIDATION_CHECK_IDS.MARKDOWN,
      }),
    ]));
  });

  test('rejects unknown command results and reported side effects', () => {
    const evidence = buildPolicyBuilderPhase8ValidationEvidence({
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

    expect(evidence.statusId).toBe(PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS.FAILED);
    expect(evidence.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_VALIDATION_EVIDENCE_RISK_IDS.UNKNOWN_CHECK_ID,
      PHASE8R_VALIDATION_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
    ]));
  });
});
