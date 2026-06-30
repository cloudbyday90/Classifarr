const PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS = Object.freeze({
  KEEP_ENGINE_PRIMITIVE: 'keep_engine_primitive',
  MIGRATION_VERIFIER: 'migration_verifier',
  DELETE_AFTER_MIGRATION: 'delete_after_migration',
  PHASE8_STORAGE_BLOCKER: 'phase8_storage_blocker',
});

const PHASE6R_MIGRATION_GATE_IDS = Object.freeze({
  PHASE6_ENGINE_CONTRACTS_STABLE: 'phase6_engine_contracts_stable',
  REPRESENTATIVE_COMPARISON_DEFINED: 'representative_comparison_defined',
  ROLLBACK_SNAPSHOT_DEFINED: 'rollback_snapshot_defined',
  ROLLBACK_WINDOW_DEFINED: 'rollback_window_defined',
  DELETE_CHECKLIST_DEFINED: 'delete_checklist_defined',
  NATIVE_STORAGE_BLOCKED_UNTIL_PHASE8: 'native_storage_blocked_until_phase8',
});

const PHASE6R_MIGRATION_VERIFIER_KIND_IDS = Object.freeze({
  IMPACT_PARITY: 'impact_parity',
  REPRESENTATIVE_REPLAY: 'representative_replay',
  ENRICHMENT_COVERAGE: 'enrichment_coverage',
  ROUTE_READINESS_PARITY: 'route_readiness_parity',
  NONE: 'none',
});

const PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_DECISION: 'unknown_decision',
  UNKNOWN_VERIFIER_KIND: 'unknown_verifier_kind',
  MISSING_ARTIFACT_PATH: 'missing_artifact_path',
  MISSING_OWNER: 'missing_owner',
  MISSING_REPLACEMENT: 'missing_replacement',
  MISSING_REMOVAL_GATE: 'missing_removal_gate',
  MISSING_ROLLBACK_PLAN: 'missing_rollback_plan',
  MISSING_RETENTION_WINDOW: 'missing_retention_window',
  NORMAL_FLOW_DIAGNOSTIC_SURFACE: 'normal_flow_diagnostic_surface',
  VERIFIER_WITHOUT_RETENTION: 'verifier_without_retention',
  DELETE_TARGET_WITHOUT_REPLACEMENT: 'delete_target_without_replacement',
  PHASE8_NOT_BLOCKED: 'phase8_not_blocked',
  MISSING_REQUIRED_GATE: 'missing_required_gate',
  STORAGE_MIGRATION_BEFORE_ENGINE_STABILITY: 'storage_migration_before_engine_stability',
});

const REQUIRED_GATE_IDS = Object.freeze(Object.values(PHASE6R_MIGRATION_GATE_IDS));
const DECISION_IDS = Object.freeze(Object.values(PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS));
const VERIFIER_KIND_IDS = Object.freeze(Object.values(PHASE6R_MIGRATION_VERIFIER_KIND_IDS));

const DEFAULT_ROLLBACK_PLAN = Object.freeze({
  snapshotRequired: true,
  restorePathRequired: true,
  retentionWindowDays: 30,
  phase8StorageMigrationAllowed: false,
});

const DEFAULT_REMOVAL_GATES = Object.freeze([
  PHASE6R_MIGRATION_GATE_IDS.PHASE6_ENGINE_CONTRACTS_STABLE,
  PHASE6R_MIGRATION_GATE_IDS.REPRESENTATIVE_COMPARISON_DEFINED,
  PHASE6R_MIGRATION_GATE_IDS.ROLLBACK_SNAPSHOT_DEFINED,
  PHASE6R_MIGRATION_GATE_IDS.ROLLBACK_WINDOW_DEFINED,
  PHASE6R_MIGRATION_GATE_IDS.DELETE_CHECKLIST_DEFINED,
  PHASE6R_MIGRATION_GATE_IDS.NATIVE_STORAGE_BLOCKED_UNTIL_PHASE8,
]);

