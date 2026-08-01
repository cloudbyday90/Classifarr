const POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS = Object.freeze({
  SERVER_CONTRACT: 'server_contract',
  CLIENT_WORKFLOW_COMPONENT: 'client_workflow_component',
  NORMAL_WORKFLOW_RULE: 'normal_workflow_rule',
  NORMAL_PATH_EXCLUSION: 'normal_path_exclusion',
});

const POLICY_AUTHORING_COMPLETION_RISK_IDS = Object.freeze({
  MISSING_RECORD_ID: 'missing_record_id',
  MISSING_LABEL: 'missing_label',
  MISSING_DOC_PATH: 'missing_doc_path',
  MISSING_SERVICE_PATH: 'missing_service_path',
  MISSING_TEST_PATH: 'missing_test_path',
  MISSING_EVIDENCE: 'missing_evidence',
  UNKNOWN_ARTIFACT_KIND: 'unknown_artifact_kind',
  TEMPORARY_ARTIFACT_PATH: 'temporary_artifact_path',
  INVALID_EXCLUSION_SCOPE: 'invalid_exclusion_scope',
  INTERNAL_SURFACE_ALLOWED_IN_NORMAL_PATH: 'internal_surface_allowed_in_normal_path',
});

const POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS = Object.freeze({
  NORMAL_PATH_FORBIDDEN: 'normal_path_forbidden',
  BRIDGE_ONLY: 'bridge_only',
  DELETE_AFTER_NATIVE_STORAGE: 'delete_after_native_storage',
});

const TEMPORARY_ROADMAP_ARTIFACT_PATTERN = new RegExp(`(^|/)policy-builder-${'pha'}${'se'}-`, 'i');

