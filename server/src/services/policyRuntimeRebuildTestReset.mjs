import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const POLICY_RUNTIME_TEST_RESET_DECISION_IDS = Object.freeze({
  KEEP_CLASSIFICATION_REGRESSION: 'keep_classification_regression',
  REWRITE_EVIDENCE_PROJECTION: 'rewrite_evidence_projection',
  REWRITE_AUTOMATION_DECISION: 'rewrite_automation_decision',
  REWRITE_QUESTION_CONTRACT: 'rewrite_question_contract',
  REWRITE_LEARNING_GUARD: 'rewrite_learning_guard',
  REWRITE_REBUILD_VERIFIER: 'rewrite_rebuild_verifier',
  REWRITE_RUNTIME_METRICS: 'rewrite_runtime_metrics',
  DELETE_ABANDONED_DIAGNOSTIC: 'delete_abandoned_diagnostic',
});

const POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS = Object.freeze({
  BROAD_GENRE_NO_SPECIALIZED_AUTO_ROUTE: 'broad_genre_no_specialized_auto_route',
  MISSING_ROUTING_CLASSIFIED_NOT_ROUTED: 'missing_routing_classified_not_routed',
  STALE_QUESTIONS_CANNOT_LEARN: 'stale_questions_cannot_learn',
  REQUEST_CHOICES_REQUIRE_GUARD: 'request_choices_require_guard',
  REBUILD_PRESERVES_EXPLICIT_CONSTRAINTS: 'rebuild_preserves_explicit_constraints',
  ROLLBACK_REQUIRED_BEFORE_REPLACEMENT: 'rollback_required_before_replacement',
  RUNTIME_METRICS_SUPPRESS_DIAGNOSTICS: 'runtime_metrics_suppress_diagnostics',
  CLASSIFICATION_REGRESSION_REMAINS: 'classification_regression_remains',
});

const POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS = Object.freeze({
  RUNTIME_EVIDENCE_PROJECTION: 'runtime_evidence_projection',
  AUTOMATION_DECISION: 'automation_decision',
  RUNTIME_QUESTION_REDUCTION: 'runtime_question_reduction',
  REQUEST_TIME_LEARNING: 'request_time_learning',
  GUARDED_OUTCOME_PROJECTION: 'guarded_outcome_projection',
  LIBRARY_POLICY_REBUILD: 'library_policy_rebuild',
  LIBRARY_REBUILD_ACCEPTANCE_TRANSITION: 'library_rebuild_acceptance_transition',
  MIGRATION_VERIFIER: 'migration_verifier',
  LIBRARY_REBUILD_SNAPSHOT_GATE: 'library_rebuild_snapshot_gate',
  LIBRARY_REBUILD_REPLACEMENT_GATE: 'library_rebuild_replacement_gate',
  STRICT_CONSTRAINT_DESCRIPTORS: 'strict_constraint_descriptors',
  RUNTIME_METRICS_INPUT: 'runtime_metrics_input',
  RUNTIME_METRICS_TRACE: 'runtime_metrics_trace',
});

const POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_DECISION: 'unknown_decision',
  UNKNOWN_COVERAGE: 'unknown_coverage',
  MISSING_ARTIFACT_PATH: 'missing_artifact_path',
  MISSING_ARTIFACT_OWNER: 'missing_artifact_owner',
  MISSING_REPLACEMENT: 'missing_replacement',
  MISSING_COVERAGE: 'missing_coverage',
  REQUIRED_COVERAGE_UNMAPPED: 'required_coverage_unmapped',
  SERVER_AUTHORITY_NOT_PROTECTED: 'server_authority_not_protected',
  CLASSIFICATION_ROUTING_NOT_DISTINGUISHED: 'classification_routing_not_distinguished',
  OLD_PREVIEW_UI_FROZEN: 'old_preview_ui_frozen',
  DELETE_TARGET_STILL_NORMAL_WORKFLOW: 'delete_target_still_normal_workflow',
  DELETE_TARGET_WITHOUT_REPLACEMENT: 'delete_target_without_replacement',
  MISSING_TRACE_REASON: 'missing_trace_reason',
  ARTIFACT_PATH_OUTSIDE_REPO: 'artifact_path_outside_repo',
  ARTIFACT_FILE_MISSING: 'artifact_file_missing',
  UNKNOWN_CONTRACT: 'unknown_contract',
  REQUIRED_CONTRACT_UNMAPPED: 'required_contract_unmapped',
  ARTIFACT_CONTRACT_MARKER_MISSING: 'artifact_contract_marker_missing',
});

