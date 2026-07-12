import {
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
} from './policyEvidenceQuality.mjs';
import {
  validatePolicyDecisionHandoffAdmission,
  validatePolicyDecisionHandoffSourceSummary,
} from './policyDecisionHandoffSource.mjs';

const POLICY_MIGRATION_ARTIFACT_DECISION_IDS = Object.freeze({
  KEEP_ENGINE_PRIMITIVE: 'keep_engine_primitive',
  DELETE_AFTER_MIGRATION: 'delete_after_migration',
  NATIVE_STORAGE_BLOCKER: 'native_storage_blocker',
});

const POLICY_MIGRATION_GATE_IDS = Object.freeze({
  POLICY_ENGINE_CONTRACTS_STABLE: 'policy_engine_contracts_stable',
  REPRESENTATIVE_COMPARISON_DEFINED: 'representative_comparison_defined',
  ROLLBACK_SNAPSHOT_DEFINED: 'rollback_snapshot_defined',
  ROLLBACK_WINDOW_DEFINED: 'rollback_window_defined',
  DELETE_CHECKLIST_DEFINED: 'delete_checklist_defined',
  NATIVE_STORAGE_BLOCKED_UNTIL_MIGRATION_READY: 'native_storage_blocked_until_migration_ready',
});

const POLICY_MIGRATION_VERIFIER_KIND_IDS = Object.freeze({
  IMPACT_PARITY: 'impact_parity',
  REPRESENTATIVE_REPLAY: 'representative_replay',
  ENRICHMENT_COVERAGE: 'enrichment_coverage',
  ROUTE_READINESS_PARITY: 'route_readiness_parity',
  NONE: 'none',
});

const POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS = Object.freeze({
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
  NATIVE_STORAGE_NOT_BLOCKED: 'native_storage_not_blocked',
  MISSING_REQUIRED_GATE: 'missing_required_gate',
  STORAGE_MIGRATION_BEFORE_ENGINE_STABILITY: 'storage_migration_before_engine_stability',
  MISSING_BOUNDED_WORKFLOW: 'missing_bounded_workflow',
  MISSING_BOUNDED_PROVENANCE: 'missing_bounded_provenance',
  BOUNDED_PROVENANCE_MISMATCH: 'bounded_provenance_mismatch',
  BOUNDED_WORKFLOW_AUDIT_NOT_PASSING: 'bounded_workflow_audit_not_passing',
  MISSING_BOUNDED_QUALITY: 'missing_bounded_quality',
  BOUNDED_QUALITY_INSUFFICIENT: 'bounded_quality_insufficient',
  BOUNDED_QUALITY_MISMATCH: 'bounded_quality_mismatch',
  UNAPPROVED_BOUNDED_DECISION_SOURCE: 'unapproved_bounded_decision_source',
  INVALID_MIGRATION_DECISION_SOURCE: 'invalid_migration_decision_source',
});

const POLICY_MIGRATION_BOUNDARY_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_BOUNDED_WORKFLOW: 'blocked_by_bounded_workflow',
  BLOCKED_BY_MIGRATION_AUDIT: 'blocked_by_migration_audit',
});

const REQUIRED_GATE_IDS = Object.freeze(Object.values(POLICY_MIGRATION_GATE_IDS));
const DECISION_IDS = Object.freeze(Object.values(POLICY_MIGRATION_ARTIFACT_DECISION_IDS));
const VERIFIER_KIND_IDS = Object.freeze(Object.values(POLICY_MIGRATION_VERIFIER_KIND_IDS));

const DEFAULT_ROLLBACK_PLAN = Object.freeze({
  snapshotRequired: true,
  restorePathRequired: true,
  retentionWindowDays: 30,
  nativeStorageMigrationAllowed: false,
});