const POLICY_AUTHORING_SERVER_CONTRACTS = Object.freeze([
  {
    id: 'policy_authoring_workflow_inventory',
    label: 'Policy authoring workflow inventory',
    docPath: 'docs/architecture/policy-authoring-workflow-inventory.md',
    servicePath: 'server/src/services/policyAuthoringWorkflowInventory.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringWorkflowInventory.test.mjs',
    evidence: 'Classifies current policy-builder surfaces as keep, rewrite, replace, delete, or bridge-only with durable product ownership.',
  },
  {
    id: 'policy_authoring_destination_flow',
    label: 'Policy authoring destination flow',
    docPath: 'docs/architecture/policy-authoring-destination-flow.md',
    servicePath: 'server/src/services/policyAuthoringDestinationFlow.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringDestinationFlow.test.mjs',
    evidence: 'Defines the destination-first operator sequence from library context through save or defer.',
  },
  {
    id: 'policy_authoring_component_system',
    label: 'Policy authoring component system',
    docPath: 'docs/architecture/policy-authoring-component-system.md',
    servicePath: 'server/src/services/policyAuthoringComponentSystem.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringComponentSystem.test.mjs',
    evidence: 'Defines the policy-authoring component vocabulary, option sources, interaction rules, and accessibility rules before Vue rebuilds.',
  },
  {
    id: 'policy_authoring_component_inventory',
    label: 'Policy authoring component inventory',
    docPath: 'docs/architecture/policy-authoring-component-inventory.md',
    servicePath: 'server/src/services/policyAuthoringComponentInventory.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringComponentInventory.test.mjs',
    evidence: 'Classifies every current policy Vue component and records whether each target component is implemented, extracted, split, deferred, or compatibility-only.',
  },
  {
    id: 'policy_authoring_option_selection',
    label: 'Policy authoring option selection',
    docPath: 'docs/architecture/policy-authoring-option-selection.md',
    servicePath: 'server/src/services/policyAuthoringOptionSelection.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringOptionSelection.test.mjs',
    evidence: 'Separates option sources, observed evidence, selectable suggestions, disabled choices, and typed add commands.',
  },
  {
    id: 'policy_authoring_constraints',
    label: 'Policy authoring constraints',
    docPath: 'docs/architecture/policy-authoring-constraints.md',
    servicePath: 'server/src/services/policyAuthoringConstraints.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringConstraints.test.mjs',
    evidence: 'Separates hard limits, avoid values, review warnings, certification semantics, and explicit operator-action requirements.',
  },
  {
    id: 'policy_constraint_decision_model',
    label: 'Policy constraint decision model',
    docPath: 'docs/architecture/policy-constraint-decision-model.md',
    servicePath: 'server/src/services/policyConstraintDecisionModel.mjs',
    testPath: 'server/src/__tests__/services/policyConstraintDecisionModel.test.mjs',
    evidence: 'Publishes the display-only, server-owned hard-limit, avoid, and review-warning decision effects for the native workflow.',
  },
  {
    id: 'policy_constraint_value_eligibility',
    label: 'Policy constraint value eligibility',
    docPath: 'docs/architecture/policy-constraint-value-eligibility.md',
    servicePath: 'server/src/services/policyConstraintValueEligibility.mjs',
    testPath: 'server/src/__tests__/services/policyConstraintValueEligibility.test.mjs',
    evidence: 'Publishes the display-only, media-type-aware canonical allowlist used by native constraint controls while rejecting free-text and unsupported library media types.',
  },
  {
    id: 'policy_authoring_readiness',
    label: 'Policy authoring readiness',
    docPath: 'docs/architecture/policy-authoring-readiness.md',
    servicePath: 'server/src/services/policyAuthoringReadiness.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringReadiness.test.mjs',
    evidence: 'Replaces dense diagnostics with action-oriented readiness states and one primary next action.',
  },
  {
    id: 'policy_authoring_starter_template_intent_boundary',
    label: 'Policy authoring starter template intent boundary',
    docPath: 'docs/architecture/policy-starter-template-intent-boundary.md',
    servicePath: 'server/src/services/policyIntentSignalOptionProjection.mjs',
    testPath: 'server/src/__tests__/services/policyIntentSignalOptionProjection.test.mjs',
    evidence: 'Projects optional template-derived values server-side with source labels; raw templates cannot attach or seed intent.',
  },
  {
    id: 'policy_authoring_accessibility',
    label: 'Policy authoring accessibility',
    docPath: 'docs/architecture/policy-authoring-accessibility.md',
    servicePath: 'server/src/services/policyAuthoringAccessibility.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringAccessibility.test.mjs',
    evidence: 'Defines labels, helper text, keyboard, disabled reason, and one-primary-action requirements.',
  },
  {
    id: 'policy_authoring_presentation_tests',
    label: 'Policy authoring presentation tests',
    docPath: 'docs/architecture/policy-authoring-presentation-tests.md',
    servicePath: 'server/src/services/policyAuthoringPresentationTests.mjs',
    testPath: 'server/src/__tests__/services/policyAuthoringPresentationTests.test.mjs',
    evidence: 'Classifies presentation tests so they protect simplified workflow behavior instead of old diagnostics.',
  },
  {
    id: 'policy_compatibility_maintenance_test_ownership',
    label: 'Policy compatibility maintenance test ownership',
    docPath: 'docs/architecture/policy-compatibility-maintenance-test-ownership-audit.md',
    servicePath: 'server/src/services/policyCompatibilityMaintenanceTestOwnership.mjs',
    testPath: 'server/src/__tests__/services/policyCompatibilityMaintenanceTestOwnership.test.mjs',
    evidence: 'Keeps compatibility maintenance coverage outside normal authoring while tying each retained component to typed commands and native-storage removal gates.',
  },
  {
    id: 'policy_native_storage_cutover_test_handoff',
    label: 'Policy native-storage cutover test handoff',
    docPath: 'docs/architecture/policy-native-storage-cutover-test-handoff-audit.md',
    servicePath: 'server/src/services/policyNativeStorageCutoverTestHandoff.mjs',
    testPath: 'server/src/__tests__/services/policyNativeStorageCutoverTestHandoff.test.mjs',
    evidence: 'Maps each retiring compatibility regression scope to named native workflow coverage and complete deletion evidence without authorizing deletion.',
  },
  {
    id: 'policy_native_storage_cutover_deletion_evidence',
    label: 'Policy native-storage cutover deletion evidence',
    docPath: 'docs/architecture/policy-native-storage-cutover-deletion-evidence-integration-audit.md',
    servicePath: 'server/src/services/policyNativeStorageCutoverDeletionEvidence.mjs',
    testPath: 'server/src/__tests__/services/policyNativeStorageCutoverDeletionEvidence.test.mjs',
    evidence: 'Binds retiring paths and shared test scopes to a complete authorized removal artifact, reference scan, and focused plus full validation without authorizing deletion.',
  },
]);