const DEFAULT_MIGRATION_ARTIFACTS = Object.freeze([
  {
    path: 'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
    owner: 'policy-builder-ui',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Phase 6R operator workflow readiness section',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
    owner: 'policy-builder-ui',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Phase 6R.6 migration verifier outside the normal workflow',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/composables/usePolicyIntentImpactPreview.js',
    owner: 'policy-builder-ui',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Phase 6R migration comparison service',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/composables/usePolicyIntentReplayPreview.js',
    owner: 'policy-builder-ui',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Phase 6R migration verifier service',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/utils/policyIntentImpactPreview.js',
    owner: 'policy-builder-ui',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Server-owned migration comparison projection',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/utils/policyIntentReplayPreview.js',
    owner: 'policy-builder-ui',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Server-owned migration replay verifier projection',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/routes/policiesRoutePolicyWrite.mjs',
    owner: 'policy-builder-api',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Dedicated Phase 6R/8R migration verifier route outside normal policy writes',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentImpactPreview.mjs',
    owner: 'policy-builder-server',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Phase 6R migration comparison service with sanitized output',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayPreview.mjs',
    owner: 'policy-builder-server',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Phase 6R migration replay verifier with explicit retention',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayScoring.mjs',
    owner: 'policy-builder-server',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Verifier-only parity calculator, not operator scoring UI',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayProviderReadiness.mjs',
    owner: 'policy-builder-server',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: [
      'Phase 6R readiness ignores provider state;',
      'migration verifier may use sanitized enrichment coverage only',
    ].join(' '),
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayTmdbMetadataCoverageComparison.mjs',
    owner: 'policy-builder-server',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Verifier-only sanitized metadata coverage comparison',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyBuilderPhase6EvidenceEngine.mjs',
    owner: 'phase6r-engine',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.NONE,
    replacement: 'Native Phase 6R engine contract',
    normalWorkflowAllowed: true,
    removalGateIds: [],
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyBuilderPhase6IntentEngine.mjs',
    owner: 'phase6r-engine',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.NONE,
    replacement: 'Native Phase 6R engine contract',
    normalWorkflowAllowed: true,
    removalGateIds: [],
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'database/schema/current.sql',
    owner: 'database',
    decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.PHASE8_STORAGE_BLOCKER,
    verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.NONE,
    replacement: 'Phase 8R native intent schema after engine and rollback gates pass',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function listPolicyBuilderPhase6MigrationArtifacts() {
  return DEFAULT_MIGRATION_ARTIFACTS;
}

function normalizeMigrationArtifact(artifact = {}) {
  return {
    path: normalizeString(artifact.path),
    owner: normalizeString(artifact.owner),
    decisionId: normalizeString(artifact.decisionId),
    verifierKindId: normalizeString(artifact.verifierKindId) ||
      PHASE6R_MIGRATION_VERIFIER_KIND_IDS.NONE,
    replacement: normalizeString(artifact.replacement),
    normalWorkflowAllowed: artifact.normalWorkflowAllowed === true,
    removalGateIds: asArray(artifact.removalGateIds),
    rollbackPlan: {
      ...DEFAULT_ROLLBACK_PLAN,
      ...(artifact.rollbackPlan || {}),
    },
  };
}

function validateMigrationArtifact(candidate = {}) {
  const artifact = normalizeMigrationArtifact(candidate);
  const issues = [];

  if (!artifact.path) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_ARTIFACT_PATH,
      message: 'Migration artifact must include a path.',
    });
  }

  if (!artifact.owner) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_OWNER,
      message: 'Migration artifact must include an owner.',
    });
  }

  if (!DECISION_IDS.includes(artifact.decisionId)) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.UNKNOWN_DECISION,
      message: 'Migration artifact must use a supported decision.',
    });
  }

  if (!VERIFIER_KIND_IDS.includes(artifact.verifierKindId)) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.UNKNOWN_VERIFIER_KIND,
      message: 'Migration artifact must use a supported verifier kind.',
    });
  }

  if (!artifact.replacement) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REPLACEMENT,
      message: 'Migration artifact must name its replacement or reason to keep.',
    });
  }

  if (
    artifact.decisionId === PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION &&
    !artifact.replacement
  ) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.DELETE_TARGET_WITHOUT_REPLACEMENT,
      message: 'Delete-after-migration artifacts must name a replacement.',
    });
  }

  if (
    artifact.decisionId !== PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE &&
    artifact.removalGateIds.length === 0
  ) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REMOVAL_GATE,
      message: 'Migration and deletion artifacts must define removal gates.',
    });
  }

  if (
    artifact.decisionId !== PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE &&
    artifact.rollbackPlan.snapshotRequired !== true
  ) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_ROLLBACK_PLAN,
      message: 'Migration and deletion artifacts require rollback snapshots.',
    });
  }

  if (
    artifact.decisionId !== PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE &&
    (!Number.isFinite(Number(artifact.rollbackPlan.retentionWindowDays)) ||
      Number(artifact.rollbackPlan.retentionWindowDays) <= 0)
  ) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_RETENTION_WINDOW,
      message: 'Migration and deletion artifacts require an explicit rollback retention window.',
    });
  }

  if (
    artifact.decisionId === PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER &&
    artifact.verifierKindId === PHASE6R_MIGRATION_VERIFIER_KIND_IDS.NONE
  ) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.UNKNOWN_VERIFIER_KIND,
      message: 'Migration verifier artifacts must declare the verifier kind.',
    });
  }

  if (
    artifact.decisionId === PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER &&
    artifact.rollbackPlan.retentionWindowDays <= 0
  ) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.VERIFIER_WITHOUT_RETENTION,
      message: 'Migration verifier artifacts must define retention.',
    });
  }

  if (
    artifact.normalWorkflowAllowed === true &&
    artifact.decisionId !== PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE
  ) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.NORMAL_FLOW_DIAGNOSTIC_SURFACE,
      message: 'Legacy diagnostic or migration verifier artifacts cannot stay in the normal workflow.',
    });
  }

  if (
    artifact.decisionId === PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.PHASE8_STORAGE_BLOCKER &&
    artifact.rollbackPlan.phase8StorageMigrationAllowed === true
  ) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.STORAGE_MIGRATION_BEFORE_ENGINE_STABILITY,
      message: 'Phase 8R native storage migration must remain blocked until Phase 6R gates pass.',
    });
  }

  return {
    ok: issues.length === 0,
    artifact,
    issues,
  };
}

