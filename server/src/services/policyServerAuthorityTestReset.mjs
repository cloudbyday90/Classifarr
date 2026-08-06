/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/* eslint-disable security/detect-non-literal-fs-filename -- The audit recursively reads only the fixed server source root declared below. */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const POLICY_SERVER_AUTHORITY_TEST_RESET_VERSION =
  'policy.server_authority_test_reset.v1';

const POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS = Object.freeze({
  KEEP_SERVER_CONTRACT_REGRESSION: 'keep_server_contract_regression',
  REWRITE_QUESTION_ANSWER_CONTRACT: 'rewrite_question_answer_contract',
  REWRITE_LEARNING_GUARD: 'rewrite_learning_guard',
  REWRITE_PROVIDER_AUTHORITY_MODES: 'rewrite_provider_authority_modes',
  REWRITE_MIGRATION_VERIFIER_ROLE: 'rewrite_migration_verifier_role',
  DELETE_WITH_DIAGNOSTIC_SURFACES: 'delete_with_diagnostic_surfaces',
});

const POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS = Object.freeze({
  CLIENT_DRAFTS_CANNOT_BYPASS_SERVER_VALIDATION: 'client_drafts_cannot_bypass_server_validation',
  AI_OUTPUT_CANNOT_BECOME_QUESTION_TEXT: 'ai_output_cannot_become_question_text',
  STALE_QUESTIONS_CANNOT_LEARN: 'stale_questions_cannot_learn',
  ANSWERS_ARE_IDEMPOTENT: 'answers_are_idempotent',
  LEARNING_SIDE_EFFECTS_ARE_ALLOW_LISTED: 'learning_side_effects_are_allow_listed',
  RETAINED_PREVIEW_REPLAY_SIDE_EFFECT_FREE: 'retained_preview_replay_side_effect_free',
});

const POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS = Object.freeze({
  INTENT_CONTRACT_AUTHORITY: 'intent_contract_authority',
  INTENT_AUTHORITY_CONTRACT: 'intent_authority_contract',
  INTENT_WRITE_ADMISSION: 'intent_write_admission',
  PROPOSAL_LIFECYCLE: 'proposal_lifecycle',
  AI_PROVIDER_AUTHORITY: 'ai_provider_authority',
  AI_OUTPUT_NORMALIZATION: 'ai_output_normalization',
  RUNTIME_QUESTION_NORMALIZER: 'runtime_question_normalizer',
  QUESTION_ANSWER_CONTRACT: 'question_answer_contract',
  LEARNING_GUARD: 'learning_guard',
  LEARNING_INTAKE_CONTRACT: 'learning_intake_contract',
  LEARNING_WRITER_INVENTORY: 'learning_writer_inventory',
  LEARNING_BOUNDARY_REGRESSION: 'learning_boundary_regression',
  RUNTIME_RESOLUTION_LEARNING: 'runtime_resolution_learning',
  EXACT_ITEM_MEMORY_ADMISSION: 'exact_item_memory_admission',
  EXACT_ITEM_MEMORY_COMMAND_SERVICE: 'exact_item_memory_command_service',
  EXACT_ITEM_MEMORY_EXECUTION_STATE: 'exact_item_memory_execution_state',
  DESTINATION_EVIDENCE_ADMISSION: 'destination_evidence_admission',
  DESTINATION_EVIDENCE_COMMAND_SERVICE: 'destination_evidence_command_service',
  DESTINATION_EVIDENCE_EXECUTION_STATE: 'destination_evidence_execution_state',
  PENDING_QUESTION_CLEANUP_PLAN: 'pending_question_cleanup_plan',
  PENDING_QUESTION_CLEANUP_APPLY: 'pending_question_cleanup_apply',
  PENDING_QUESTION_CLEANUP_APPLY_REPOSITORY: 'pending_question_cleanup_apply_repository',
  PREVIEW_REPLAY_VERIFIER_CUTLINE: 'preview_replay_verifier_cutline',
  VERIFIER_DELETION_GATE: 'verifier_deletion_gate',
  GENERATED_INTENT_OUTCOME_RESOLUTION: 'generated_intent_outcome_resolution',
  VERIFICATION_BOUNDARY_AUDIT: 'verification_boundary_audit',
});

const POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_DECISION: 'unknown_decision',
  UNKNOWN_COVERAGE: 'unknown_coverage',
  UNKNOWN_CONTRACT: 'unknown_contract',
  MISSING_ARTIFACT_PATH: 'missing_artifact_path',
  MISSING_OWNER: 'missing_owner',
  MISSING_COVERAGE: 'missing_coverage',
  MISSING_CONTRACT_MARKER: 'missing_contract_marker',
  REQUIRED_COVERAGE_UNMAPPED: 'required_coverage_unmapped',
  SERVER_AUTHORITY_NOT_PROTECTED: 'server_authority_not_protected',
  DIAGNOSTIC_SHAPE_FROZEN: 'diagnostic_shape_frozen',
  ARTIFACT_PATH_OUTSIDE_REPO: 'artifact_path_outside_repo',
  ARTIFACT_FILE_MISSING: 'artifact_file_missing',
  ARTIFACT_CONTRACT_MARKER_MISSING: 'artifact_contract_marker_missing',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  VERSION_MISMATCH: 'version_mismatch',
});

const CONTRACT_IMPORT_MARKERS = Object.freeze({
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.INTENT_CONTRACT_AUTHORITY]: 'policyIntentContract.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.INTENT_AUTHORITY_CONTRACT]: 'policyIntentAuthorityContract.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.INTENT_WRITE_ADMISSION]: 'policyIntentWriteAdmission.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PROPOSAL_LIFECYCLE]: 'policyAuthoringProposalLifecycleService.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.AI_PROVIDER_AUTHORITY]: 'aiProviderAuthority.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.AI_OUTPUT_NORMALIZATION]: 'aiProviderOutputNormalization.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.RUNTIME_QUESTION_NORMALIZER]: 'policyRuntimeQuestionNormalizer.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.QUESTION_ANSWER_CONTRACT]: 'policyRuntimeQuestionAnswerContract.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.LEARNING_GUARD]: 'policyLearningGuard.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.LEARNING_INTAKE_CONTRACT]: 'policyLearningIntakeContract.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.LEARNING_WRITER_INVENTORY]: 'policyLearningWriterInventory.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.LEARNING_BOUNDARY_REGRESSION]: 'policyLearningBoundaryRegression.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.RUNTIME_RESOLUTION_LEARNING]: 'policyRuntimeResolutionLearning.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.EXACT_ITEM_MEMORY_ADMISSION]: 'policyRuntimeExactItemMemoryAdmission.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.EXACT_ITEM_MEMORY_COMMAND_SERVICE]: 'policyRuntimeExactItemMemoryCommandService.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.EXACT_ITEM_MEMORY_EXECUTION_STATE]: 'policyRuntimeExactItemMemoryExecutionState.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.DESTINATION_EVIDENCE_ADMISSION]: 'policyRuntimeDestinationEvidenceAdmission.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.DESTINATION_EVIDENCE_COMMAND_SERVICE]: 'policyRuntimeDestinationEvidenceCommandService.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.DESTINATION_EVIDENCE_EXECUTION_STATE]: 'policyRuntimeDestinationEvidenceExecutionState.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PENDING_QUESTION_CLEANUP_PLAN]: 'policyRuntimePendingQuestionCleanupPlan.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PENDING_QUESTION_CLEANUP_APPLY]: 'policyRuntimePendingQuestionCleanupApplyService.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PENDING_QUESTION_CLEANUP_APPLY_REPOSITORY]: 'policyRuntimePendingQuestionCleanupApplyRepository.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PREVIEW_REPLAY_VERIFIER_CUTLINE]: 'policyPreviewReplayVerifierCutline.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.VERIFIER_DELETION_GATE]: 'policyPreviewReplayVerifierDeletionGate.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.GENERATED_INTENT_OUTCOME_RESOLUTION]: 'policyMigrationGeneratedIntentOutcomeResolution.mjs',
  [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.VERIFICATION_BOUNDARY_AUDIT]: 'policyMigrationVerificationBoundaryAudit.mjs',
});