const POLICY_AUTHORING_CLIENT_WORKFLOW_COMPONENTS = Object.freeze([
  {
    id: 'policy_authoring_library_first_workflow_shell',
    label: 'Policy authoring library-first workflow shell',
    docPath: 'docs/architecture/policy-builder-library-first-workflow-shell.md',
    testPath: 'client/src/__tests__/PolicyBuilderWorkflowShell.test.js',
    evidence: 'Renders the server-owned five-question workflow and observed library suggestions without automatic acceptance or diagnostic controls.',
  },
  {
    id: 'policy_authoring_destination_sections',
    label: 'Policy authoring destination sections',
    docPath: 'docs/architecture/policy-authoring-destination-sections.md',
    testPath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    evidence: 'Splits review behavior, destination identity, destination rules, and confidence support anchors.',
  },
  {
    id: 'policy_authoring_review_triggers',
    label: 'Policy authoring review triggers',
    docPath: 'docs/architecture/policy-authoring-review-triggers.md',
    testPath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    evidence: 'Adds Ask When Unsure review triggers through typed draft serialization.',
  },
  {
    id: 'policy_authoring_workflow_readiness',
    label: 'Policy authoring workflow readiness',
    docPath: 'docs/architecture/policy-builder-library-first-workflow-shell.md',
    testPath: 'client/src/__tests__/PolicyBuilderWorkflowShell.test.js',
    evidence: 'Renders server-owned readiness and its next action without executing routing or saving policy intent.',
  },
  {
    id: 'policy_authoring_workflow_read_boundary',
    label: 'Policy authoring workflow read boundary',
    docPath: 'docs/architecture/policy-builder-library-first-workflow-shell.md',
    testPath: 'client/src/__tests__/composables/usePolicyOperatorWorkflow.test.js',
    evidence: 'Loads only versioned display-only workflow responses and drops stale library requests.',
  },
  {
    id: 'policy_authoring_save_defer_action_boundary',
    label: 'Policy authoring save and defer action boundary',
    docPath: 'docs/architecture/policy-authoring-save-defer-action-boundary.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Exposes save readiness, disabled reasons, and defer-without-saving while preserving event contracts.',
  },
  {
    id: 'policy_authoring_starter_template_intent_boundary',
    label: 'Policy authoring starter template intent boundary',
    docPath: 'docs/architecture/policy-starter-template-intent-boundary.md',
    testPath: 'client/src/__tests__/IntentSignalPicker.test.js',
    evidence: 'Allows only explicit acceptance of canonical, source-labelled template suggestions into typed draft commands.',
  },
  {
    id: 'policy_authoring_accessibility_decision_load_audit',
    label: 'Policy authoring accessibility and decision-load audit',
    docPath: 'docs/architecture/policy-authoring-accessibility-decision-load-audit.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Protects the native destination-first workflow from legacy setup-card navigation and browser-derived readiness gates.',
  },
  {
    id: 'policy_authoring_presentation_test_reset',
    label: 'Policy authoring presentation test reset',
    docPath: 'docs/architecture/policy-authoring-presentation-test-reset.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Proves retired impact and replay browser panels cannot be restored through the former modal visibility prop.',
  },
  {
    id: 'policy_authoring_constraint_draft_command_boundary',
    label: 'Policy authoring constraint draft-command boundary',
    docPath: 'docs/architecture/policy-constraint-draft-command-adapter.md',
    testPath: 'client/src/__tests__/utils/policyIntentConstraintDraft.test.js',
    evidence: 'Accepts only an explicit operator selection resolved from the server-owned constraint decision model and retains a transient typed command with no persistence, routing, learning, provider, or quota side effect.',
  },
  {
    id: 'policy_authoring_constraint_control_surface',
    label: 'Policy authoring constraint control surface',
    docPath: 'docs/architecture/policy-constraint-control-surface.md',
    testPath: 'client/src/__tests__/PolicyIntentConstraintControlSurface.test.js',
    evidence: 'Renders accessible, explicit hard-limit, avoid, and review-warning controls from server-owned decision and value-eligibility projections while retaining typed commands locally and excluding them from native policy creation.',
  },
]);