const DEFAULT_REMOVAL_GATES = Object.freeze([
  POLICY_MIGRATION_GATE_IDS.POLICY_ENGINE_CONTRACTS_STABLE,
  POLICY_MIGRATION_GATE_IDS.REPRESENTATIVE_COMPARISON_DEFINED,
  POLICY_MIGRATION_GATE_IDS.ROLLBACK_SNAPSHOT_DEFINED,
  POLICY_MIGRATION_GATE_IDS.ROLLBACK_WINDOW_DEFINED,
  POLICY_MIGRATION_GATE_IDS.DELETE_CHECKLIST_DEFINED,
  POLICY_MIGRATION_GATE_IDS.NATIVE_STORAGE_BLOCKED_UNTIL_MIGRATION_READY,
]);

const DEFAULT_MIGRATION_ARTIFACTS = Object.freeze([
  {
    path: 'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
    owner: 'policy-builder-ui',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Policy operator workflow readiness section',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
    owner: 'policy-builder-ui',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Policy migration verifier outside the normal workflow',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/composables/usePolicyIntentImpactPreview.js',
    owner: 'policy-builder-ui',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Policy migration comparison service',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/composables/usePolicyIntentReplayPreview.js',
    owner: 'policy-builder-ui',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Policy migration verifier service',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/utils/policyIntentImpactPreview.js',
    owner: 'policy-builder-ui',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Server-owned migration comparison projection',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/utils/policyIntentReplayPreview.js',
    owner: 'policy-builder-ui',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Server-owned migration replay verifier projection',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js',
    owner: 'policy-builder-ui-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Policy workflow and migration-verifier regression tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
    owner: 'policy-builder-ui-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Policy workflow and migration-verifier regression tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/__tests__/composables/usePolicyIntentImpactPreview.test.js',
    owner: 'policy-builder-ui-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Server-owned migration comparison tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/__tests__/composables/usePolicyIntentReplayPreview.test.js',
    owner: 'policy-builder-ui-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Server-owned migration replay-verifier tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/__tests__/utils/policyIntentImpactPreview.test.js',
    owner: 'policy-builder-ui-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Server-owned migration comparison tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'client/src/__tests__/utils/policyIntentReplayPreview.test.js',
    owner: 'policy-builder-ui-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Server-owned migration replay-verifier tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/routes/policiesRouteMigrationVerifier.mjs',
    owner: 'policy-builder-api',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Bounded policy evidence, intent, readiness, and rollback contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentImpactPreview.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Bounded policy evidence, intent, readiness, and rollback contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyImpactPreviewMigrationVerifier.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Bounded policy evidence, intent, readiness, and rollback contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayPreview.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Bounded policy evidence and readiness contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayScoring.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Bounded policy evidence projection and readiness contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayEngineComparison.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Bounded policy evidence projection and readiness contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayEnrichmentAdapterContract.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Bounded policy evidence and metadata-provider contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayEnrichmentEligibility.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Bounded policy evidence and metadata-provider contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayEvidenceCompleteness.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Bounded policy evidence quality contract',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayExecutionContext.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Read-only migration verifier execution flags',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayItemAdapter.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Policy evidence source adapters with sanitized fields',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayParityDelta.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Bounded policy evidence projection and readiness contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplaySampleDiagnostics.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Bounded policy evidence and readiness contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayProviderReadiness.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: [
      'Policy readiness ignores provider state;',
      'migration verifier may use sanitized enrichment coverage only',
    ].join(' '),
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayTmdbMetadataAdapter.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Bounded policy evidence and metadata-provider contracts',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayTmdbMetadataCoverageComparison.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Verifier-only sanitized metadata coverage comparison',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayTmdbMetadataExecutionSwitch.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Dedicated metadata-provider contracts outside migration verification',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentReplayTmdbProviderClient.mjs',
    owner: 'policy-builder-server',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Dedicated metadata-provider contracts outside migration verification',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayEngineComparison.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Policy migration comparison tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayEnrichmentAdapterContract.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Policy migration verifier contract tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayEnrichmentEligibility.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Policy evidence quality tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayEvidenceCompleteness.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Policy evidence insufficient-state tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayExecutionContext.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Policy migration verifier execution tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayItemAdapter.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Policy evidence adapter tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayParityDelta.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Policy migration delta tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayPreview.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Policy migration replay-verifier tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayProviderReadiness.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Policy readiness tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplaySampleDiagnostics.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
    replacement: 'Policy readiness reason-code tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayScoring.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
    replacement: 'Policy migration comparison tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayTmdbMetadataAdapter.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Policy migration metadata verifier tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayTmdbMetadataCoverageComparison.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Policy migration metadata coverage tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayTmdbMetadataExecutionSwitch.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Policy migration metadata execution-switch tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/__tests__/policyIntentReplayTmdbProviderClient.test.mjs',
    owner: 'policy-builder-server-tests',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    replacement: 'Policy migration provider-client tests',
    normalWorkflowAllowed: false,
    removalGateIds: DEFAULT_REMOVAL_GATES,
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyEvidenceEngine.mjs',
    owner: 'policy-engine',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.NONE,
    replacement: 'Native policy engine contract',
    normalWorkflowAllowed: true,
    removalGateIds: [],
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'server/src/services/policyIntentEngine.mjs',
    owner: 'policy-engine',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.NONE,
    replacement: 'Native policy engine contract',
    normalWorkflowAllowed: true,
    removalGateIds: [],
    rollbackPlan: DEFAULT_ROLLBACK_PLAN,
  },
  {
    path: 'database/schema/current.sql',
    owner: 'database',
    decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.NATIVE_STORAGE_BLOCKER,
    verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.NONE,
    replacement: 'Native intent schema after engine and rollback gates pass',
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

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeQualitySnapshot(quality = null) {
  const normalized = asObject(quality);
  const reasonIds = asArray(normalized.reasonIds)
    .map(reasonId => normalizeString(reasonId))
    .filter(Boolean)
    .sort();

  return {
    version: normalized.version || null,
    statusId: normalized.statusId || null,
    score: Number.isFinite(Number(normalized.score)) ? Number(normalized.score) : null,
    nextActionId: normalized.nextActionId || null,
    reasonIds,
    counts: asObject(normalized.counts),
    hasIdentityEvidence: normalized.hasIdentityEvidence === true,
    hasDeclaredIdentityEvidence: normalized.hasDeclaredIdentityEvidence === true,
    hasObservedIdentityEvidence: normalized.hasObservedIdentityEvidence === true,
    hasStaleProfileEvidence: normalized.hasStaleProfileEvidence === true,
  };
}

function hasQualitySnapshot(quality = null) {
  return Boolean(normalizeQualitySnapshot(quality).statusId);
}

function qualitySnapshotsMatch(left = null, right = null) {
  const leftSnapshot = normalizeQualitySnapshot(left);
  const rightSnapshot = normalizeQualitySnapshot(right);

  return Boolean(leftSnapshot.statusId) &&
    leftSnapshot.version === rightSnapshot.version &&
    leftSnapshot.statusId === rightSnapshot.statusId &&
    leftSnapshot.nextActionId === rightSnapshot.nextActionId &&
    leftSnapshot.reasonIds.join('|') === rightSnapshot.reasonIds.join('|');
}

function listPolicyMigrationDeletionArtifacts() {
  return DEFAULT_MIGRATION_ARTIFACTS;
}

function normalizeMigrationArtifact(artifact = {}) {
  return {
    path: normalizeString(artifact.path),
    owner: normalizeString(artifact.owner),
    decisionId: normalizeString(artifact.decisionId),
    verifierKindId: normalizeString(artifact.verifierKindId) ||
      POLICY_MIGRATION_VERIFIER_KIND_IDS.NONE,
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
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_ARTIFACT_PATH,
      message: 'Migration artifact must include a path.',
    });
  }

  if (!artifact.owner) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_OWNER,
      message: 'Migration artifact must include an owner.',
    });
  }

  if (!DECISION_IDS.includes(artifact.decisionId)) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.UNKNOWN_DECISION,
      message: 'Migration artifact must use a supported decision.',
    });
  }

  if (!VERIFIER_KIND_IDS.includes(artifact.verifierKindId)) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.UNKNOWN_VERIFIER_KIND,
      message: 'Migration artifact must use a supported verifier kind.',
    });
  }

  if (!artifact.replacement) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REPLACEMENT,
      message: 'Migration artifact must name its replacement or reason to keep.',
    });
  }

  if (
    artifact.decisionId === POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION &&
    !artifact.replacement
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.DELETE_TARGET_WITHOUT_REPLACEMENT,
      message: 'Delete-after-migration artifacts must name a replacement.',
    });
  }

  if (
    artifact.decisionId !== POLICY_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE &&
    artifact.removalGateIds.length === 0
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REMOVAL_GATE,
      message: 'Migration and deletion artifacts must define removal gates.',
    });
  }

  if (
    artifact.decisionId !== POLICY_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE &&
    artifact.rollbackPlan.snapshotRequired !== true
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_ROLLBACK_PLAN,
      message: 'Migration and deletion artifacts require rollback snapshots.',
    });
  }

  if (
    artifact.decisionId !== POLICY_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE &&
    (!Number.isFinite(Number(artifact.rollbackPlan.retentionWindowDays)) ||
      Number(artifact.rollbackPlan.retentionWindowDays) <= 0)
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_RETENTION_WINDOW,
      message: 'Migration and deletion artifacts require an explicit rollback retention window.',
    });
  }

  if (
    artifact.normalWorkflowAllowed === true &&
    artifact.decisionId !== POLICY_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.NORMAL_FLOW_DIAGNOSTIC_SURFACE,
      message: 'Legacy diagnostic or migration verifier artifacts cannot stay in the normal workflow.',
    });
  }

  if (
    artifact.decisionId === POLICY_MIGRATION_ARTIFACT_DECISION_IDS.NATIVE_STORAGE_BLOCKER &&
    artifact.rollbackPlan.nativeStorageMigrationAllowed === true
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.STORAGE_MIGRATION_BEFORE_ENGINE_STABILITY,
      message: 'Native storage migration must remain blocked until policy engine gates pass.',
    });
  }

  return {
    ok: issues.length === 0,
    artifact,
    issues,
  };
}

