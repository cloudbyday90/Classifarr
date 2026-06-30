const PHASE3R_ARTIFACT_KIND_IDS = Object.freeze({
  SERVER_CONTRACT: 'server_contract',
  VUE_REWRITE_SLICE: 'vue_rewrite_slice',
  NORMAL_WORKFLOW_RULE: 'normal_workflow_rule',
  NORMAL_PATH_EXCLUSION: 'normal_path_exclusion',
});

const PHASE3R_COMPLETION_RISK_IDS = Object.freeze({
  MISSING_RECORD_ID: 'missing_record_id',
  MISSING_LABEL: 'missing_label',
  MISSING_DOC_PATH: 'missing_doc_path',
  MISSING_SERVICE_PATH: 'missing_service_path',
  MISSING_TEST_PATH: 'missing_test_path',
  MISSING_EVIDENCE: 'missing_evidence',
  UNKNOWN_ARTIFACT_KIND: 'unknown_artifact_kind',
  INVALID_EXCLUSION_SCOPE: 'invalid_exclusion_scope',
  INTERNAL_SURFACE_ALLOWED_IN_NORMAL_PATH: 'internal_surface_allowed_in_normal_path',
});

const PHASE3R_EXCLUSION_SCOPE_IDS = Object.freeze({
  NORMAL_PATH_FORBIDDEN: 'normal_path_forbidden',
  MIGRATION_VERIFIER_ONLY: 'migration_verifier_only',
  BRIDGE_ONLY: 'bridge_only',
  DELETE_AFTER_NATIVE_STORAGE: 'delete_after_native_storage',
});

const PHASE3R_SERVER_CONTRACTS = Object.freeze([
  {
    id: '3r_1_workflow_inventory_cutline',
    label: 'Workflow inventory and cutline',
    docPath: 'docs/architecture/policy-builder-phase-3r-workflow-inventory-cutline.md',
    servicePath: 'server/src/services/policyBuilderPhase3WorkflowInventory.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase3WorkflowInventory.test.mjs',
    evidence: 'Classifies current policy-builder surfaces as keep, rewrite, replace, delete, bridge-only, or verifier-only.',
  },
  {
    id: '3r_2_destination_first_flow',
    label: 'Destination-first flow',
    docPath: 'docs/architecture/policy-builder-phase-3r-destination-first-flow.md',
    servicePath: 'server/src/services/policyBuilderPhase3DestinationFirstFlow.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase3DestinationFirstFlow.test.mjs',
    evidence: 'Defines the normal operator sequence from library context through save or defer.',
  },
  {
    id: '3r_3_component_system_reset',
    label: 'Component system reset',
    docPath: 'docs/architecture/policy-builder-phase-3r-component-system-reset.md',
    servicePath: 'server/src/services/policyBuilderPhase3ComponentSystem.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase3ComponentSystem.test.mjs',
    evidence: 'Defines the target component vocabulary and interaction rules before Vue rebuilds.',
  },
  {
    id: '3r_4_evidence_backed_option_selection',
    label: 'Evidence-backed option selection',
    docPath: 'docs/architecture/policy-builder-phase-3r-evidence-backed-option-selection.md',
    servicePath: 'server/src/services/policyBuilderPhase3EvidenceBackedOptionSelection.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase3EvidenceBackedOptionSelection.test.mjs',
    evidence: 'Separates observed evidence, template suggestions, static options, custom values, and unavailable choices.',
  },
  {
    id: '3r_5_hard_limits_avoid_ux',
    label: 'Hard limits and avoid UX',
    docPath: 'docs/architecture/policy-builder-phase-3r-hard-limit-avoid-ux.md',
    servicePath: 'server/src/services/policyBuilderPhase3HardLimitAvoidUx.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase3HardLimitAvoidUx.test.mjs',
    evidence: 'Separates blockers, avoid warnings, and review warnings with explicit operator-action requirements.',
  },
  {
    id: '3r_6_readiness_next_action_surface',
    label: 'Readiness and next action surface',
    docPath: 'docs/architecture/policy-builder-phase-3r-readiness-next-action-surface.md',
    servicePath: 'server/src/services/policyBuilderPhase3ReadinessNextActionSurface.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase3ReadinessNextActionSurface.test.mjs',
    evidence: 'Replaces dense diagnostics with action-oriented readiness states and one primary next action.',
  },
  {
    id: '3r_7_starter_template_role_reset',
    label: 'Starter template role reset',
    docPath: 'docs/architecture/policy-builder-phase-3r-starter-template-role-reset.md',
    servicePath: 'server/src/services/policyBuilderPhase3StarterTemplateRoleReset.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase3StarterTemplateRoleReset.test.mjs',
    evidence: 'Keeps starter templates as optional accelerators after destination context.',
  },
  {
    id: '3r_8_accessibility_decision_load',
    label: 'Accessibility and decision load',
    docPath: 'docs/architecture/policy-builder-phase-3r-accessibility-decision-load.md',
    servicePath: 'server/src/services/policyBuilderPhase3AccessibilityDecisionLoad.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase3AccessibilityDecisionLoad.test.mjs',
    evidence: 'Defines labels, helper text, keyboard, disabled reason, and one-primary-action requirements.',
  },
  {
    id: '3r_9_presentation_test_reset',
    label: 'Presentation test reset',
    docPath: 'docs/architecture/policy-builder-phase-3r-presentation-test-reset.md',
    servicePath: 'server/src/services/policyBuilderPhase3PresentationTestReset.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase3PresentationTestReset.test.mjs',
    evidence: 'Classifies presentation tests so they protect simplified workflow behavior instead of old diagnostics.',
  },
]);