const REQUIRED_COVERAGE_IDS = Object.freeze([
  POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.CLIENT_DRAFTS_CANNOT_BYPASS_SERVER_VALIDATION,
  POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.AI_OUTPUT_CANNOT_BECOME_QUESTION_TEXT,
  POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN,
  POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.ANSWERS_ARE_IDEMPOTENT,
  POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.LEARNING_SIDE_EFFECTS_ARE_ALLOW_LISTED,
  POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.RETAINED_PREVIEW_REPLAY_SIDE_EFFECT_FREE,
]);

const SERVER_AUTHORITY_DECISION_IDS = Object.freeze([
  POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.KEEP_SERVER_CONTRACT_REGRESSION,
  POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_QUESTION_ANSWER_CONTRACT,
  POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
  POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_PROVIDER_AUTHORITY_MODES,
  POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_MIGRATION_VERIFIER_ROLE,
]);

const DECISION_IDS = Object.freeze(
  Object.values(POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS),
);
const COVERAGE_IDS = Object.freeze(
  Object.values(POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS),
);
const CONTRACT_IDS = Object.freeze(
  Object.values(POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS),
);

function t(path, decisionId, coverageIds, contractIds, owner) {
  return Object.freeze({
    path,
    owner,
    decisionId,
    coverageIds: Object.freeze(coverageIds),
    contractIds: Object.freeze(contractIds),
    protectsAuthority: SERVER_AUTHORITY_DECISION_IDS.includes(decisionId),
    freezesDiagnosticShape: false,
    deleteAfterDiagnosticRemoval: decisionId ===
      POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.DELETE_WITH_DIAGNOSTIC_SURFACES,
  });
}