function buildPolicyMigrationDeletionPlan({
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
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REQUIRED_GATE,
      message: `Migration plan is missing required gate "${gateId}".`,
    }));
  const nativeStorageIssues = rollbackPlan.nativeStorageMigrationAllowed === true
    ? [{
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.NATIVE_STORAGE_NOT_BLOCKED,
      message: 'Native storage migration must remain blocked by policy engine gates.',
    }]
    : [];
  const issues = [
    ...artifactIssues,
    ...gateIssues,
    ...nativeStorageIssues,
  ];

  return {
    version: 'policy.migration_deletion_path.v1',
    stepId: 'migration_deletion_path',
    requiredGateIds: gateIds,
    rollbackPlan: {
      ...DEFAULT_ROLLBACK_PLAN,
      ...rollbackPlan,
      nativeStorageMigrationAllowed: rollbackPlan.nativeStorageMigrationAllowed === true,
    },
    artifacts: normalizedArtifacts,
    normalWorkflowAllowsDiagnostics: false,
    nativeStorageMigrationBlocked: rollbackPlan.nativeStorageMigrationAllowed !== true,
    validation: {
      ok: issues.length === 0,
      issueCount: issues.length,
      issues,
    },
  };
}

function getWorkflowIntentFingerprint(boundedWorkflowResult = {}) {
  return boundedWorkflowResult?.boundaryContext?.intentBoundary?.projectionFingerprint?.fingerprint ||
    boundedWorkflowResult?.workflow?.boundaryContext?.intentBoundary?.projectionFingerprint?.fingerprint ||
    null;
}