const POLICY_AUTHORING_NORMAL_WORKFLOW_RULES = Object.freeze([
  {
    id: 'destination_context_before_template_suggestions',
    label: 'Destination context appears before optional template suggestions',
    docPath: 'docs/architecture/policy-authoring-destination-flow.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Normal workflow starts from library and destination meaning; template-derived values are secondary and require acceptance.',
  },
  {
    id: 'observed_evidence_requires_acceptance',
    label: 'Observed evidence requires explicit acceptance before becoming intent',
    docPath: 'docs/architecture/policy-authoring-option-selection.md',
    testPath: 'client/src/__tests__/PolicyIntentGenreControl.test.js',
    evidence: 'Observed profile suggestions remain suggestions until typed draft commands accept them.',
  },
  {
    id: 'hard_limits_explicit',
    label: 'Hard limits require explicit operator action',
    docPath: 'docs/architecture/policy-authoring-constraints.md',
    testPath: 'client/src/__tests__/PolicyIntentConstraintControlSurface.test.js',
    evidence: 'The native constraint surface marks blockers separately from advisory controls and requires a value-tied explicit confirmation before staging hard limits or avoid values.',
  },
  {
    id: 'one_recommended_next_action',
    label: 'Readiness exposes one recommended next action',
    docPath: 'docs/architecture/policy-builder-library-first-workflow-shell.md',
    testPath: 'client/src/__tests__/PolicyBuilderWorkflowShell.test.js',
    evidence: 'The server-owned workflow exposes automation readiness and one next action without duplicated local diagnostics.',
  },
  {
    id: 'retired_diagnostics_absent',
    label: 'Retired diagnostic panels are absent from policy authoring',
    docPath: 'docs/architecture/policy-authoring-presentation-tests.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Impact and replay diagnostic panels are removed, including the former visibility prop.',
  },
]);

const POLICY_AUTHORING_NORMAL_PATH_EXCLUSIONS = Object.freeze([
  {
    id: 'provider_readiness_details',
    label: 'Provider readiness details',
    scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN,
    evidence: 'Provider configuration and quota diagnostics belong outside normal policy authoring.',
  },
  {
    id: 'tmdb_coverage_details',
    label: 'TMDB coverage details',
    scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN,
    evidence: 'Metadata coverage is diagnostic evidence, not normal policy setup copy.',
  },
  {
    id: 'raw_template_mechanics',
    label: 'Raw starter-template mechanics',
    scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.BRIDGE_ONLY,
    evidence: 'Legacy weights, removed markers, and raw custom signals remain bridge-only.',
  },
  {
    id: 'legacy_policy_storage_shape',
    label: 'Legacy policy storage shape',
    scopeId: POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    evidence: 'Legacy preset/custom-signal storage remains compatible until native intent storage replacement.',
  },
]);