const RESET_CONTRACT_VERSION = 'policy.runtime_rebuild_test_reset.v1';
const DEFAULT_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const REQUIRED_COVERAGE_IDS = Object.freeze([
  POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.BROAD_GENRE_NO_SPECIALIZED_AUTO_ROUTE,
  POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED,
  POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN,
  POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD,
  POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.REBUILD_PRESERVES_EXPLICIT_CONSTRAINTS,
  POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.ROLLBACK_REQUIRED_BEFORE_REPLACEMENT,
]);

const DECISION_IDS = Object.freeze(Object.values(POLICY_RUNTIME_TEST_RESET_DECISION_IDS));
const COVERAGE_IDS = Object.freeze(Object.values(POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS));
const CONTRACT_IDS = Object.freeze(Object.values(POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS));
const REQUIRED_CONTRACT_IDS = Object.freeze([
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_EVIDENCE_PROJECTION,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.AUTOMATION_DECISION,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_QUESTION_REDUCTION,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.REQUEST_TIME_LEARNING,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.GUARDED_OUTCOME_PROJECTION,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_POLICY_REBUILD,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_REBUILD_ACCEPTANCE_TRANSITION,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.MIGRATION_VERIFIER,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_REBUILD_SNAPSHOT_GATE,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_REBUILD_REPLACEMENT_GATE,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.STRICT_CONSTRAINT_DESCRIPTORS,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_METRICS_INPUT,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_METRICS_TRACE,
]);
const CONTRACT_IMPORT_MARKERS = Object.freeze({
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_EVIDENCE_PROJECTION]:
    '../../services/policyRuntimeEvidenceProjection.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.AUTOMATION_DECISION]:
    '../../services/policyAutomationDecisionContract.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_QUESTION_REDUCTION]:
    '../../services/policyRuntimeQuestionReduction.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.REQUEST_TIME_LEARNING]:
    '../../services/policyRequestTimeLearning.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.GUARDED_OUTCOME_PROJECTION]:
    '../../services/policyGuardedOutcomeProjection.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_POLICY_REBUILD]:
    '../../services/policyLibraryPolicyRebuild.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_REBUILD_ACCEPTANCE_TRANSITION]:
    '../../services/policyLibraryRebuildAcceptanceTransition.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.MIGRATION_VERIFIER]:
    '../../services/policyMigrationVerifierRollback.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_REBUILD_SNAPSHOT_GATE]:
    '../../services/policyLibraryRebuildSnapshotGate.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_REBUILD_REPLACEMENT_GATE]:
    '../../services/policyLibraryRebuildReplacementGate.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.STRICT_CONSTRAINT_DESCRIPTORS]:
    '../../services/policyStrictConstraintDescriptor.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_METRICS_INPUT]:
    '../../services/policyRuntimeMetricsInput.mjs',
  [POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_METRICS_TRACE]:
    '../../services/policyRuntimeMetricsTrace.mjs',
});
const SERVER_AUTHORITY_DECISION_IDS = Object.freeze([
  POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_EVIDENCE_PROJECTION,
  POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_AUTOMATION_DECISION,
  POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_QUESTION_CONTRACT,
  POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_LEARNING_GUARD,
  POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER,
  POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_RUNTIME_METRICS,
]);

const CLASSIFICATION_ROUTING_COVERAGE_IDS = Object.freeze([
  POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED,
]);