const PHASE3R_VUE_REWRITE_SLICES = Object.freeze([
  {
    id: 'vue_setup_cards',
    label: 'Vue setup cards',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-setup-cards.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Renders four setup cards after library context and keeps verifier panels out of default workflow.',
  },
  {
    id: 'vue_destination_section_split',
    label: 'Vue destination section split',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-destination-section-split.md',
    testPath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    evidence: 'Splits review behavior, destination identity, destination rules, and confidence support anchors.',
  },
  {
    id: 'vue_review_trigger_control',
    label: 'Vue review trigger control',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-review-trigger-control.md',
    testPath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    evidence: 'Adds Ask When Unsure review triggers through typed draft serialization.',
  },
  {
    id: 'vue_routing_readiness_surface',
    label: 'Vue routing readiness surface',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-routing-readiness-surface.md',
    testPath: 'client/src/__tests__/PolicyBuilderRoutingReadinessCard.test.js',
    evidence: 'Projects selected-library routing context without executing routing or saving policy intent.',
  },
  {
    id: 'vue_setup_card_state_binding',
    label: 'Vue setup card state binding',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-setup-card-state-binding.md',
    testPath: 'client/src/__tests__/PolicyBuilderSetupCards.test.js',
    evidence: 'Derives setup progress from existing modal projections without new API calls or diagnostics.',
  },
  {
    id: 'vue_save_defer_action_boundary',
    label: 'Vue save and defer action boundary',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-save-defer-action-boundary.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Exposes save readiness, disabled reasons, and defer-without-saving while preserving event contracts.',
  },
  {
    id: 'vue_starter_template_accelerator',
    label: 'Vue starter template accelerator',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-starter-template-accelerator.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Makes starter templates optional accelerators collapsed behind an accessible disclosure.',
  },
  {
    id: 'vue_accessibility_decision_load_audit',
    label: 'Vue accessibility decision-load audit',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-accessibility-decision-load-audit.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Marks one recommended next action and routes setup links to existing targets.',
  },
  {
    id: 'vue_presentation_test_reset',
    label: 'Vue presentation test reset',
    docPath: 'docs/architecture/policy-builder-phase-3r-vue-presentation-test-reset.md',
    testPath: 'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
    evidence: 'Resets impact and replay preview tests around read-only verifier behavior, no execution, and opt-in gates.',
  },
]);