function getWorkflowReadinessFingerprint(boundedWorkflowResult = {}) {
  return boundedWorkflowResult?.boundaryContext?.readinessBoundary?.projectionFingerprint?.fingerprint ||
    boundedWorkflowResult?.workflow?.boundaryContext?.readinessBoundary?.projectionFingerprint?.fingerprint ||
    null;
}

function boundedWorkflowAuditPasses(boundedWorkflowResult = {}) {
  return boundedWorkflowResult?.workflowAudit?.ok === true;
}

function getWorkflowBoundaryContext(boundedWorkflowResult = {}) {
  return asObject(
    boundedWorkflowResult.boundaryContext ||
    boundedWorkflowResult.workflow?.boundaryContext
  );
}

function getEmbeddedWorkflowBoundaryContext(boundedWorkflowResult = {}) {
  return asObject(boundedWorkflowResult.workflow?.boundaryContext);
}

function validateBoundedWorkflowDecisionSource(boundedWorkflowResult = {}) {
  const workflowBoundary = getWorkflowBoundaryContext(boundedWorkflowResult);
  const embeddedWorkflowBoundary = getEmbeddedWorkflowBoundaryContext(boundedWorkflowResult);

  return validatePolicyDecisionHandoffAdmission({
    decisionSourceAdmission: boundedWorkflowResult.decisionSourceAdmission,
    readinessBoundaryDecisionSource:
      workflowBoundary.readinessBoundary?.decisionSource,
    embeddedReadinessDecisionSource:
      embeddedWorkflowBoundary.readinessBoundary?.decisionSource,
  });
}