const DEFAULT_TEST_RESET_ARTIFACTS = Object.freeze([
  Object.freeze({
    path: 'server/src/__tests__/classification-routing.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.KEEP_CLASSIFICATION_REGRESSION,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.CLASSIFICATION_REGRESSION_REMAINS,
    ],
    contractIds: [],
    replacement: 'Keep as existing classification/routing regression coverage while runtime contracts protect new authority boundaries.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['classification_regression_kept'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyRuntimeEvidenceProjection.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_EVIDENCE_PROJECTION,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.BROAD_GENRE_NO_SPECIALIZED_AUTO_ROUTE,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_EVIDENCE_PROJECTION,
    ],
    replacement: 'Use runtime evidence projection to demote broad genre overlap until identity evidence exists.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['evidence_projection_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyAutomationDecisionContract.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_AUTOMATION_DECISION,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.BROAD_GENRE_NO_SPECIALIZED_AUTO_ROUTE,
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.AUTOMATION_DECISION,
    ],
    replacement: 'Use automation decision states to separate classification success from routing success.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['automation_contract_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyRuntimeQuestionReduction.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_QUESTION_CONTRACT,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_QUESTION_REDUCTION,
    ],
    replacement: 'Use runtime question reduction to clean stale or legacy questions and prevent unguarded learning.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['question_contract_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyRequestTimeLearning.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_LEARNING_GUARD,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.REQUEST_TIME_LEARNING,
    ],
    replacement: 'Use request-time learning decisions and the learning guard before durable evidence writes.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['request_learning_guard_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyGuardedOutcomeProjection.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_LEARNING_GUARD,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.GUARDED_OUTCOME_PROJECTION,
    ],
    replacement: 'Project only validated request-time decisions into bounded rebuild evidence.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['guarded_outcome_projection_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.REBUILD_PRESERVES_EXPLICIT_CONSTRAINTS,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_POLICY_REBUILD,
    ],
    replacement: 'Use library-derived rebuild proposals to preserve explicit operator constraints while deriving policy from library evidence.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['library_rebuild_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyMigrationVerifierRollback.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.ROLLBACK_REQUIRED_BEFORE_REPLACEMENT,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.MIGRATION_VERIFIER,
    ],
    replacement: 'Use the migration verifier to require operator acceptance and rollback snapshot before replacement.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['migration_verifier_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyLibraryRebuildAcceptanceTransition.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.ROLLBACK_REQUIRED_BEFORE_REPLACEMENT,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_REBUILD_ACCEPTANCE_TRANSITION,
    ],
    replacement: 'Use a current manual acceptance transition bound to the rebuild proposal and rollback plan before migration comparison.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: false,
    traceReasons: ['library_rebuild_acceptance_transition'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyLibraryRebuildSnapshotGate.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.ROLLBACK_REQUIRED_BEFORE_REPLACEMENT,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_REBUILD_SNAPSHOT_GATE,
    ],
    replacement: 'Persist one current rollback snapshot in an execution gate before any native replacement can run.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: false,
    traceReasons: ['library_rebuild_snapshot_gate'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyLibraryRebuildReplacementGate.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.ROLLBACK_REQUIRED_BEFORE_REPLACEMENT,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.LIBRARY_REBUILD_REPLACEMENT_GATE,
    ],
    replacement: 'Replace native intent only from matching persisted rollback and no-difference verifier proof, with idempotent execution.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: false,
    traceReasons: ['library_rebuild_replacement_gate'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyStrictConstraintDescriptor.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.REBUILD_PRESERVES_EXPLICIT_CONSTRAINTS,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.STRICT_CONSTRAINT_DESCRIPTORS,
    ],
    replacement: 'Preserve executable strict hard-limit semantics through rebuild instead of inferring a rule from display labels.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: false,
    traceReasons: ['strict_constraint_descriptor_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyRuntimeMetricsInput.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_RUNTIME_METRICS,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.RUNTIME_METRICS_SUPPRESS_DIAGNOSTICS,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_METRICS_INPUT,
    ],
    replacement: 'Normalize runtime telemetry to allowlisted records before metrics aggregation.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['runtime_metrics_input_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyRuntimeMetricsTrace.test.mjs',
    owner: 'server',
    decisionId: POLICY_RUNTIME_TEST_RESET_DECISION_IDS.REWRITE_RUNTIME_METRICS,
    coverageIds: [
      POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS.RUNTIME_METRICS_SUPPRESS_DIAGNOSTICS,
    ],
    contractIds: [
      POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS.RUNTIME_METRICS_TRACE,
    ],
    replacement: 'Use runtime metrics trace to count runtime outcomes without exposing old replay or impact diagnostic internals.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['runtime_metrics_rewrite'],
  }),
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizePathKey(value) {
  return normalizeString(value).replace(/\\/gu, '/');
}