const DEFAULT_TEST_ARTIFACTS = Object.freeze([
  t('server/src/__tests__/services/policyIntentContract.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.KEEP_SERVER_CONTRACT_REGRESSION,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.CLIENT_DRAFTS_CANNOT_BYPASS_SERVER_VALIDATION],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.INTENT_CONTRACT_AUTHORITY],
    'Server intent projection from legacy presets'),

  t('server/src/__tests__/services/policyIntentAuthorityContract.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.KEEP_SERVER_CONTRACT_REGRESSION,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.CLIENT_DRAFTS_CANNOT_BYPASS_SERVER_VALIDATION],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.INTENT_AUTHORITY_CONTRACT],
    'Native declared intent authority projection'),

  t('server/src/__tests__/services/policyIntentWriteAdmission.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.KEEP_SERVER_CONTRACT_REGRESSION,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.CLIENT_DRAFTS_CANNOT_BYPASS_SERVER_VALIDATION],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.INTENT_WRITE_ADMISSION],
    'Native create write preflight and idempotency'),

  t('server/src/__tests__/services/policyAuthoringProposalLifecycleService.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.KEEP_SERVER_CONTRACT_REGRESSION,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.CLIENT_DRAFTS_CANNOT_BYPASS_SERVER_VALIDATION],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PROPOSAL_LIFECYCLE],
    'Server-owned proposal lifecycle and admission'),

  t('server/src/__tests__/services/aiProviderAuthority.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_PROVIDER_AUTHORITY_MODES,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.AI_OUTPUT_CANNOT_BECOME_QUESTION_TEXT],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.AI_PROVIDER_AUTHORITY],
    'AI provider capability and authority modes'),

  t('server/src/__tests__/services/aiProviderOutputNormalization.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_PROVIDER_AUTHORITY_MODES,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.AI_OUTPUT_CANNOT_BECOME_QUESTION_TEXT],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.AI_OUTPUT_NORMALIZATION],
    'Thinking-block and fence normalization'),

  t('server/src/__tests__/services/aiProviderCapabilityMetrics.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_PROVIDER_AUTHORITY_MODES,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.AI_OUTPUT_CANNOT_BECOME_QUESTION_TEXT],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.AI_PROVIDER_AUTHORITY],
    'Provider capability metric counters'),

  t('server/src/__tests__/services/policyRuntimeQuestionNormalizer.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_QUESTION_ANSWER_CONTRACT,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.AI_OUTPUT_CANNOT_BECOME_QUESTION_TEXT],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.RUNTIME_QUESTION_NORMALIZER],
    'Runtime clarification normalizer'),

  t('server/src/__tests__/services/policyRuntimeQuestionAnswerContract.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_QUESTION_ANSWER_CONTRACT,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.ANSWERS_ARE_IDEMPOTENT],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.QUESTION_ANSWER_CONTRACT],
    'Shared UI/Discord question and answer contract'),

  t('server/src/__tests__/services/policyLearningGuard.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.LEARNING_SIDE_EFFECTS_ARE_ALLOW_LISTED],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.LEARNING_GUARD],
    'Learning guard tier decisions'),

  t('server/src/__tests__/services/policyLearningIntakeContract.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.LEARNING_SIDE_EFFECTS_ARE_ALLOW_LISTED],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.LEARNING_INTAKE_CONTRACT],
    'Canonical learning intake envelope'),

  t('server/src/__tests__/services/policyLearningWriterInventory.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.LEARNING_SIDE_EFFECTS_ARE_ALLOW_LISTED],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.LEARNING_WRITER_INVENTORY],
    'Direct-writer cutover inventory'),

  t('server/src/__tests__/services/policyLearningBoundaryRegression.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [
      POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.LEARNING_SIDE_EFFECTS_ARE_ALLOW_LISTED,
      POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN,
    ],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.LEARNING_GUARD],
    'Learning boundary regression suite'),

  t('server/src/__tests__/services/policyRuntimeResolutionLearning.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.LEARNING_SIDE_EFFECTS_ARE_ALLOW_LISTED],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.RUNTIME_RESOLUTION_LEARNING],
    'Runtime resolution outcome-only admission'),

  t('server/src/__tests__/services/policyRuntimeExactItemMemoryAdmission.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.ANSWERS_ARE_IDEMPOTENT],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.EXACT_ITEM_MEMORY_ADMISSION],
    'Exact-item memory admission'),

  t('server/src/__tests__/services/policyRuntimeExactItemMemoryCommandService.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.ANSWERS_ARE_IDEMPOTENT],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.EXACT_ITEM_MEMORY_COMMAND_SERVICE],
    'Exact-item memory command service'),

  t('server/src/__tests__/services/policyRuntimeExactItemMemoryExecutionState.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.ANSWERS_ARE_IDEMPOTENT],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.EXACT_ITEM_MEMORY_EXECUTION_STATE],
    'Exact-item memory execution state'),

  t('server/src/__tests__/services/policyRuntimeDestinationEvidenceAdmission.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.LEARNING_SIDE_EFFECTS_ARE_ALLOW_LISTED],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.DESTINATION_EVIDENCE_ADMISSION],
    'Destination evidence admission'),

  t('server/src/__tests__/services/policyRuntimeDestinationEvidenceCommandService.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.LEARNING_SIDE_EFFECTS_ARE_ALLOW_LISTED],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.DESTINATION_EVIDENCE_COMMAND_SERVICE],
    'Destination evidence command service'),

  t('server/src/__tests__/services/policyRuntimeDestinationEvidenceExecutionState.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_LEARNING_GUARD,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.LEARNING_SIDE_EFFECTS_ARE_ALLOW_LISTED],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.DESTINATION_EVIDENCE_EXECUTION_STATE],
    'Destination evidence execution state'),

  t('server/src/__tests__/services/policyRuntimePendingQuestionCleanupPlan.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_MIGRATION_VERIFIER_ROLE,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PENDING_QUESTION_CLEANUP_PLAN],
    'Stale question cleanup classification'),

  t('server/src/__tests__/services/policyRuntimePendingQuestionCleanupApplyService.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_MIGRATION_VERIFIER_ROLE,
    [
      POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN,
      POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.ANSWERS_ARE_IDEMPOTENT,
    ],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PENDING_QUESTION_CLEANUP_APPLY],
    'Transactional cleanup apply service'),

  t('server/src/__tests__/services/policyRuntimePendingQuestionCleanupInventoryService.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_MIGRATION_VERIFIER_ROLE,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PENDING_QUESTION_CLEANUP_PLAN],
    'Dry-run cleanup inventory'),

  t('server/src/__tests__/services/policyRuntimePendingQuestionCleanupApplyRepository.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_MIGRATION_VERIFIER_ROLE,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.ANSWERS_ARE_IDEMPOTENT],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PENDING_QUESTION_CLEANUP_APPLY_REPOSITORY],
    'Cleanup apply repository locking'),

  t('server/src/__tests__/services/policyRuntimePendingQuestionCleanupOutcomeReplay.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.REWRITE_MIGRATION_VERIFIER_ROLE,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.ANSWERS_ARE_IDEMPOTENT],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PENDING_QUESTION_CLEANUP_PLAN],
    'Cleanup outcome replay idempotency'),

  t('server/src/__tests__/services/policyPreviewReplayVerifierCutline.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.KEEP_SERVER_CONTRACT_REGRESSION,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.RETAINED_PREVIEW_REPLAY_SIDE_EFFECT_FREE],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.PREVIEW_REPLAY_VERIFIER_CUTLINE],
    'Verifier cutline inventory audit'),

  t('server/src/__tests__/services/policyPreviewReplayVerifierDeletionGate.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.KEEP_SERVER_CONTRACT_REGRESSION,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.RETAINED_PREVIEW_REPLAY_SIDE_EFFECT_FREE],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.VERIFIER_DELETION_GATE],
    'Final verifier deletion gate evaluation'),

  t('server/src/__tests__/services/policyMigrationGeneratedIntentOutcomeResolution.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.KEEP_SERVER_CONTRACT_REGRESSION,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.RETAINED_PREVIEW_REPLAY_SIDE_EFFECT_FREE],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.GENERATED_INTENT_OUTCOME_RESOLUTION],
    'Evidence reducer resolution audit'),

  t('server/src/__tests__/services/policyMigrationVerificationBoundaryAudit.test.mjs',
    POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS.KEEP_SERVER_CONTRACT_REGRESSION,
    [POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS.RETAINED_PREVIEW_REPLAY_SIDE_EFFECT_FREE],
    [POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS.VERIFICATION_BOUNDARY_AUDIT],
    'Migration verification boundary topology'),
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildIssue(riskId, message, artifactPath = null) {
  return {
    riskId,
    message,
    ...(artifactPath ? { artifactPath } : {}),
  };
}