function getWorkflowBoundaryQualities(boundaryContext = {}) {
  const context = asObject(boundaryContext);
  return [
    context.intentBoundary?.quality,
    context.readinessBoundary?.evidenceQuality,
    context.readinessBoundary?.intentQuality,
    context.readinessBoundary?.learningQuality,
  ];
}

function collectBoundedWorkflowQualityIssues(boundedWorkflowResult = {}) {
  const issues = [];
  const sourceBoundary = getWorkflowBoundaryContext(boundedWorkflowResult);
  const embeddedBoundary = getEmbeddedWorkflowBoundaryContext(boundedWorkflowResult);
  const qualityValues = [
    ...getWorkflowBoundaryQualities(sourceBoundary),
    ...getWorkflowBoundaryQualities(embeddedBoundary),
  ];

  if (
    qualityValues.length === 0 ||
    qualityValues.some(quality => !hasQualitySnapshot(quality))
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
      message: 'Migration planning requires sanitized workflow quality snapshots.',
    });
    return issues;
  }

  const normalizedQualities = qualityValues.map(quality => normalizeQualitySnapshot(quality));
  const insufficientQuality = normalizedQualities.find(quality =>
    quality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT
  );

  if (insufficientQuality) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_QUALITY_INSUFFICIENT,
      message: 'Migration planning requires usable bounded workflow quality.',
      qualityStatusId: insufficientQuality.statusId,
      nextActionId: insufficientQuality.nextActionId,
      reasonIds: insufficientQuality.reasonIds,
    });
  }

  const referenceQuality = qualityValues[0];
  const qualityMismatch = qualityValues.some(quality =>
    !qualitySnapshotsMatch(referenceQuality, quality)
  );

  if (
    qualityMismatch ||
    sourceBoundary.qualityMatch !== true ||
    embeddedBoundary.qualityMatch !== true
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_QUALITY_MISMATCH,
      message: 'Migration planning requires bounded workflow quality to match across workflow contexts.',
    });
  }

  return issues;
}

function collectMigrationBoundaryContextDecisionSourceIssues(boundaryContext = {}) {
  const context = asObject(boundaryContext);
  if (!Object.keys(context).length) return [];

  const sourceAudit = validatePolicyDecisionHandoffSourceSummary(
    context.workflowBoundary?.decisionSource
  );

  return sourceAudit.ok
    ? []
    : [{
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.INVALID_MIGRATION_DECISION_SOURCE,
        message: 'Migration planning context must retain an approved decision-source summary.',
        sourceRiskIds: sourceAudit.issues.map(issue => issue.riskId),
      }];
}