function isWithinDirectory(candidatePath, directoryPath) {
  const resolvedCandidate = resolve(candidatePath).toLowerCase();
  const resolvedDirectory = resolve(directoryPath).toLowerCase();
  return resolvedCandidate === resolvedDirectory ||
    resolvedCandidate.startsWith(`${resolvedDirectory.toLowerCase()}${sep}`);
}

function resolveArtifactPath(artifactPath, repoRoot = DEFAULT_REPO_ROOT) {
  const normalizedPath = normalizeString(artifactPath);
  if (!normalizedPath || isAbsolute(normalizedPath)) {
    return {
      path: normalizePathKey(artifactPath),
      resolvedPath: '',
      withinRepo: false,
      exists: false,
    };
  }

  const resolvedPath = resolve(repoRoot, normalize(normalizedPath));
  const withinRepo = isWithinDirectory(resolvedPath, repoRoot);

  return {
    path: normalizePathKey(artifactPath),
    resolvedPath,
    withinRepo,
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- resolvedPath is constrained to repoRoot before this metadata-only existence check.
    exists: withinRepo && existsSync(resolvedPath),
  };
}

function sourceImportsContract(sourceContent, importMarker) {
  if (!sourceContent || !importMarker) {
    return false;
  }

  return [
    `from '${importMarker}'`,
    `from "${importMarker}"`,
    `import '${importMarker}'`,
    `import "${importMarker}"`,
  ].some(staticImportMarker => sourceContent.includes(staticImportMarker));
}

function buildArtifactAvailability(artifacts, { repoRoot = DEFAULT_REPO_ROOT } = {}) {
  return artifacts.map(artifact => {
    const availability = resolveArtifactPath(artifact.path, repoRoot);
    const sourceContent = availability.exists
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- resolvedPath is constrained to repoRoot before this read-only marker check.
      ? readFileSync(availability.resolvedPath, 'utf8')
      : '';

    return {
      path: artifact.path,
      exists: availability.exists,
      withinRepo: availability.withinRepo,
      contractMarkers: asArray(artifact.contractIds).map(contractId => {
        const marker = CONTRACT_IMPORT_MARKERS[contractId];

        return {
          contractId,
          present: sourceImportsContract(sourceContent, marker),
        };
      }),
    };
  });
}

function normalizeArtifact(artifact = {}) {
  return {
    path: normalizeString(artifact.path),
    owner: normalizeString(artifact.owner),
    decisionId: normalizeString(artifact.decisionId),
    coverageIds: asArray(artifact.coverageIds)
      .map(coverageId => normalizeString(coverageId))
      .filter(Boolean),
    contractIds: asArray(artifact.contractIds)
      .map(contractId => normalizeString(contractId))
      .filter(Boolean),
    replacement: normalizeString(artifact.replacement),
    protectsAuthority: normalizeBoolean(artifact.protectsAuthority),
    distinguishesClassificationFromRouting: normalizeBoolean(
      artifact.distinguishesClassificationFromRouting
    ),
    preservesOldPreviewUi: normalizeBoolean(artifact.preservesOldPreviewUi),
    deleteAfterMigration: normalizeBoolean(artifact.deleteAfterMigration),
    normalWorkflowAllowed: normalizeBoolean(artifact.normalWorkflowAllowed),
    traceReasons: asArray(artifact.traceReasons)
      .map(reason => normalizeString(reason))
      .filter(Boolean)
      .slice(0, 8),
  };
}

