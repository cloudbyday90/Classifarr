const PHASE7R_TEST_RESET_DECISION_IDS = Object.freeze({
  KEEP_CLASSIFICATION_REGRESSION: 'keep_classification_regression',
  REWRITE_EVIDENCE_PROJECTION: 'rewrite_evidence_projection',
  REWRITE_AUTOMATION_DECISION: 'rewrite_automation_decision',
  REWRITE_QUESTION_CONTRACT: 'rewrite_question_contract',
  REWRITE_LEARNING_GUARD: 'rewrite_learning_guard',
  REWRITE_REBUILD_VERIFIER: 'rewrite_rebuild_verifier',
  REWRITE_RUNTIME_METRICS: 'rewrite_runtime_metrics',
  DELETE_ABANDONED_DIAGNOSTIC: 'delete_abandoned_diagnostic',
});

const PHASE7R_TEST_RESET_COVERAGE_IDS = Object.freeze({
  BROAD_GENRE_NO_SPECIALIZED_AUTO_ROUTE: 'broad_genre_no_specialized_auto_route',
  MISSING_ROUTING_CLASSIFIED_NOT_ROUTED: 'missing_routing_classified_not_routed',
  STALE_QUESTIONS_CANNOT_LEARN: 'stale_questions_cannot_learn',
  REQUEST_CHOICES_REQUIRE_GUARD: 'request_choices_require_guard',
  REBUILD_PRESERVES_EXPLICIT_CONSTRAINTS: 'rebuild_preserves_explicit_constraints',
  ROLLBACK_REQUIRED_BEFORE_REPLACEMENT: 'rollback_required_before_replacement',
  RUNTIME_METRICS_SUPPRESS_DIAGNOSTICS: 'runtime_metrics_suppress_diagnostics',
  CLASSIFICATION_REGRESSION_REMAINS: 'classification_regression_remains',
});

const PHASE7R_TEST_RESET_AUDIT_RISK_IDS = Object.freeze({
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
});

const RESET_CONTRACT_VERSION = 'phase7r.runtime_rebuild_test_reset.v1';

const REQUIRED_COVERAGE_IDS = Object.freeze([
  PHASE7R_TEST_RESET_COVERAGE_IDS.BROAD_GENRE_NO_SPECIALIZED_AUTO_ROUTE,
  PHASE7R_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED,
  PHASE7R_TEST_RESET_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN,
  PHASE7R_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD,
  PHASE7R_TEST_RESET_COVERAGE_IDS.REBUILD_PRESERVES_EXPLICIT_CONSTRAINTS,
  PHASE7R_TEST_RESET_COVERAGE_IDS.ROLLBACK_REQUIRED_BEFORE_REPLACEMENT,
]);

const DECISION_IDS = Object.freeze(Object.values(PHASE7R_TEST_RESET_DECISION_IDS));
const COVERAGE_IDS = Object.freeze(Object.values(PHASE7R_TEST_RESET_COVERAGE_IDS));
const SERVER_AUTHORITY_DECISION_IDS = Object.freeze([
  PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_EVIDENCE_PROJECTION,
  PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_AUTOMATION_DECISION,
  PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_QUESTION_CONTRACT,
  PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_LEARNING_GUARD,
  PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER,
  PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_RUNTIME_METRICS,
]);

const CLASSIFICATION_ROUTING_COVERAGE_IDS = Object.freeze([
  PHASE7R_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED,
]);