function buildBoundedMigrationContext({
  boundedWorkflowResult,
  decisionSourceProvenanceAudit,
} = {}) {
  const intentFingerprint = getWorkflowIntentFingerprint(boundedWorkflowResult);
  const readinessFingerprint = getWorkflowReadinessFingerprint(boundedWorkflowResult);
  const sourceBoundary = getWorkflowBoundaryContext(boundedWorkflowResult);

  if (!intentFingerprint || !readinessFingerprint || !Object.keys(sourceBoundary).length) {
    return null;
  }

  return {
    workflowBoundary: {
      statusId: boundedWorkflowResult.statusId || null,
      workflowVersion: boundedWorkflowResult.workflow?.version || null,
      workflowId: boundedWorkflowResult.workflow?.workflowId || null,
      workflowAuditOk: boundedWorkflowAuditPasses(boundedWorkflowResult),
      readinessStateId: boundedWorkflowResult.workflow?.readiness?.stateId || null,
      decisionSource: {
        sourceId: decisionSourceProvenanceAudit?.sourceId || null,
        decisionVersion: decisionSourceProvenanceAudit?.decisionVersion || null,
        admitted: decisionSourceProvenanceAudit?.ok === true,
      },
      quality: normalizeQualitySnapshot(sourceBoundary.intentBoundary?.quality),
      qualityMatch: collectBoundedWorkflowQualityIssues(boundedWorkflowResult).length === 0,
      projectionFingerprint:
        sourceBoundary.intentBoundary?.projectionFingerprint ||
        sourceBoundary.readinessBoundary?.projectionFingerprint ||
        null,
    },
    projectionFingerprintMatch:
      intentFingerprint === readinessFingerprint &&
      sourceBoundary.projectionFingerprintMatch === true,
  };
}

function buildPolicyMigrationDeletionPlanFromBoundedWorkflow({
  boundedWorkflowResult,
  artifacts = DEFAULT_MIGRATION_ARTIFACTS,
  requiredGateIds = REQUIRED_GATE_IDS,
  rollbackPlan = DEFAULT_ROLLBACK_PLAN,
} = {}) {
  const boundaryIssues = [];
  const decisionSourceProvenanceAudit =
    boundedWorkflowResult?.ok === true && boundedWorkflowResult?.workflow
      ? validateBoundedWorkflowDecisionSource(boundedWorkflowResult)
      : null;

  if (boundedWorkflowResult?.ok !== true || !boundedWorkflowResult?.workflow) {
    boundaryIssues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_BOUNDED_WORKFLOW,
      message: 'Migration planning requires a successful bounded operator workflow result.',
    });
  }

  if (
    boundedWorkflowResult?.ok === true &&
    boundedWorkflowResult?.workflow &&
    !boundedWorkflowAuditPasses(boundedWorkflowResult)
  ) {
    boundaryIssues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_WORKFLOW_AUDIT_NOT_PASSING,
      message: 'Migration planning requires a passing bounded operator workflow audit.',
    });
  }

  if (decisionSourceProvenanceAudit?.ok !== true) {
    boundaryIssues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.UNAPPROVED_BOUNDED_DECISION_SOURCE,
      message: 'Migration planning requires matching approved decision-source provenance from the bounded workflow.',
      sourceRiskIds: decisionSourceProvenanceAudit?.issues.map(issue => issue.riskId) || [],
    });
  }

  if (
    boundedWorkflowResult?.ok === true &&
    boundedWorkflowResult?.workflow
  ) {
    boundaryIssues.push(...collectBoundedWorkflowQualityIssues(boundedWorkflowResult));
  }

  const boundaryContext = buildBoundedMigrationContext({
    boundedWorkflowResult,
    decisionSourceProvenanceAudit,
  });

  if (!boundaryContext) {
    boundaryIssues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_BOUNDED_PROVENANCE,
      message: 'Migration planning requires bounded workflow provenance.',
    });
  } else if (boundaryContext.projectionFingerprintMatch !== true) {
    boundaryIssues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_PROVENANCE_MISMATCH,
      message: 'Migration planning requires workflow intent and readiness to share evidence provenance.',
    });
  }

  if (boundaryIssues.length > 0) {
    return {
      ok: false,
      statusId: POLICY_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
      boundaryContext,
      plan: null,
      migrationAudit: null,
      issueCount: boundaryIssues.length,
      issues: boundaryIssues,
      nextStep: null,
    };
  }

  const plan = buildPolicyMigrationDeletionPlan({
    artifacts,
    requiredGateIds,
    rollbackPlan,
  });
  plan.boundaryContext = boundaryContext;
  plan.engineContractBoundary = {
    boundedWorkflowRequired: true,
    workflowVersion: boundedWorkflowResult.workflow.version,
    workflowId: boundedWorkflowResult.workflow.workflowId,
  };
  const migrationAudit = buildPolicyMigrationDeletionAudit(plan);
  const ok = migrationAudit.ok === true;

  return {
    ok,
    statusId: ok
      ? POLICY_MIGRATION_BOUNDARY_STATUS_IDS.READY
      : POLICY_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_MIGRATION_AUDIT,
    boundaryContext,
    plan,
    migrationAudit,
    issueCount: migrationAudit.issueCount,
    issues: migrationAudit.validation.issues,
    nextStep: ok ? migrationAudit.nextStep : null,
  };
}