function summarizeDecisions(artifacts) {
  return DECISION_IDS.reduce((summary, decisionId) => {
    summary[decisionId] = artifacts
      .filter(artifact => artifact.decisionId === decisionId)
      .length;
    return summary;
  }, {});
}

function buildCoveragePlan(artifacts) {
  return REQUIRED_COVERAGE_IDS.map(coverageId => {
    const mappedArtifacts = artifacts.filter(artifact =>
      artifact.coverageIds.includes(coverageId)
    );

    return {
      coverageId,
      required: true,
      covered: mappedArtifacts.length > 0,
      artifactPaths: mappedArtifacts.map(artifact => artifact.path),
    };
  });
}

function buildContractCoveragePlan(artifacts) {
  return REQUIRED_CONTRACT_IDS.map(contractId => {
    const mappedArtifacts = artifacts.filter(artifact => artifact.contractIds.includes(contractId));

    return {
      contractId,
      required: true,
      covered: mappedArtifacts.length > 0,
      artifactPaths: mappedArtifacts.map(artifact => artifact.path),
    };
  });
}

function listPolicyRuntimeRebuildTestResetArtifacts() {
  return DEFAULT_TEST_RESET_ARTIFACTS.map(artifact => normalizeArtifact(artifact));
}

function buildPolicyRuntimeRebuildTestReset({
  artifacts = listPolicyRuntimeRebuildTestResetArtifacts(),
  repoRoot = DEFAULT_REPO_ROOT,
} = {}) {
  const normalizedArtifacts = asArray(artifacts).map(artifact => normalizeArtifact(artifact));
  const artifactAvailability = buildArtifactAvailability(normalizedArtifacts, { repoRoot });
  const coveragePlan = buildCoveragePlan(normalizedArtifacts);
  const contractCoveragePlan = buildContractCoveragePlan(normalizedArtifacts);
  const reset = {
    version: RESET_CONTRACT_VERSION,
    artifacts: normalizedArtifacts,
    artifactAvailability,
    coveragePlan,
    contractCoveragePlan,
    summary: {
      artifactCount: normalizedArtifacts.length,
      existingArtifactCount: artifactAvailability.filter(artifact => artifact.exists).length,
      decisionCounts: summarizeDecisions(normalizedArtifacts),
      requiredCoverageCount: REQUIRED_COVERAGE_IDS.length,
      coveredRequiredCoverageCount: coveragePlan.filter(coverage => coverage.covered).length,
      requiredContractCount: REQUIRED_CONTRACT_IDS.length,
      coveredRequiredContractCount: contractCoveragePlan.filter(contract => contract.covered).length,
      oldPreviewUiFrozen: normalizedArtifacts.some(artifact => artifact.preservesOldPreviewUi),
    },
    sideEffects: {
      testsDeleted: false,
      testsRewritten: false,
      workflowModified: false,
    },
    nextStep: {
      stepId: 'completion_audit',
      label: 'Runtime Contract Completion Audit',
      reason: 'Runtime and rebuild test reset is complete; verify all runtime contracts before native intent storage work starts.',
    },
  };

  return {
    ...reset,
    validation: validatePolicyRuntimeRebuildTestReset(reset),
  };
}