const DEFAULT_TEST_RESET_ARTIFACTS = Object.freeze([
  Object.freeze({
    path: 'server/src/__tests__/classification-routing.test.mjs',
    owner: 'server',
    decisionId: PHASE7R_TEST_RESET_DECISION_IDS.KEEP_CLASSIFICATION_REGRESSION,
    coverageIds: [
      PHASE7R_TEST_RESET_COVERAGE_IDS.CLASSIFICATION_REGRESSION_REMAINS,
    ],
    replacement: 'Keep as existing classification/routing regression coverage while Phase 7R contracts protect new authority boundaries.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['classification_regression_kept'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyBuilderPhase7RuntimeEvidenceProjection.test.mjs',
    owner: 'server',
    decisionId: PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_EVIDENCE_PROJECTION,
    coverageIds: [
      PHASE7R_TEST_RESET_COVERAGE_IDS.BROAD_GENRE_NO_SPECIALIZED_AUTO_ROUTE,
    ],
    replacement: 'Use Phase 7R runtime evidence projection to demote broad genre overlap until identity evidence exists.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['evidence_projection_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyBuilderPhase7AutomationDecisionContract.test.mjs',
    owner: 'server',
    decisionId: PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_AUTOMATION_DECISION,
    coverageIds: [
      PHASE7R_TEST_RESET_COVERAGE_IDS.BROAD_GENRE_NO_SPECIALIZED_AUTO_ROUTE,
      PHASE7R_TEST_RESET_COVERAGE_IDS.MISSING_ROUTING_CLASSIFIED_NOT_ROUTED,
    ],
    replacement: 'Use Phase 7R automation states to separate classification success from routing success.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['automation_contract_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyBuilderPhase7RuntimeQuestionReduction.test.mjs',
    owner: 'server',
    decisionId: PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_QUESTION_CONTRACT,
    coverageIds: [
      PHASE7R_TEST_RESET_COVERAGE_IDS.STALE_QUESTIONS_CANNOT_LEARN,
    ],
    replacement: 'Use Phase 7R question reduction to clean stale or legacy questions and prevent unguarded learning.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['question_contract_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyBuilderPhase7RequestTimeLearning.test.mjs',
    owner: 'server',
    decisionId: PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_LEARNING_GUARD,
    coverageIds: [
      PHASE7R_TEST_RESET_COVERAGE_IDS.REQUEST_CHOICES_REQUIRE_GUARD,
    ],
    replacement: 'Use Phase 7R request-time learning decisions and Phase 6R learning guard before durable evidence writes.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['request_learning_guard_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyBuilderPhase7LibraryPolicyRebuild.test.mjs',
    owner: 'server',
    decisionId: PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER,
    coverageIds: [
      PHASE7R_TEST_RESET_COVERAGE_IDS.REBUILD_PRESERVES_EXPLICIT_CONSTRAINTS,
    ],
    replacement: 'Use Phase 7R rebuild proposals to preserve explicit operator constraints while deriving policy from library evidence.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['library_rebuild_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyBuilderPhase7MigrationVerifierRollback.test.mjs',
    owner: 'server',
    decisionId: PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_REBUILD_VERIFIER,
    coverageIds: [
      PHASE7R_TEST_RESET_COVERAGE_IDS.ROLLBACK_REQUIRED_BEFORE_REPLACEMENT,
    ],
    replacement: 'Use Phase 7R migration verifier to require operator acceptance and rollback snapshot before replacement.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['migration_verifier_rewrite'],
  }),
  Object.freeze({
    path: 'server/src/__tests__/services/policyBuilderPhase7RuntimeMetricsTrace.test.mjs',
    owner: 'server',
    decisionId: PHASE7R_TEST_RESET_DECISION_IDS.REWRITE_RUNTIME_METRICS,
    coverageIds: [
      PHASE7R_TEST_RESET_COVERAGE_IDS.RUNTIME_METRICS_SUPPRESS_DIAGNOSTICS,
    ],
    replacement: 'Use Phase 7R metrics trace to count runtime outcomes without exposing old replay or impact diagnostic internals.',
    protectsAuthority: true,
    distinguishesClassificationFromRouting: true,
    preservesOldPreviewUi: false,
    deleteAfterMigration: false,
    normalWorkflowAllowed: true,
    traceReasons: ['runtime_metrics_rewrite'],
  }),
  Object.freeze({
    path: 'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js',
    owner: 'client',
    decisionId: PHASE7R_TEST_RESET_DECISION_IDS.DELETE_ABANDONED_DIAGNOSTIC,
    coverageIds: [
      PHASE7R_TEST_RESET_COVERAGE_IDS.REBUILD_PRESERVES_EXPLICIT_CONSTRAINTS,
    ],
    replacement: 'Replace behavior-sensitive impact preview assertions with server rebuild proposal and migration verifier coverage before deleting old UI diagnostics.',
    protectsAuthority: false,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: true,
    normalWorkflowAllowed: false,
    traceReasons: ['old_impact_preview_delete_after_migration'],
  }),
  Object.freeze({
    path: 'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
    owner: 'client',
    decisionId: PHASE7R_TEST_RESET_DECISION_IDS.DELETE_ABANDONED_DIAGNOSTIC,
    coverageIds: [
      PHASE7R_TEST_RESET_COVERAGE_IDS.ROLLBACK_REQUIRED_BEFORE_REPLACEMENT,
    ],
    replacement: 'Replace replay preview migration confidence with server migration verifier coverage before deleting old UI diagnostics.',
    protectsAuthority: false,
    distinguishesClassificationFromRouting: false,
    preservesOldPreviewUi: false,
    deleteAfterMigration: true,
    normalWorkflowAllowed: false,
    traceReasons: ['old_replay_preview_delete_after_migration'],
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

function normalizeArtifact(artifact = {}) {
  return {
    path: normalizeString(artifact.path),
    owner: normalizeString(artifact.owner),
    decisionId: normalizeString(artifact.decisionId),
    coverageIds: asArray(artifact.coverageIds)
      .map(coverageId => normalizeString(coverageId))
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

function listPolicyBuilderPhase7TestResetArtifacts() {
  return DEFAULT_TEST_RESET_ARTIFACTS.map(artifact => normalizeArtifact(artifact));
}

function buildPolicyBuilderPhase7RuntimeRebuildTestReset({
  artifacts = listPolicyBuilderPhase7TestResetArtifacts(),
} = {}) {
  const normalizedArtifacts = asArray(artifacts).map(artifact => normalizeArtifact(artifact));
  const coveragePlan = buildCoveragePlan(normalizedArtifacts);
  const reset = {
    version: RESET_CONTRACT_VERSION,
    artifacts: normalizedArtifacts,
    coveragePlan,
    summary: {
      artifactCount: normalizedArtifacts.length,
      decisionCounts: summarizeDecisions(normalizedArtifacts),
      requiredCoverageCount: REQUIRED_COVERAGE_IDS.length,
      coveredRequiredCoverageCount: coveragePlan.filter(coverage => coverage.covered).length,
      oldPreviewUiFrozen: normalizedArtifacts.some(artifact => artifact.preservesOldPreviewUi),
    },
    sideEffects: {
      testsDeleted: false,
      testsRewritten: false,
      workflowModified: false,
    },
    nextPhase: {
      phaseId: 'phase7r_completion_audit',
      label: 'Phase 7R Completion Audit',
      reason: 'The runtime and rebuild test reset is the final Phase 7R component; verify all Phase 7R contracts before Phase 8R native intent storage work starts.',
    },
  };

  return {
    ...reset,
    validation: validatePolicyBuilderPhase7RuntimeRebuildTestReset(reset),
  };
}

function validatePolicyBuilderPhase7RuntimeRebuildTestReset(reset = {}) {
  const artifacts = asArray(reset.artifacts);
  const coveragePlan = asArray(reset.coveragePlan);
  const issues = [];
  const mappedCoverageIds = new Set();

  artifacts.forEach((artifact, index) => {
    if (!normalizeString(artifact.path)) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.MISSING_ARTIFACT_PATH,
        artifactIndex: index,
        message: 'Each runtime/rebuild test reset artifact must include a path.',
      });
    }

    if (!normalizeString(artifact.owner)) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.MISSING_ARTIFACT_OWNER,
        artifactPath: artifact.path || null,
        message: 'Each runtime/rebuild test reset artifact must include an owner.',
      });
    }

    if (!DECISION_IDS.includes(artifact.decisionId)) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_DECISION,
        artifactPath: artifact.path || null,
        decisionId: artifact.decisionId || null,
        message: 'Test reset artifact uses an unknown reset decision.',
      });
    }

    if (!normalizeString(artifact.replacement)) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.MISSING_REPLACEMENT,
        artifactPath: artifact.path || null,
        message: 'Every test reset artifact must name the retained or replacement contract.',
      });
    }

    asArray(artifact.coverageIds).forEach(coverageId => {
      mappedCoverageIds.add(coverageId);
      if (!COVERAGE_IDS.includes(coverageId)) {
        issues.push({
          riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.UNKNOWN_COVERAGE,
          artifactPath: artifact.path || null,
          coverageId,
          message: 'Test reset artifact references an unknown coverage id.',
        });
      }
    });

    if (asArray(artifact.coverageIds).length === 0) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.MISSING_COVERAGE,
        artifactPath: artifact.path || null,
        message: 'Every test reset artifact must map to at least one coverage contract.',
      });
    }

    if (
      SERVER_AUTHORITY_DECISION_IDS.includes(artifact.decisionId) &&
      artifact.protectsAuthority !== true
    ) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.SERVER_AUTHORITY_NOT_PROTECTED,
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
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.CLASSIFICATION_ROUTING_NOT_DISTINGUISHED,
        artifactPath: artifact.path || null,
        message: 'Missing-routing coverage must distinguish classification success from routing success.',
      });
    }

    if (artifact.preservesOldPreviewUi === true) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.OLD_PREVIEW_UI_FROZEN,
        artifactPath: artifact.path || null,
        message: 'Phase 7R test reset cannot freeze old impact/replay preview UI as the migration contract.',
      });
    }

    if (
      artifact.decisionId === PHASE7R_TEST_RESET_DECISION_IDS.DELETE_ABANDONED_DIAGNOSTIC &&
      artifact.normalWorkflowAllowed === true
    ) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.DELETE_TARGET_STILL_NORMAL_WORKFLOW,
        artifactPath: artifact.path || null,
        message: 'Deletion candidates cannot remain normal workflow requirements.',
      });
    }

    if (
      artifact.decisionId === PHASE7R_TEST_RESET_DECISION_IDS.DELETE_ABANDONED_DIAGNOSTIC &&
      !normalizeString(artifact.replacement)
    ) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.DELETE_TARGET_WITHOUT_REPLACEMENT,
        artifactPath: artifact.path || null,
        message: 'Deletion candidates must name the replacement server contract.',
      });
    }

    if (asArray(artifact.traceReasons).length === 0) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
        artifactPath: artifact.path || null,
        message: 'Every reset decision must include a bounded trace reason.',
      });
    }
  });

  REQUIRED_COVERAGE_IDS.forEach(coverageId => {
    const coverageRecord = coveragePlan.find(coverage => coverage.coverageId === coverageId);
    if (!coverageRecord || coverageRecord.covered !== true || !mappedCoverageIds.has(coverageId)) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.REQUIRED_COVERAGE_UNMAPPED,
        coverageId,
        message: 'Required Phase 7R runtime/rebuild reset coverage is not mapped to a test artifact.',
      });
    }
  });

  if (reset.summary?.oldPreviewUiFrozen === true) {
    issues.push({
      riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.OLD_PREVIEW_UI_FROZEN,
      message: 'Reset summary reports old preview UI as frozen.',
    });
  }

  Object.entries(reset.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: PHASE7R_TEST_RESET_AUDIT_RISK_IDS.OLD_PREVIEW_UI_FROZEN,
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

function buildPolicyBuilderPhase7RuntimeRebuildTestResetAudit(
  reset = buildPolicyBuilderPhase7RuntimeRebuildTestReset()
) {
  const validation = validatePolicyBuilderPhase7RuntimeRebuildTestReset(reset);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    artifactCount: asArray(reset.artifacts).length,
    requiredCoverageCount: REQUIRED_COVERAGE_IDS.length,
    validation,
    nextPhase: reset.nextPhase || {
      phaseId: 'phase7r_completion_audit',
      label: 'Phase 7R Completion Audit',
      reason: 'Verify Phase 7R contracts before Phase 8R native intent storage starts.',
    },
  };
}

export {
  PHASE7R_TEST_RESET_AUDIT_RISK_IDS,
  PHASE7R_TEST_RESET_COVERAGE_IDS,
  PHASE7R_TEST_RESET_DECISION_IDS,
  buildPolicyBuilderPhase7RuntimeRebuildTestReset,
  buildPolicyBuilderPhase7RuntimeRebuildTestResetAudit,
  listPolicyBuilderPhase7TestResetArtifacts,
  validatePolicyBuilderPhase7RuntimeRebuildTestReset,
};
