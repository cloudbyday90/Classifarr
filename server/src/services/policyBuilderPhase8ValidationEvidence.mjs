const PHASE8R_VALIDATION_EVIDENCE_VERSION =
  'phase8r.validation_evidence.v1';

const PHASE8R_VALIDATION_CHECK_IDS = Object.freeze({
  FOCUSED: 'focused',
  LINT: 'lint',
  MARKDOWN: 'markdown',
  FULL: 'full',
});

const PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS = Object.freeze({
  PASSED: 'passed',
  FAILED: 'failed',
  INCOMPLETE: 'incomplete',
});

const PHASE8R_VALIDATION_EVIDENCE_RISK_IDS = Object.freeze({
  MISSING_CHECK_RESULT: 'missing_check_result',
  CHECK_FAILED: 'check_failed',
  UNKNOWN_CHECK_ID: 'unknown_check_id',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
});

const PHASE8R_VALIDATION_COMMANDS = Object.freeze([
  {
    checkId: PHASE8R_VALIDATION_CHECK_IDS.FOCUSED,
    label: 'Focused Phase 8R validation',
    command: 'node',
    args: [
      './scripts/run-jest.mjs',
      '--testPathPatterns=policyBuilderPhase8CurrentEvidenceCollector|policyBuilderPhase8CompletionEvidenceRun|policyBuilderPhase8CompletionCheckpoint|policyBuilderPhase8CompatibilityRemovalCompletionAudit',
      '--no-coverage',
      '--runInBand',
    ],
    cwd: 'server',
  },
  {
    checkId: PHASE8R_VALIDATION_CHECK_IDS.LINT,
    label: 'Server lint validation',
    command: 'npm',
    args: ['run', 'lint'],
    cwd: 'server',
  },
  {
    checkId: PHASE8R_VALIDATION_CHECK_IDS.MARKDOWN,
    label: 'Phase 8R markdown validation',
    command: 'npx',
    args: [
      'markdownlint-cli2',
      'CHANGELOG.md',
      'docs/architecture/policy-builder-intent-model-roadmap.md',
      'docs/architecture/policy-builder-phase-8r-completion-evidence-run.md',
    ],
    cwd: '.',
  },
  {
    checkId: PHASE8R_VALIDATION_CHECK_IDS.FULL,
    label: 'Full server validation',
    command: 'npm',
    args: ['--prefix', 'server', 'test'],
    cwd: '.',
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function commandToString(commandSpec = {}) {
  return [
    commandSpec.command,
    ...asArray(commandSpec.args),
  ].filter(Boolean).join(' ');
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function getValidationCommandById(
  validationCommands = PHASE8R_VALIDATION_COMMANDS
) {
  return new Map(asArray(validationCommands)
    .map(commandSpec => [commandSpec.checkId, commandSpec]));
}

function buildValidationCheckEvidence({
  commandSpec = {},
  commandResult = {},
} = {}) {
  const exitCode = Number.isInteger(commandResult.exitCode)
    ? commandResult.exitCode
    : null;
  const passed = commandResult.passed === true || exitCode === 0;
  const message = passed
    ? 'Validation command passed.'
    : commandResult.message || `Validation command failed with exit code ${exitCode}.`;

  return {
    command: commandToString(commandSpec),
    passed,
    exitCode,
    signal: commandResult.signal || null,
    durationMs: Number.isFinite(commandResult.durationMs)
      ? commandResult.durationMs
      : null,
    startedAt: commandResult.startedAt || null,
    finishedAt: commandResult.finishedAt || null,
    message,
  };
}

function buildPolicyBuilderPhase8ValidationEvidence({
  commandResults = [],
  validationCommands = PHASE8R_VALIDATION_COMMANDS,
  sideEffects = {},
} = {}) {
  const commandResultsByCheckId = new Map(asArray(commandResults)
    .map(result => [result.checkId, result]));
  const commandSpecsByCheckId = getValidationCommandById(validationCommands);
  const unknownCheckIds = asArray(commandResults)
    .map(result => result.checkId)
    .filter(checkId => checkId && !commandSpecsByCheckId.has(checkId));
  const checks = {};
  const risks = [];

  asArray(validationCommands).forEach(commandSpec => {
    const commandResult = commandResultsByCheckId.get(commandSpec.checkId);

    if (!commandResult) {
      risks.push(buildRisk(
        PHASE8R_VALIDATION_EVIDENCE_RISK_IDS.MISSING_CHECK_RESULT,
        'Phase 8R validation evidence requires every configured check result.',
        { checkId: commandSpec.checkId }
      ));
      return;
    }

    const evidence = buildValidationCheckEvidence({
      commandSpec,
      commandResult,
    });
    checks[commandSpec.checkId] = evidence;

    if (evidence.passed !== true) {
      risks.push(buildRisk(
        PHASE8R_VALIDATION_EVIDENCE_RISK_IDS.CHECK_FAILED,
        'Phase 8R validation command failed.',
        {
          checkId: commandSpec.checkId,
          command: evidence.command,
          exitCode: evidence.exitCode,
          message: evidence.message,
        }
      ));
    }
  });

  unknownCheckIds.forEach(checkId => {
    risks.push(buildRisk(
      PHASE8R_VALIDATION_EVIDENCE_RISK_IDS.UNKNOWN_CHECK_ID,
      'Phase 8R validation evidence received an unknown check result.',
      { checkId }
    ));
  });

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        PHASE8R_VALIDATION_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Phase 8R validation evidence cannot report side effect "${key}".`
      ));
    }
  });

  const statusId = risks.length === 0
    ? PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS.PASSED
    : (
      risks.some(risk => (
        risk.riskId === PHASE8R_VALIDATION_EVIDENCE_RISK_IDS.MISSING_CHECK_RESULT
      ))
        ? PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS.INCOMPLETE
        : PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS.FAILED
    );

  return {
    version: PHASE8R_VALIDATION_EVIDENCE_VERSION,
    statusId,
    complete: statusId === PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS.PASSED,
    ...checks,
    checkCount: asArray(validationCommands).length,
    passedCount: Object.values(checks).filter(check => check.passed).length,
    riskCount: risks.length,
    risks,
    sideEffects: {
      filesWritten: sideEffects.filesWritten === true,
      storageChanged: sideEffects.storageChanged === true,
      gitCommandsRun: sideEffects.gitCommandsRun === true,
    },
  };
}

export {
  PHASE8R_VALIDATION_CHECK_IDS,
  PHASE8R_VALIDATION_COMMANDS,
  PHASE8R_VALIDATION_EVIDENCE_RISK_IDS,
  PHASE8R_VALIDATION_EVIDENCE_STATUS_IDS,
  PHASE8R_VALIDATION_EVIDENCE_VERSION,
  buildPolicyBuilderPhase8ValidationEvidence,
  buildValidationCheckEvidence,
  commandToString,
};