function validatePolicyRuntimeRebuildTestReset(reset = {}) {
  const artifacts = asArray(reset.artifacts);
  const artifactAvailability = asArray(reset.artifactAvailability);
  const artifactAvailabilityByPath = new Map(
    artifactAvailability.map(artifact => [normalizePathKey(artifact.path), artifact])
  );
  const coveragePlan = asArray(reset.coveragePlan);
  const contractCoveragePlan = asArray(reset.contractCoveragePlan);
  const issues = [];
  const mappedCoverageIds = new Set();
  const mappedContractIds = new Set();

  artifacts.forEach((artifact, index) => {
    const artifactPathKey = normalizePathKey(artifact.path);
    const availability = artifactAvailabilityByPath.get(artifactPathKey);

    if (!normalizeString(artifact.path)) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.MISSING_ARTIFACT_PATH,
        artifactIndex: index,
        message: 'Each runtime/rebuild test reset artifact must include a path.',
      });
    }

    if (normalizeString(artifact.path) && (!availability || availability.withinRepo !== true)) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_PATH_OUTSIDE_REPO,
        artifactPath: artifact.path || null,
        message: 'Runtime/rebuild test reset artifacts must resolve inside the repository.',
      });
    }

    if (normalizeString(artifact.path) && availability?.exists !== true) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_FILE_MISSING,
        artifactPath: artifact.path || null,
        message: 'Runtime/rebuild test reset artifact path must exist before the reset can pass.',
      });
    }

    if (!normalizeString(artifact.owner)) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.MISSING_ARTIFACT_OWNER,
        artifactPath: artifact.path || null,
        message: 'Each runtime/rebuild test reset artifact must include an owner.',
      });
    }

    if (!DECISION_IDS.includes(artifact.decisionId)) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_DECISION,
        artifactPath: artifact.path || null,
        decisionId: artifact.decisionId || null,
        message: 'Test reset artifact uses an unknown reset decision.',
      });
    }

    if (!normalizeString(artifact.replacement)) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.MISSING_REPLACEMENT,
        artifactPath: artifact.path || null,
        message: 'Every test reset artifact must name the retained or replacement contract.',
      });
    }

    asArray(artifact.coverageIds).forEach(coverageId => {
      mappedCoverageIds.add(coverageId);
      if (!COVERAGE_IDS.includes(coverageId)) {
        issues.push({
          riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_COVERAGE,
          artifactPath: artifact.path || null,
          coverageId,
          message: 'Test reset artifact references an unknown coverage id.',
        });
      }
    });

    if (asArray(artifact.coverageIds).length === 0) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.MISSING_COVERAGE,
        artifactPath: artifact.path || null,
        message: 'Every test reset artifact must map to at least one coverage contract.',
      });
    }

    asArray(artifact.contractIds).forEach(contractId => {
      mappedContractIds.add(contractId);
      if (!CONTRACT_IDS.includes(contractId)) {
        issues.push({
          riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_CONTRACT,
          artifactPath: artifact.path || null,
          contractId,
          message: 'Test reset artifact references an unknown runtime contract.',
        });
      }

      const marker = asArray(availability?.contractMarkers)
        .find(candidate => candidate.contractId === contractId);
      if (CONTRACT_IDS.includes(contractId) && marker?.present !== true) {
        issues.push({
          riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.ARTIFACT_CONTRACT_MARKER_MISSING,
          artifactPath: artifact.path || null,
          contractId,
          message: 'Test reset artifact must import the runtime contract it claims to protect.',
        });
      }
    });

    if (
      SERVER_AUTHORITY_DECISION_IDS.includes(artifact.decisionId) &&
      artifact.protectsAuthority !== true
    ) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.SERVER_AUTHORITY_NOT_PROTECTED,
        artifactPath: artifact.path || null,
        message: 'Runtime/rebuild rewrites must protect the server authority boundary.',
      });
    }

    if (
      asArray(artifact.coverageIds).some(coverageId =>
        CLASSIFICATION_ROUTING_COVERAGE_IDS.includes(coverageId)
      ) &&
      artifact.distinguishesClassificationFromRouting !== true
    ) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.CLASSIFICATION_ROUTING_NOT_DISTINGUISHED,
        artifactPath: artifact.path || null,
        message: 'Missing-routing coverage must distinguish classification success from routing success.',
      });
    }

    if (artifact.preservesOldPreviewUi === true) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.OLD_PREVIEW_UI_FROZEN,
        artifactPath: artifact.path || null,
        message: 'Runtime/rebuild test reset cannot freeze old impact/replay preview UI as the migration contract.',
      });
    }

    if (
      artifact.decisionId === POLICY_RUNTIME_TEST_RESET_DECISION_IDS.DELETE_ABANDONED_DIAGNOSTIC &&
      artifact.normalWorkflowAllowed === true
    ) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.DELETE_TARGET_STILL_NORMAL_WORKFLOW,
        artifactPath: artifact.path || null,
        message: 'Deletion candidates cannot remain normal workflow requirements.',
      });
    }

    if (
      artifact.decisionId === POLICY_RUNTIME_TEST_RESET_DECISION_IDS.DELETE_ABANDONED_DIAGNOSTIC &&
      !normalizeString(artifact.replacement)
    ) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.DELETE_TARGET_WITHOUT_REPLACEMENT,
        artifactPath: artifact.path || null,
        message: 'Deletion candidates must name the replacement server contract.',
      });
    }

    if (asArray(artifact.traceReasons).length === 0) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
        artifactPath: artifact.path || null,
        message: 'Every reset decision must include a bounded trace reason.',
      });
    }
  });

  REQUIRED_COVERAGE_IDS.forEach(coverageId => {
    const coverageRecord = coveragePlan.find(coverage => coverage.coverageId === coverageId);
    if (!coverageRecord || coverageRecord.covered !== true || !mappedCoverageIds.has(coverageId)) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.REQUIRED_COVERAGE_UNMAPPED,
        coverageId,
        message: 'Required runtime/rebuild reset coverage is not mapped to a test artifact.',
      });
    }
  });

  REQUIRED_CONTRACT_IDS.forEach(contractId => {
    const contractRecord = contractCoveragePlan.find(contract => contract.contractId === contractId);
    if (!contractRecord || contractRecord.covered !== true || !mappedContractIds.has(contractId)) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.REQUIRED_CONTRACT_UNMAPPED,
        contractId,
        message: 'Required runtime contract is not mapped to a focused test artifact.',
      });
    }
  });

  if (reset.summary?.oldPreviewUiFrozen === true) {
    issues.push({
      riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.OLD_PREVIEW_UI_FROZEN,
      message: 'Reset summary reports old preview UI as frozen.',
    });
  }

  Object.entries(reset.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS.OLD_PREVIEW_UI_FROZEN,
        message: `Runtime/rebuild test reset cannot perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyRuntimeRebuildTestResetAudit(
  reset = buildPolicyRuntimeRebuildTestReset()
) {
  const validation = validatePolicyRuntimeRebuildTestReset(reset);
  const contractCoveragePlan = asArray(reset.contractCoveragePlan);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    artifactCount: asArray(reset.artifacts).length,
    requiredCoverageCount: REQUIRED_COVERAGE_IDS.length,
    requiredContractCount: REQUIRED_CONTRACT_IDS.length,
    coveredRequiredContractCount: contractCoveragePlan.filter(contract =>
      contract.required === true && contract.covered === true
    ).length,
    validation,
    nextStep: reset.nextStep || {
      stepId: 'completion_audit',
      label: 'Runtime Contract Completion Audit',
      reason: 'Verify runtime contracts before native intent storage starts.',
    },
  };
}

export {
  POLICY_RUNTIME_TEST_RESET_AUDIT_RISK_IDS,
  POLICY_RUNTIME_TEST_RESET_CONTRACT_IDS,
  POLICY_RUNTIME_TEST_RESET_COVERAGE_IDS,
  POLICY_RUNTIME_TEST_RESET_DECISION_IDS,
  buildPolicyRuntimeRebuildTestReset,
  buildPolicyRuntimeRebuildTestResetAudit,
  listPolicyRuntimeRebuildTestResetArtifacts,
  validatePolicyRuntimeRebuildTestReset,
};