function listPolicyServerAuthorityTestResetArtifacts() {
  return DEFAULT_TEST_ARTIFACTS.map(artifact => ({ ...artifact }));
}

function resolveWithinRepo(path) {
  const normalized = normalizeString(path);
  if (!normalized) return false;
  const resolved = resolve(REPO_ROOT, normalized);
  const relativePath = relative(REPO_ROOT, resolved);
  return !relativePath.startsWith('..') && !normalizeString(relativePath).includes('\\..');
}

function artifactExists(path) {
  return existsSync(resolve(REPO_ROOT, path));
}

function readArtifactSource(path) {
  try {
    return readFileSync(resolve(REPO_ROOT, path), 'utf8');
  } catch {
    return null;
  }
}

function verifyContractMarker(source, contractId) {
  const marker = CONTRACT_IMPORT_MARKERS[contractId];
  if (!marker) return false;
  return source.includes(marker);
}

function buildPolicyServerAuthorityTestReset({
  artifacts = listPolicyServerAuthorityTestResetArtifacts(),
} = {}) {
  const normalizedArtifacts = asArray(artifacts);
  const issues = [];
  const decisionCounts = {};
  const coveredCoverageIds = new Set();
  const coveredContractIds = new Set();

  const artifactAvailability = normalizedArtifacts.map(artifact => {
    const path = normalizeString(artifact.path);
    const decisionId = normalizeString(artifact.decisionId);
    const artifactCoverageIds = asArray(artifact.coverageIds).map(normalizeString);
    const artifactContractIds = asArray(artifact.contractIds).map(normalizeString);
    const owner = normalizeString(artifact.owner);

    if (!path) {
      issues.push(buildIssue(
        POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.MISSING_ARTIFACT_PATH,
        'Every test reset artifact must declare a repository-relative path.',
      ));
    }

    if (!owner) {
      issues.push(buildIssue(
        POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.MISSING_OWNER,
        'Every test reset artifact must declare an owner description.',
        path,
      ));
    }

    if (!DECISION_IDS.includes(decisionId)) {
      issues.push(buildIssue(
        POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_DECISION,
        `Artifact must use a supported decision ID (got "${decisionId}").`,
        path,
      ));
    } else {
      decisionCounts[decisionId] = (decisionCounts[decisionId] || 0) + 1;
    }

    artifactCoverageIds.forEach(coverageId => {
      if (!COVERAGE_IDS.includes(coverageId)) {
        issues.push(buildIssue(
          POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_COVERAGE,
          `Artifact must use a supported coverage ID (got "${coverageId}").`,
          path,
        ));
      } else {
        coveredCoverageIds.add(coverageId);
      }
    });

    const contractMarkers = [];
    artifactContractIds.forEach(contractId => {
      if (!CONTRACT_IDS.includes(contractId)) {
        issues.push(buildIssue(
          POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_CONTRACT,
          `Artifact must use a supported contract ID (got "${contractId}").`,
          path,
        ));
        return;
      }

      coveredContractIds.add(contractId);

      const marker = CONTRACT_IMPORT_MARKERS[contractId];
      if (marker) {
        contractMarkers.push({ contractId, marker });
      }
    });

    if (artifactCoverageIds.length === 0) {
      issues.push(buildIssue(
        POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.MISSING_COVERAGE,
        'Every test reset artifact must map to at least one coverage area.',
        path,
      ));
    }

    if (artifactContractIds.length === 0) {
      issues.push(buildIssue(
        POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.MISSING_CONTRACT_MARKER,
        'Every test reset artifact must declare at least one contract it protects.',
        path,
      ));
    }

    if (SERVER_AUTHORITY_DECISION_IDS.includes(decisionId) &&
        artifact.protectsAuthority !== true) {
      issues.push(buildIssue(
        POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.SERVER_AUTHORITY_NOT_PROTECTED,
        'Server-authority tests must set protectsAuthority to true.',
        path,
      ));
    }

    if (artifact.freezesDiagnosticShape === true) {
      issues.push(buildIssue(
        POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.DIAGNOSTIC_SHAPE_FROZEN,
        'Tests must not freeze old diagnostic response shapes unless they remain migration verifier contracts.',
        path,
      ));
    }

    const withinRepo = path && resolveWithinRepo(path);
    if (path && !withinRepo) {
      issues.push(buildIssue(
        POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_PATH_OUTSIDE_REPO,
        'Artifact path must resolve inside the repository.',
        path,
      ));
    }

    const exists = path && withinRepo && artifactExists(path);
    if (path && withinRepo && !exists) {
      issues.push(buildIssue(
        POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_FILE_MISSING,
        'Artifact test file must exist on disk.',
        path,
      ));
    }

    let verifiedContractMarkers = [];
    if (exists) {
      const source = readArtifactSource(path);
      if (source !== null) {
        verifiedContractMarkers = contractMarkers.map(({ contractId, marker }) => {
          const found = verifyContractMarker(source, contractId);
          if (!found) {
            issues.push(buildIssue(
              POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_CONTRACT_MARKER_MISSING,
              `Test must statically import the declared contract marker for ${contractId}.`,
              path,
            ));
          }
          return { contractId, marker, found };
        });
      }
    }

    return {
      path,
      decisionId,
      coverageIds: artifactCoverageIds,
      contractIds: artifactContractIds,
      exists: Boolean(exists),
      withinRepo: Boolean(withinRepo),
      contractMarkers: verifiedContractMarkers,
    };
  });

  const missingCoverageIds = REQUIRED_COVERAGE_IDS.filter(
    id => !coveredCoverageIds.has(id),
  );
  missingCoverageIds.forEach(coverageId => {
    issues.push(buildIssue(
      POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.REQUIRED_COVERAGE_UNMAPPED,
      `Required coverage area "${coverageId}" must be mapped by at least one test artifact.`,
    ));
  });

  const reset = {
    version: POLICY_SERVER_AUTHORITY_TEST_RESET_VERSION,
    artifacts: normalizedArtifacts,
    artifactAvailability,
    coveragePlan: {
      requiredCoverageIds: REQUIRED_COVERAGE_IDS,
      coveredCoverageIds: [...coveredCoverageIds].sort(),
      missingCoverageIds,
    },
    contractCoveragePlan: {
      requiredContractIds: CONTRACT_IDS,
      coveredContractIds: [...coveredContractIds].sort(),
    },
    summary: {
      artifactCount: normalizedArtifacts.length,
      decisionCounts,
      requiredCoverageCount: REQUIRED_COVERAGE_IDS.length,
      coveredRequiredCoverageCount: REQUIRED_COVERAGE_IDS.length - missingCoverageIds.length,
      requiredContractCount: CONTRACT_IDS.length,
      coveredRequiredContractCount: coveredContractIds.size,
      diagnosticShapeFrozen: normalizedArtifacts.some(a => a.freezesDiagnosticShape === true),
    },
    sideEffects: {
      testsDeleted: false,
      testsRewritten: false,
      workflowModified: false,
    },
    nextStep: {
      stepId: 'native_intent_change_admission',
      label: 'Native Intent Change Admission',
    },
  };

  reset.validation = validatePolicyServerAuthorityTestReset(reset);
  issues.forEach(issue => {
    if (!reset.validation.issues.some(existing =>
      existing.riskId === issue.riskId && existing.artifactPath === issue.artifactPath)) {
      reset.validation.issues.push(issue);
    }
  });
  reset.validation.issueCount = reset.validation.issues.length;
  reset.validation.ok = reset.validation.issues.length === 0;

  return reset;
}

