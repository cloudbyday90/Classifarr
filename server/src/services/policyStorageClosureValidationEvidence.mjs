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
  buildPolicyStorageClosureValidationEvidenceFingerprint,
  validatePolicyStorageClosureValidationEvidenceFingerprint,
} from './policyStorageClosureValidationEvidenceFingerprint.mjs';

const POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_VERSION =
  'policy.storage_closure_validation_evidence.v2';

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
  DUPLICATE_CHECK_ID: 'duplicate_check_id',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  COMMAND_CATALOG_MISMATCH: 'command_catalog_mismatch',
  CHECK_COMMAND_MISMATCH: 'check_command_mismatch',
  UNKNOWN_VERSION: 'unknown_version',
  UNKNOWN_STATUS: 'unknown_status',
  GENERATED_AT_INVALID: 'generated_at_invalid',
  CHECK_COUNT_MISMATCH: 'check_count_mismatch',
  PASSED_COUNT_MISMATCH: 'passed_count_mismatch',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  COMPLETE_FLAG_MISMATCH: 'complete_flag_mismatch',
  ARTIFACT_FINGERPRINT_INVALID: 'artifact_fingerprint_invalid',
});

const MAX_FAILURE_MESSAGE_LENGTH = 512;

const POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS = Object.freeze([
  {
    checkId: POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS.FOCUSED,
    label: 'Focused policy storage closure validation',
    command: 'node',
    args: [
      './scripts/run-jest.mjs',
      '--testPathPatterns=policyActiveIntentIntegrity|policyCandidateAuthorityEligibility|policyNativeIntentAuthority|policyNativeIntentReversion|policyRollbackSnapshotRetention|backupRestoreTables[.]nativePolicyIntent|policyStorageClosureCurrentEvidenceCollector|policyStorageClosureEvidenceRun|policyStorageCompletionCheckpoint|policyStorageCompletionCheckpointArtifact|policyStorageCurrentClosureAudit|policyStorageCurrentClosureAuditIntegrity|policyStorageClosureRequirementAudit|policyCompatibilityRemovalCompletionAudit|policyCompatibilityRemovalCompletionAuditArtifact|policyCompatibilityRemovalCompletionAuditArtifactIntegrity|policyCompatibilityRemovalEvidenceRegeneration|policyStorageClosureReferenceScanner|policyStorageClosureValidationEvidence|policyStorageClosureValidationEvidenceIntegrity|policyStorageClosureValidationEvidenceFingerprint|policyCompatibilityDeletionExecutionPlanArtifact|policyControlledCompatibilityRemovalBatchArtifact|policyControlledRemovalApplyArtifact|policyPostRemovalRuntimeVerificationArtifact|policyPostRemovalRuntimeEvidenceArtifact|policyNextCompatibilityRemovalBatchAuthorization|policyNextCompatibilityRemovalBatchAuthorizationArtifact|policyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity|policyStorageClosureExecutionPlanSource|policyStorageClosurePathStateCollector|policyStorageClosurePathStateEvidence|policyStorageClosurePathStateEvidenceFingerprint|policyStorageClosurePathStateEvidenceIntegrity|policyStorageClosureFinalRemovalAudit|policyStorageFinalClosureReadout|migrations',
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
      'docs/architecture/policy-post-removal-runtime-evidence-integrity.md',
      'docs/architecture/policy-post-removal-runtime-verification-module-cutover.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization-artifact-integrity.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization-artifact-exporter.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization-module-cutover.md',
      'docs/architecture/policy-compatibility-removal-completion-audit.md',
      'docs/architecture/policy-compatibility-removal-completion-audit-artifact-integrity.md',
      'docs/architecture/policy-storage-completion-checkpoint-artifact-integrity.md',
      'docs/architecture/policy-compatibility-removal-completion-audit-artifact-exporter.md',
      'docs/architecture/policy-compatibility-removal-completion-audit-module-cutover.md',
      'docs/architecture/policy-compatibility-removal-evidence-regeneration.md',
      'docs/architecture/policy-storage-completion-checkpoint.md',
      'docs/architecture/policy-storage-completion-checkpoint-artifact-exporter.md',
      'docs/architecture/policy-storage-completion-checkpoint-module-cutover.md',
      'docs/architecture/policy-storage-final-closure-readout.md',
      'docs/architecture/policy-storage-final-closure-readout-module-cutover.md',
      'docs/architecture/policy-storage-current-closure-audit.md',
      'docs/architecture/policy-storage-current-closure-audit-artifact-integrity.md',
      'docs/architecture/policy-storage-current-closure-audit-module-cutover.md',
      'docs/architecture/policy-storage-closure-requirement-audit.md',
      'docs/architecture/policy-storage-closure-requirement-audit-module-cutover.md',
      'docs/architecture/policy-storage-closure-validation-evidence.md',
      'docs/architecture/policy-storage-closure-validation-evidence-artifact-integrity.md',
      'docs/architecture/policy-storage-closure-validation-evidence-module-cutover.md',
      'docs/architecture/policy-storage-closure-final-removal-audit.md',
      'docs/architecture/policy-storage-closure-execution-plan-source.md',
      'docs/architecture/policy-storage-closure-path-state-evidence.md',
      'docs/architecture/policy-storage-closure-final-removal-audit-module-cutover.md',
      'docs/architecture/policy-storage-completion-status-audit.md',
      'docs/architecture/policy-impact-migration-verifier-retirement.md',
      'docs/architecture/policy-replay-migration-verifier-retirement.md',
      'docs/architecture/policy-rollback-snapshot-retention.md',
      'docs/architecture/policy-storage-closure-inventory-sync.md',
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

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  return Object.keys(value)
    .filter(key => !['function', 'symbol', 'undefined'].includes(typeof value[key]))
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = stableValue(value[key]);
      return normalized;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function truncateMessage(value) {
  const message = typeof value === 'string' ? value.trim() : '';

  return message.slice(0, MAX_FAILURE_MESSAGE_LENGTH) || null;
}

function normalizeTimestamp(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isValidTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function normalizeCommandResult(commandResult = {}) {
  const value = asObject(commandResult);

  return {
    checkId: typeof value.checkId === 'string' && value.checkId.trim()
      ? value.checkId.trim()
      : null,
    exitCode: Number.isInteger(value.exitCode) ? value.exitCode : null,
    signal: typeof value.signal === 'string' && value.signal.trim()
      ? value.signal.trim()
      : null,
    durationMs: Number.isFinite(value.durationMs) && value.durationMs >= 0
      ? value.durationMs
      : null,
    startedAt: normalizeTimestamp(value.startedAt),
    finishedAt: normalizeTimestamp(value.finishedAt),
    message: truncateMessage(value.message),
  };
}

function normalizeCommandResults(commandResults = []) {
  return asArray(commandResults)
    .map(normalizeCommandResult)
    .sort((left, right) => (
      `${left.checkId || ''}\u0000${stableStringify(left)}`
        .localeCompare(`${right.checkId || ''}\u0000${stableStringify(right)}`)
    ));
}

function normalizeSideEffects(sideEffects = {}) {
  return Object.keys(asObject(sideEffects))
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = asObject(sideEffects)[key] === true;
      return normalized;
    }, {});
}

function buildValidationCommandCatalog(
  validationCommands = POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS
) {
  return asArray(validationCommands)
    .map(commandSpec => {
      const value = asObject(commandSpec);

      return {
        checkId: typeof value.checkId === 'string' ? value.checkId : null,
        label: typeof value.label === 'string' ? value.label : null,
        command: typeof value.command === 'string' ? value.command : null,
        args: asArray(value.args).map(arg => String(arg)),
        cwd: typeof value.cwd === 'string' ? value.cwd : null,
      };
    })
    .sort((left, right) => String(left.checkId).localeCompare(String(right.checkId)));
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
  const normalizedResult = normalizeCommandResult(commandResult);
  const exitCode = normalizedResult.exitCode;
  const passed = exitCode === 0;
  const message = passed
    ? 'Validation command passed.'
    : normalizedResult.message || `Validation command failed with exit code ${exitCode}.`;

  return {
    command: commandToString(commandSpec),
    passed,
    exitCode,
    signal: normalizedResult.signal,
    durationMs: normalizedResult.durationMs,
    startedAt: normalizedResult.startedAt,
    finishedAt: normalizedResult.finishedAt,
    message,
  };
}

function determineStatusId(risks = []) {
  if (risks.length === 0) {
    return POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.PASSED;
  }

  return risks.some(risk => (
    risk.riskId === POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.MISSING_CHECK_RESULT
  ))
    ? POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.INCOMPLETE
    : POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.FAILED;
}

function buildPolicyStorageClosureValidationEvidence({
  commandResults = [],
  validationCommands = POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS,
  generatedAt = null,
  sideEffects = {},
} = {}) {
  const normalizedCommandResults = normalizeCommandResults(commandResults);
  const normalizedSideEffects = normalizeSideEffects(sideEffects);
  const commandResultsByCheckId = new Map(normalizedCommandResults
    .map(result => [result.checkId, result]));
  const commandSpecsByCheckId = getValidationCommandById(validationCommands);
  const unknownCheckIds = normalizedCommandResults
    .map(result => result.checkId)
    .filter(checkId => checkId && !commandSpecsByCheckId.has(checkId));
  const duplicateCheckIds = normalizedCommandResults
    .map(result => result.checkId)
    .filter(Boolean)
    .filter((checkId, index, checkIds) => checkIds.indexOf(checkId) !== index)
    .filter((checkId, index, checkIds) => checkIds.indexOf(checkId) === index);
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

  duplicateCheckIds.forEach(checkId => {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.DUPLICATE_CHECK_ID,
      'Policy storage closure validation evidence cannot contain duplicate check results.',
      { checkId }
    ));
  });

  Object.entries(normalizedSideEffects).forEach(([key, value]) => {
    if (value === true) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Policy storage closure validation evidence cannot report side effect "${key}".`
      ));
    }
  });

  const statusId = determineStatusId(risks);
  const evidence = {
    version: POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_VERSION,
    generatedAt: normalizeTimestamp(generatedAt) || new Date().toISOString(),
    statusId,
    complete: statusId === POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.PASSED,
    commandCatalog: buildValidationCommandCatalog(validationCommands),
    validationInput: {
      commandResults: normalizedCommandResults,
      sideEffects: normalizedSideEffects,
    },
    ...checks,
    checkCount: asArray(validationCommands).length,
    passedCount: Object.values(checks).filter(check => check.passed).length,
    riskCount: risks.length,
    risks,
    sideEffects: {
      filesWritten: normalizedSideEffects.filesWritten === true,
      storageChanged: normalizedSideEffects.storageChanged === true,
      gitCommandsRun: normalizedSideEffects.gitCommandsRun === true,
    },
  };
  const evidenceWithFingerprint = {
    ...evidence,
    artifactFingerprint: buildPolicyStorageClosureValidationEvidenceFingerprint({ evidence }),
  };

  return {
    ...evidenceWithFingerprint,
    validation: validatePolicyStorageClosureValidationEvidence(evidenceWithFingerprint),
  };
}

function validatePolicyStorageClosureValidationEvidence(evidence = {}) {
  const value = asObject(evidence);
  const issues = [];
  const expectedCatalog = buildValidationCommandCatalog();
  const catalogMatches = stableStringify(value.commandCatalog) === stableStringify(expectedCatalog);
  const expectedChecks = new Map(expectedCatalog.map(commandSpec => [commandSpec.checkId, commandSpec]));
  const checks = Object.values(POLICY_STORAGE_CLOSURE_VALIDATION_CHECK_IDS)
    .map(checkId => value[checkId]);

  if (value.version !== POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_VERSION) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.UNKNOWN_VERSION,
      'Policy storage closure validation evidence version must be recognized.',
      { version: value.version || null }
    ));
  }

  if (!Object.values(POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS)
    .includes(value.statusId)) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.UNKNOWN_STATUS,
      'Policy storage closure validation evidence status must be known.'
    ));
  }

  if (!isValidTimestamp(value.generatedAt)) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.GENERATED_AT_INVALID,
      'Policy storage closure validation evidence must include a valid generated timestamp.',
      { generatedAt: value.generatedAt || null }
    ));
  }

  if (!catalogMatches) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.COMMAND_CATALOG_MISMATCH,
      'Policy storage closure validation evidence must use the current fixed command catalog.'
    ));
  }

  if (value.checkCount !== expectedCatalog.length) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.CHECK_COUNT_MISMATCH,
      'Policy storage closure validation evidence check count must match the fixed command catalog.',
      { expectedCheckCount: expectedCatalog.length, checkCount: value.checkCount ?? null }
    ));
  }

  if (value.passedCount !== checks.filter(check => check?.passed === true).length) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.PASSED_COUNT_MISMATCH,
      'Policy storage closure validation evidence passed count must match its checks.'
    ));
  }

  if (value.riskCount !== asArray(value.risks).length) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.RISK_COUNT_MISMATCH,
      'Policy storage closure validation evidence risk count must match its risks.'
    ));
  }

  if (
    (value.statusId === POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_STATUS_IDS.PASSED) !==
    (value.complete === true)
  ) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.COMPLETE_FLAG_MISMATCH,
      'Policy storage closure validation evidence complete flag must match passed status.'
    ));
  }

  expectedChecks.forEach((commandSpec, checkId) => {
    const check = asObject(value[checkId]);

    if (Object.keys(check).length > 0 && check.command !== commandToString(commandSpec)) {
      issues.push(buildRisk(
        POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.CHECK_COMMAND_MISMATCH,
        'Policy storage closure validation check command must match its fixed catalog entry.',
        { checkId }
      ));
    }
  });

  const fingerprintValidation = validatePolicyStorageClosureValidationEvidenceFingerprint({
    evidence: value,
    artifactFingerprint: value.artifactFingerprint,
  });
  if (!fingerprintValidation.ok) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_RISK_IDS.ARTIFACT_FINGERPRINT_INVALID,
      'Policy storage closure validation evidence fingerprint must bind the complete artifact.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
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
  buildValidationCommandCatalog,
  commandToString,
  validatePolicyStorageClosureValidationEvidence,
};
