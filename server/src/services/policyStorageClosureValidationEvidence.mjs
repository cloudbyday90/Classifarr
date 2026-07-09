const POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_VERSION =
  'policy.storage_closure_validation_evidence.v1';

const POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS = Object.freeze({
  FOCUSED: 'focused',
  LINT: 'lint',
  MARKDOWN: 'markdown',
  FULL: 'full',
});

const POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS = Object.freeze({
  PASSED: 'passed',
  FAILED: 'failed',
  INCOMPLETE: 'incomplete',
});

const POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS = Object.freeze({
  MISSING_CHECK_RESULT: 'missing_check_result',
  CHECK_FAILED: 'check_failed',
  UNKNOWN_CHECK_ID: 'unknown_check_id',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
});

const POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS = Object.freeze([
  {
    checkId: POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS.FOCUSED,
    label: 'Focused policy storage closure validation',
    command: 'node',
    args: [
      './scripts/run-jest.mjs',
      '--testPathPatterns=policyStorageClosureCurrentEvidenceCollector|policyStorageClosureEvidenceRun|policyStorageCompletionCheckpoint|policyStorageCompletionCheckpointArtifact|policyStorageCurrentClosureAudit|policyStorageClosureRequirementAudit|policyCompatibilityRemovalCompletionAudit|policyCompatibilityRemovalCompletionAuditArtifact|policyStorageClosureValidationEvidence|policyCompatibilityDeletionExecutionPlanArtifact|policyControlledCompatibilityRemovalBatchArtifact|policyControlledRemovalApplyArtifact|policyPostRemovalRuntimeVerificationArtifact|policyNextCompatibilityRemovalBatchAuthorizationArtifact|policyStorageClosureFinalRemovalAudit|policyStorageFinalClosureReadout|policyImpactPreviewMigrationVerifier|policyReplayPreviewMigrationVerifier',
      '--no-coverage',
      '--runInBand',
    ],
    cwd: 'server',
  },
  {
    checkId: POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS.LINT,
    label: 'Server lint validation',
    command: 'npm',
    args: ['run', 'lint'],
    cwd: 'server',
  },
  {
    checkId: POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS.MARKDOWN,
    label: 'Policy storage closure markdown validation',
    command: 'npx',
    args: [
      'markdownlint-cli2',
      'CHANGELOG.md',
      'docs/architecture/policy-builder-intent-model-roadmap.md',
      'docs/architecture/policy-storage-closure-evidence-run.md',
      'docs/architecture/policy-storage-closure-evidence-run-module-cutover.md',
      'docs/architecture/policy-compatibility-deletion-execution-plan-artifact.md',
      'docs/architecture/policy-compatibility-deletion-execution-plan-artifact-module-cutover.md',
      'docs/architecture/policy-controlled-compatibility-removal-batch-artifact.md',
      'docs/architecture/policy-controlled-compatibility-removal-batch-artifact-module-cutover.md',
      'docs/architecture/policy-controlled-removal-apply-artifact-exporter.md',
      'docs/architecture/policy-controlled-removal-apply-artifact-module-cutover.md',
      'docs/architecture/policy-post-removal-runtime-verification.md',
      'docs/architecture/policy-post-removal-runtime-verification-artifact-exporter.md',
      'docs/architecture/policy-post-removal-runtime-verification-module-cutover.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization-artifact-exporter.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization-module-cutover.md',
      'docs/architecture/policy-compatibility-removal-completion-audit.md',
      'docs/architecture/policy-compatibility-removal-completion-audit-artifact-exporter.md',
      'docs/architecture/policy-compatibility-removal-completion-audit-module-cutover.md',
      'docs/architecture/policy-storage-completion-checkpoint.md',
      'docs/architecture/policy-storage-completion-checkpoint-artifact-exporter.md',
      'docs/architecture/policy-storage-completion-checkpoint-module-cutover.md',
      'docs/architecture/policy-storage-final-closure-readout.md',
      'docs/architecture/policy-storage-final-closure-readout-module-cutover.md',
      'docs/architecture/policy-storage-current-closure-audit.md',
      'docs/architecture/policy-storage-current-closure-audit-module-cutover.md',
      'docs/architecture/policy-storage-closure-requirement-audit.md',
      'docs/architecture/policy-storage-closure-requirement-audit-module-cutover.md',
      'docs/architecture/policy-storage-closure-validation-evidence.md',
      'docs/architecture/policy-storage-closure-validation-evidence-module-cutover.md',
      'docs/architecture/policy-storage-closure-final-removal-audit.md',
      'docs/architecture/policy-storage-closure-final-removal-audit-module-cutover.md',
      'docs/architecture/policy-impact-preview-migration-verifier.md',
      'docs/architecture/policy-impact-preview-migration-verifier-module-cutover.md',
      'docs/architecture/policy-replay-preview-migration-verifier.md',
      'docs/architecture/policy-replay-preview-migration-verifier-module-cutover.md',
      'docs/architecture/policy-builder-phase-8r-closure-inventory-sync.md',
    ],
    cwd: '.',
  },
  {
    checkId: POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS.FULL,
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
  validationCommands = POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS
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

function buildPolicyStorageClosureValidationEvidence({
  commandResults = [],
  validationCommands = POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS,
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
        POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.MISSING_CHECK_RESULT,
        'Policy storage closure validation evidence requires every configured check result.',
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
        POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.CHECK_FAILED,
        'Policy storage closure validation command failed.',
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
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.UNKNOWN_CHECK_ID,
      'Policy storage closure validation evidence received an unknown check result.',
      { checkId }
    ));
  });

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Policy storage closure validation evidence cannot report side effect "${key}".`
      ));
    }
  });

  const statusId = risks.length === 0
    ? POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.PASSED
    : (
      risks.some(risk => (
        risk.riskId === POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.MISSING_CHECK_RESULT
      ))
        ? POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.INCOMPLETE
        : POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.FAILED
    );

  return {
    version: POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_VERSION,
    statusId,
    complete: statusId === POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.PASSED,
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
  POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS,
  POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS,
  POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS,
  POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS,
  POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_VERSION,
  buildPolicyStorageClosureValidationEvidence,
  buildValidationCheckEvidence,
  commandToString,
};