function buildPolicyBuilderPhase6MigrationPlan({
  artifacts = DEFAULT_MIGRATION_ARTIFACTS,
  requiredGateIds = REQUIRED_GATE_IDS,
  rollbackPlan = DEFAULT_ROLLBACK_PLAN,
} = {}) {
  const normalizedArtifacts = artifacts.map(normalizeMigrationArtifact);
  const gateIds = asArray(requiredGateIds);
  const validationResults = normalizedArtifacts.map(validateMigrationArtifact);
  const artifactIssues = validationResults.flatMap(result => result.issues);
  const gateIssues = REQUIRED_GATE_IDS
    .filter(gateId => !gateIds.includes(gateId))
    .map(gateId => ({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REQUIRED_GATE,
      message: `Migration plan is missing required gate "${gateId}".`,
    }));
  const phase8Issues = rollbackPlan.phase8StorageMigrationAllowed === true
    ? [{
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.PHASE8_NOT_BLOCKED,
      message: 'Phase 8R native storage migration must remain blocked by Phase 6R.',
    }]
    : [];
  const issues = [
    ...artifactIssues,
    ...gateIssues,
    ...phase8Issues,
  ];

  return {
    version: 'phase6r.migration_deletion_path.v1',
    phaseId: '6r_6',
    requiredGateIds: gateIds,
    rollbackPlan: {
      ...DEFAULT_ROLLBACK_PLAN,
      ...rollbackPlan,
      phase8StorageMigrationAllowed: rollbackPlan.phase8StorageMigrationAllowed === true,
    },
    artifacts: normalizedArtifacts,
    normalWorkflowAllowsDiagnostics: false,
    phase8StorageMigrationBlocked: rollbackPlan.phase8StorageMigrationAllowed !== true,
    validation: {
      ok: issues.length === 0,
      issueCount: issues.length,
      issues,
    },
  };
}

function validatePolicyBuilderPhase6MigrationPlan(plan = {}) {
  const artifacts = asArray(plan.artifacts);
  const artifactValidation = artifacts.map(validateMigrationArtifact);
  const issues = artifactValidation.flatMap(result => result.issues);

  REQUIRED_GATE_IDS
    .filter(gateId => !asArray(plan.requiredGateIds).includes(gateId))
    .forEach(gateId => {
      issues.push({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REQUIRED_GATE,
        message: `Migration plan is missing required gate "${gateId}".`,
      });
    });

  if (plan.normalWorkflowAllowsDiagnostics === true) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.NORMAL_FLOW_DIAGNOSTIC_SURFACE,
      message: 'Migration diagnostics cannot remain in the normal operator workflow.',
    });
  }

  if (plan.phase8StorageMigrationBlocked !== true) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.PHASE8_NOT_BLOCKED,
      message: 'Phase 8R storage migration must be blocked until engine and rollback gates pass.',
    });
  }

  if (plan.rollbackPlan?.snapshotRequired !== true ||
      plan.rollbackPlan?.restorePathRequired !== true) {
    issues.push({
      riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_ROLLBACK_PLAN,
      message: 'Migration plan must require backup snapshots and a restore path.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    artifactCount: artifacts.length,
    issues,
  };
}

function buildPolicyBuilderPhase6MigrationDeletionAudit(
  plan = buildPolicyBuilderPhase6MigrationPlan()
) {
  const validation = validatePolicyBuilderPhase6MigrationPlan(plan);
  const verifierCount = asArray(plan.artifacts).filter(artifact =>
    artifact.decisionId === PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER
  ).length;
  const deleteCount = asArray(plan.artifacts).filter(artifact =>
    artifact.decisionId === PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION
  ).length;

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedArtifactCount: validation.artifactCount,
    verifierCount,
    deleteCount,
    validation,
    nextPhase: {
      phaseId: '7r_1',
      label: 'Runtime Decision Inventory And Cutline',
      reason: 'Phase 6R engine and workflow contracts now have an explicit migration/deletion path, so runtime classification, routing, question, and learning paths can be inventoried against those contracts.',
    },
  };
}

export {
  PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS,
  PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS,
  PHASE6R_MIGRATION_GATE_IDS,
  PHASE6R_MIGRATION_VERIFIER_KIND_IDS,
  buildPolicyBuilderPhase6MigrationDeletionAudit,
  buildPolicyBuilderPhase6MigrationPlan,
  listPolicyBuilderPhase6MigrationArtifacts,
  validateMigrationArtifact,
  validatePolicyBuilderPhase6MigrationPlan,
};