function validatePolicyMigrationDeletionPlan(plan = {}) {
  const artifacts = asArray(plan.artifacts);
  const artifactValidation = artifacts.map(validateMigrationArtifact);
  const issues = artifactValidation.flatMap(result => result.issues);

  REQUIRED_GATE_IDS
    .filter(gateId => !asArray(plan.requiredGateIds).includes(gateId))
    .forEach(gateId => {
      issues.push({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REQUIRED_GATE,
        message: `Migration plan is missing required gate "${gateId}".`,
      });
    });

  if (plan.normalWorkflowAllowsDiagnostics === true) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.NORMAL_FLOW_DIAGNOSTIC_SURFACE,
      message: 'Migration diagnostics cannot remain in the normal operator workflow.',
    });
  }

  if (plan.nativeStorageMigrationBlocked !== true) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.NATIVE_STORAGE_NOT_BLOCKED,
      message: 'Native storage migration must be blocked until engine and rollback gates pass.',
    });
  }

  if (plan.rollbackPlan?.snapshotRequired !== true ||
      plan.rollbackPlan?.restorePathRequired !== true) {
    issues.push({
      riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_ROLLBACK_PLAN,
      message: 'Migration plan must require backup snapshots and a restore path.',
    });
  }

  issues.push(...collectMigrationBoundaryContextDecisionSourceIssues(plan.boundaryContext));

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    artifactCount: artifacts.length,
    issues,
  };
}

function buildPolicyMigrationDeletionAudit(
  plan = buildPolicyMigrationDeletionPlan()
) {
  const validation = validatePolicyMigrationDeletionPlan(plan);
  const deleteCount = asArray(plan.artifacts).filter(artifact =>
    artifact.decisionId === POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION
  ).length;

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedArtifactCount: validation.artifactCount,
    deleteCount,
    validation,
    nextStep: {
      stepId: 'runtime_decision_inventory',
      label: 'Policy Runtime Decision Inventory',
      reason: 'Policy engine and workflow contracts now have an explicit migration/deletion path, so runtime classification, routing, question, and learning paths can be inventoried against those contracts.',
    },
  };
}

export {
  POLICY_MIGRATION_ARTIFACT_DECISION_IDS,
  POLICY_MIGRATION_BOUNDARY_STATUS_IDS,
  POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS,
  POLICY_MIGRATION_GATE_IDS,
  POLICY_MIGRATION_VERIFIER_KIND_IDS,
  buildPolicyMigrationDeletionAudit,
  buildPolicyMigrationDeletionPlan,
  buildPolicyMigrationDeletionPlanFromBoundedWorkflow,
  listPolicyMigrationDeletionArtifacts,
  validateMigrationArtifact,
  validatePolicyMigrationDeletionPlan,
};