const PHASE3R_NORMAL_WORKFLOW_RULES = Object.freeze([
  {
    id: 'destination_context_before_templates',
    label: 'Destination context appears before starter-template mechanics',
    docPath: 'docs/architecture/policy-builder-phase-3r-destination-first-flow.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Normal workflow starts from library and destination meaning; templates are secondary.',
  },
  {
    id: 'observed_evidence_requires_acceptance',
    label: 'Observed evidence requires explicit acceptance before becoming intent',
    docPath: 'docs/architecture/policy-builder-phase-3r-evidence-backed-option-selection.md',
    testPath: 'client/src/__tests__/PolicyIntentGenreControl.test.js',
    evidence: 'Observed profile suggestions remain suggestions until typed draft commands accept them.',
  },
  {
    id: 'hard_limits_explicit',
    label: 'Hard limits require explicit operator action',
    docPath: 'docs/architecture/policy-builder-phase-3r-hard-limit-avoid-ux.md',
    testPath: 'client/src/__tests__/PolicyIntentCertificationControl.test.js',
    evidence: 'Blockers are separate from avoid hints and require explicit declared intent.',
  },
  {
    id: 'one_recommended_next_action',
    label: 'Readiness exposes one recommended next action',
    docPath: 'docs/architecture/policy-builder-phase-3r-readiness-next-action-surface.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Setup cards expose one current step with supporting status and completion context.',
  },
  {
    id: 'verifier_panels_not_default',
    label: 'Verifier panels are not default policy-authoring path',
    docPath: 'docs/architecture/policy-builder-phase-3r-presentation-test-reset.md',
    testPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    evidence: 'Impact and replay verifier panels are absent unless the explicit verifier prop is enabled.',
  },
]);

const PHASE3R_NORMAL_PATH_EXCLUSIONS = Object.freeze([
  {
    id: 'impact_preview_panel',
    label: 'Intent impact preview panel',
    scopeId: PHASE3R_EXCLUSION_SCOPE_IDS.MIGRATION_VERIFIER_ONLY,
    evidence: 'Read-only verifier surface; not part of default policy authoring.',
  },
  {
    id: 'representative_replay_panel',
    label: 'Representative replay preview panel',
    scopeId: PHASE3R_EXCLUSION_SCOPE_IDS.MIGRATION_VERIFIER_ONLY,
    evidence: 'Read-only verifier surface with no execution; not part of default policy authoring.',
  },
  {
    id: 'provider_readiness_details',
    label: 'Provider readiness details',
    scopeId: PHASE3R_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN,
    evidence: 'Provider configuration and quota diagnostics belong outside normal policy authoring.',
  },
  {
    id: 'tmdb_coverage_details',
    label: 'TMDB coverage details',
    scopeId: PHASE3R_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN,
    evidence: 'Metadata coverage is diagnostic evidence, not normal policy setup copy.',
  },
  {
    id: 'raw_template_mechanics',
    label: 'Raw starter-template mechanics',
    scopeId: PHASE3R_EXCLUSION_SCOPE_IDS.BRIDGE_ONLY,
    evidence: 'Legacy weights, removed markers, and raw custom signals remain bridge-only.',
  },
  {
    id: 'legacy_policy_storage_shape',
    label: 'Legacy policy storage shape',
    scopeId: PHASE3R_EXCLUSION_SCOPE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    evidence: 'Legacy preset/custom-signal storage remains compatible until Phase 8R replacement.',
  },
]);