function validatePolicyServerAuthorityTestReset(reset) {
  const normalized = reset && typeof reset === 'object' ? reset : {};
  const issues = [];

  if (normalizeString(normalized.version) !== POLICY_SERVER_AUTHORITY_TEST_RESET_VERSION) {
    issues.push(buildIssue(
      POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.VERSION_MISMATCH,
      'Server authority test reset must use the supported version.',
    ));
  }

  const sideEffects = normalized.sideEffects && typeof normalized.sideEffects === 'object'
    ? normalized.sideEffects : {};
  Object.entries(sideEffects).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildIssue(
        POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Server authority test reset cannot perform side effect "${key}".`,
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyServerAuthorityTestResetAudit(reset) {
  const validation = reset?.validation ||
    validatePolicyServerAuthorityTestReset(reset);

  return {
    version: POLICY_SERVER_AUTHORITY_TEST_RESET_VERSION,
    ok: validation.ok,
    issueCount: validation.issueCount,
    artifactCount: reset?.summary?.artifactCount ?? 0,
    requiredCoverageCount: reset?.summary?.requiredCoverageCount ?? REQUIRED_COVERAGE_IDS.length,
    coveredRequiredCoverageCount: reset?.summary?.coveredRequiredCoverageCount ?? 0,
    requiredContractCount: reset?.summary?.requiredContractCount ?? CONTRACT_IDS.length,
    coveredRequiredContractCount: reset?.summary?.coveredRequiredContractCount ?? 0,
    diagnosticShapeFrozen: reset?.summary?.diagnosticShapeFrozen ?? false,
    validation,
    nextStep: reset?.nextStep ?? {
      stepId: 'native_intent_change_admission',
      label: 'Native Intent Change Admission',
    },
  };
}

export {
  POLICY_SERVER_AUTHORITY_TEST_CONTRACT_IDS,
  POLICY_SERVER_AUTHORITY_TEST_COVERAGE_IDS,
  POLICY_SERVER_AUTHORITY_TEST_DECISION_IDS,
  POLICY_SERVER_AUTHORITY_TEST_RESET_AUDIT_RISK_IDS,
  POLICY_SERVER_AUTHORITY_TEST_RESET_VERSION,
  buildPolicyServerAuthorityTestReset,
  buildPolicyServerAuthorityTestResetAudit,
  listPolicyServerAuthorityTestResetArtifacts,
  validatePolicyServerAuthorityTestReset,
};