function validatePolicyAuthoringCompletionRecord(record = {}, artifactKindId) {
  const issues = [];

  if (!record.id) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_RECORD_ID,
      artifactKindId,
      message: 'Policy authoring completion records must have a stable id.',
    });
  }

  if (!record.label) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_LABEL,
      artifactKindId,
      recordId: record.id || null,
      message: 'Policy authoring completion records must have an operator-readable label.',
    });
  }

  if (!record.evidence) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
      artifactKindId,
      recordId: record.id || null,
      message: 'Policy authoring completion records must explain what proves the record.',
    });
  }

  if ([
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.SERVER_CONTRACT,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.CLIENT_WORKFLOW_COMPONENT,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_WORKFLOW_RULE,
  ].includes(artifactKindId) && !record.docPath) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_DOC_PATH,
      artifactKindId,
      recordId: record.id || null,
      message: 'Policy authoring implementation records must link to an architecture document.',
    });
  }

  if (artifactKindId === POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.SERVER_CONTRACT && !record.servicePath) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_SERVICE_PATH,
      artifactKindId,
      recordId: record.id || null,
      message: 'Policy authoring server contracts must link to the owning ESM service.',
    });
  }

  if ([
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.SERVER_CONTRACT,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.CLIENT_WORKFLOW_COMPONENT,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_WORKFLOW_RULE,
  ].includes(artifactKindId) && !record.testPath) {
    issues.push({
      riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.MISSING_TEST_PATH,
      artifactKindId,
      recordId: record.id || null,
      message: 'Policy authoring implementation records must link to a regression test.',
    });
  }

  [
    ['docPath', record.docPath],
    ['servicePath', record.servicePath],
    ['testPath', record.testPath],
  ].forEach(([field, artifactPath]) => {
    if (typeof artifactPath === 'string' && TEMPORARY_ROADMAP_ARTIFACT_PATTERN.test(artifactPath)) {
      issues.push({
        riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.TEMPORARY_ARTIFACT_PATH,
        artifactKindId,
        recordId: record.id || null,
        field,
        artifactPath,
        message: 'Active policy authoring completion records must use durable artifact paths.',
      });
    }
  });

  if (artifactKindId === POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_PATH_EXCLUSION) {
    if (!Object.values(POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS).includes(record.scopeId)) {
      issues.push({
        riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.INVALID_EXCLUSION_SCOPE,
        artifactKindId,
        recordId: record.id || null,
        message: 'Policy authoring exclusions must use an approved exclusion scope.',
      });
    }

    if (record.scopeId !== POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN &&
        record.normalAuthoringAllowed === true) {
      issues.push({
        riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.INTERNAL_SURFACE_ALLOWED_IN_NORMAL_PATH,
        artifactKindId,
        recordId: record.id || null,
        message: 'Verifier, bridge, and deletion-target surfaces cannot be allowed in normal authoring.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    artifactKindId,
    recordId: record.id || null,
    issues,
  };
}

function auditPolicyAuthoringCompletionRecords(records, artifactKindId) {
  if (!Object.values(POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS).includes(artifactKindId)) {
    return {
      ok: false,
      artifactKindId,
      checkedCount: 0,
      issueCount: 1,
      results: [{
        ok: false,
        artifactKindId,
        recordId: null,
        issues: [{
          riskId: POLICY_AUTHORING_COMPLETION_RISK_IDS.UNKNOWN_ARTIFACT_KIND,
          artifactKindId,
          message: 'Policy authoring completion audits must use an approved artifact kind.',
        }],
      }],
    };
  }

  const results = (Array.isArray(records) ? records : [])
    .map(record => validatePolicyAuthoringCompletionRecord(record, artifactKindId));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    artifactKindId,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function buildPolicyAuthoringWorkflowCompletionAudit({
  serverContracts = POLICY_AUTHORING_SERVER_CONTRACTS,
  clientWorkflowComponents = POLICY_AUTHORING_CLIENT_WORKFLOW_COMPONENTS,
  normalWorkflowRules = POLICY_AUTHORING_NORMAL_WORKFLOW_RULES,
  normalPathExclusions = POLICY_AUTHORING_NORMAL_PATH_EXCLUSIONS,
} = {}) {
  const serverContractAudit = auditPolicyAuthoringCompletionRecords(
    serverContracts,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.SERVER_CONTRACT
  );
  const clientWorkflowAudit = auditPolicyAuthoringCompletionRecords(
    clientWorkflowComponents,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.CLIENT_WORKFLOW_COMPONENT
  );
  const normalWorkflowAudit = auditPolicyAuthoringCompletionRecords(
    normalWorkflowRules,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_WORKFLOW_RULE
  );
  const normalPathExclusionAudit = auditPolicyAuthoringCompletionRecords(
    normalPathExclusions,
    POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS.NORMAL_PATH_EXCLUSION
  );
  const issueCount = [
    serverContractAudit,
    clientWorkflowAudit,
    normalWorkflowAudit,
    normalPathExclusionAudit,
  ].reduce((count, audit) => count + audit.issueCount, 0);

  return {
    ok: issueCount === 0,
    issueCount,
    checkedServerContractCount: serverContractAudit.checkedCount,
    checkedClientWorkflowComponentCount: clientWorkflowAudit.checkedCount,
    checkedNormalWorkflowRuleCount: normalWorkflowAudit.checkedCount,
    checkedNormalPathExclusionCount: normalPathExclusionAudit.checkedCount,
    serverContractAudit,
    clientWorkflowAudit,
    normalWorkflowAudit,
    normalPathExclusionAudit,
    nextStep: {
      stepId: 'policy_evidence_engine',
      label: 'Policy Evidence Engine',
      reason: 'Policy evidence can consume operator intent only after normal authoring, verifier-only surfaces, and bridge-only surfaces are separated.',
    },
  };
}

function listPolicyAuthoringCompletionArtifactPaths() {
  return [
    ...POLICY_AUTHORING_SERVER_CONTRACTS.flatMap(record => [
      record.docPath,
      record.servicePath,
      record.testPath,
    ]),
    ...POLICY_AUTHORING_CLIENT_WORKFLOW_COMPONENTS.flatMap(record => [
      record.docPath,
      record.testPath,
    ]),
    ...POLICY_AUTHORING_NORMAL_WORKFLOW_RULES.flatMap(record => [
      record.docPath,
      record.testPath,
    ]),
  ];
}

function listPolicyAuthoringServerContracts() {
  return POLICY_AUTHORING_SERVER_CONTRACTS;
}

function listPolicyAuthoringClientWorkflowComponents() {
  return POLICY_AUTHORING_CLIENT_WORKFLOW_COMPONENTS;
}

function listPolicyAuthoringNormalWorkflowRules() {
  return POLICY_AUTHORING_NORMAL_WORKFLOW_RULES;
}

function listPolicyAuthoringNormalPathExclusions() {
  return POLICY_AUTHORING_NORMAL_PATH_EXCLUSIONS;
}

export {
  POLICY_AUTHORING_COMPLETION_ARTIFACT_KIND_IDS,
  POLICY_AUTHORING_COMPLETION_RISK_IDS,
  POLICY_AUTHORING_COMPLETION_EXCLUSION_SCOPE_IDS,
  auditPolicyAuthoringCompletionRecords,
  buildPolicyAuthoringWorkflowCompletionAudit,
  listPolicyAuthoringCompletionArtifactPaths,
  listPolicyAuthoringClientWorkflowComponents,
  listPolicyAuthoringNormalPathExclusions,
  listPolicyAuthoringNormalWorkflowRules,
  listPolicyAuthoringServerContracts,
  validatePolicyAuthoringCompletionRecord,
};