function validatePhase3CompletionRecord(record = {}, artifactKindId) {
  const issues = [];

  if (!record.id) {
    issues.push({
      riskId: PHASE3R_COMPLETION_RISK_IDS.MISSING_RECORD_ID,
      artifactKindId,
      message: 'Phase 3R completion records must have a stable id.',
    });
  }

  if (!record.label) {
    issues.push({
      riskId: PHASE3R_COMPLETION_RISK_IDS.MISSING_LABEL,
      artifactKindId,
      recordId: record.id || null,
      message: 'Phase 3R completion records must have an operator-readable label.',
    });
  }

  if (!record.evidence) {
    issues.push({
      riskId: PHASE3R_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
      artifactKindId,
      recordId: record.id || null,
      message: 'Phase 3R completion records must explain what proves the record.',
    });
  }

  if ([
    PHASE3R_ARTIFACT_KIND_IDS.SERVER_CONTRACT,
    PHASE3R_ARTIFACT_KIND_IDS.VUE_REWRITE_SLICE,
    PHASE3R_ARTIFACT_KIND_IDS.NORMAL_WORKFLOW_RULE,
  ].includes(artifactKindId) && !record.docPath) {
    issues.push({
      riskId: PHASE3R_COMPLETION_RISK_IDS.MISSING_DOC_PATH,
      artifactKindId,
      recordId: record.id || null,
      message: 'Phase 3R implementation records must link to an architecture document.',
    });
  }

  if (artifactKindId === PHASE3R_ARTIFACT_KIND_IDS.SERVER_CONTRACT && !record.servicePath) {
    issues.push({
      riskId: PHASE3R_COMPLETION_RISK_IDS.MISSING_SERVICE_PATH,
      artifactKindId,
      recordId: record.id || null,
      message: 'Phase 3R server contracts must link to the owning ESM service.',
    });
  }

  if ([
    PHASE3R_ARTIFACT_KIND_IDS.SERVER_CONTRACT,
    PHASE3R_ARTIFACT_KIND_IDS.VUE_REWRITE_SLICE,
    PHASE3R_ARTIFACT_KIND_IDS.NORMAL_WORKFLOW_RULE,
  ].includes(artifactKindId) && !record.testPath) {
    issues.push({
      riskId: PHASE3R_COMPLETION_RISK_IDS.MISSING_TEST_PATH,
      artifactKindId,
      recordId: record.id || null,
      message: 'Phase 3R implementation records must link to a regression test.',
    });
  }

  if (artifactKindId === PHASE3R_ARTIFACT_KIND_IDS.NORMAL_PATH_EXCLUSION) {
    if (!Object.values(PHASE3R_EXCLUSION_SCOPE_IDS).includes(record.scopeId)) {
      issues.push({
        riskId: PHASE3R_COMPLETION_RISK_IDS.INVALID_EXCLUSION_SCOPE,
        artifactKindId,
        recordId: record.id || null,
        message: 'Phase 3R exclusions must use an approved exclusion scope.',
      });
    }

    if (record.scopeId !== PHASE3R_EXCLUSION_SCOPE_IDS.NORMAL_PATH_FORBIDDEN &&
        record.normalAuthoringAllowed === true) {
      issues.push({
        riskId: PHASE3R_COMPLETION_RISK_IDS.INTERNAL_SURFACE_ALLOWED_IN_NORMAL_PATH,
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

function auditPhase3CompletionRecords(records, artifactKindId) {
  if (!Object.values(PHASE3R_ARTIFACT_KIND_IDS).includes(artifactKindId)) {
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
          riskId: PHASE3R_COMPLETION_RISK_IDS.UNKNOWN_ARTIFACT_KIND,
          artifactKindId,
          message: 'Phase 3R completion audits must use an approved artifact kind.',
        }],
      }],
    };
  }

  const results = (Array.isArray(records) ? records : [])
    .map(record => validatePhase3CompletionRecord(record, artifactKindId));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    artifactKindId,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function buildPolicyBuilderPhase3CompletionAudit({
  serverContracts = PHASE3R_SERVER_CONTRACTS,
  vueRewriteSlices = PHASE3R_VUE_REWRITE_SLICES,
  normalWorkflowRules = PHASE3R_NORMAL_WORKFLOW_RULES,
  normalPathExclusions = PHASE3R_NORMAL_PATH_EXCLUSIONS,
} = {}) {
  const serverContractAudit = auditPhase3CompletionRecords(
    serverContracts,
    PHASE3R_ARTIFACT_KIND_IDS.SERVER_CONTRACT
  );
  const vueRewriteAudit = auditPhase3CompletionRecords(
    vueRewriteSlices,
    PHASE3R_ARTIFACT_KIND_IDS.VUE_REWRITE_SLICE
  );
  const normalWorkflowAudit = auditPhase3CompletionRecords(
    normalWorkflowRules,
    PHASE3R_ARTIFACT_KIND_IDS.NORMAL_WORKFLOW_RULE
  );
  const normalPathExclusionAudit = auditPhase3CompletionRecords(
    normalPathExclusions,
    PHASE3R_ARTIFACT_KIND_IDS.NORMAL_PATH_EXCLUSION
  );
  const issueCount = [
    serverContractAudit,
    vueRewriteAudit,
    normalWorkflowAudit,
    normalPathExclusionAudit,
  ].reduce((count, audit) => count + audit.issueCount, 0);

  return {
    ok: issueCount === 0,
    issueCount,
    checkedServerContractCount: serverContractAudit.checkedCount,
    checkedVueRewriteCount: vueRewriteAudit.checkedCount,
    checkedNormalWorkflowRuleCount: normalWorkflowAudit.checkedCount,
    checkedNormalPathExclusionCount: normalPathExclusionAudit.checkedCount,
    serverContractAudit,
    vueRewriteAudit,
    normalWorkflowAudit,
    normalPathExclusionAudit,
    nextPhase: {
      phaseId: '6r_1',
      label: 'Runtime decision pipeline contract',
      reason: 'Phase 6R can consume Phase 3R operator intent only after normal authoring, verifier-only surfaces, and bridge-only surfaces are separated.',
    },
  };
}

function listPolicyBuilderPhase3CompletionArtifactPaths() {
  return [
    ...PHASE3R_SERVER_CONTRACTS.flatMap(record => [
      record.docPath,
      record.servicePath,
      record.testPath,
    ]),
    ...PHASE3R_VUE_REWRITE_SLICES.flatMap(record => [
      record.docPath,
      record.testPath,
    ]),
    ...PHASE3R_NORMAL_WORKFLOW_RULES.flatMap(record => [
      record.docPath,
      record.testPath,
    ]),
  ];
}

function listPolicyBuilderPhase3ServerContracts() {
  return PHASE3R_SERVER_CONTRACTS;
}

function listPolicyBuilderPhase3VueRewriteSlices() {
  return PHASE3R_VUE_REWRITE_SLICES;
}

function listPolicyBuilderPhase3NormalWorkflowRules() {
  return PHASE3R_NORMAL_WORKFLOW_RULES;
}

function listPolicyBuilderPhase3NormalPathExclusions() {
  return PHASE3R_NORMAL_PATH_EXCLUSIONS;
}

export {
  PHASE3R_ARTIFACT_KIND_IDS,
  PHASE3R_COMPLETION_RISK_IDS,
  PHASE3R_EXCLUSION_SCOPE_IDS,
  auditPhase3CompletionRecords,
  buildPolicyBuilderPhase3CompletionAudit,
  listPolicyBuilderPhase3CompletionArtifactPaths,
  listPolicyBuilderPhase3NormalPathExclusions,
  listPolicyBuilderPhase3NormalWorkflowRules,
  listPolicyBuilderPhase3ServerContracts,
  listPolicyBuilderPhase3VueRewriteSlices,
  validatePhase3CompletionRecord,
};
