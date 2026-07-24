import {
  MODAL_PROHIBITED_RESPONSIBILITY_IDS,
  evaluateModalResponsibilitySet,
} from './policyBuilderModalOrchestrationContract.mjs';
import {
  DRAFT_COMMAND_IDS,
  isDraftCommandAllowed,
  validatePolicyBuilderSavePayloadBoundary,
} from './policyBuilderDraftStateBoundary.mjs';
import {
  REFERENCE_DATA_AUTHORITY_IDS,
  validateReferenceDataOption,
} from './policyBuilderReferenceDataBoundary.mjs';
import {
  LEGACY_COMPATIBILITY_ACTION_IDS,
  LEGACY_COMPATIBILITY_ARTIFACT_IDS,
  LEGACY_COMPATIBILITY_RISK_IDS,
  buildLegacyCompatibilityBoundaryAudit,
  canMutateLegacyPayload,
  evaluateLegacyCompatibilityDeletionReadiness,
  listLegacyCompatibilityDeletionGates,
  validateLegacyCompatibilityTouchpoint,
} from './policyBuilderLegacyCompatibilityBoundary.mjs';

const TEST_BOUNDARY_CATEGORY_IDS = Object.freeze({
  KEEP_BEHAVIOR_REGRESSION: 'keep_behavior_regression',
  REWRITE_PRODUCT_VOCABULARY: 'rewrite_product_vocabulary',
  REWRITE_DRAFT_BRIDGE_BOUNDARY: 'rewrite_draft_bridge_boundary',
  REWRITE_FUTURE_EVIDENCE_READINESS: 'rewrite_future_evidence_readiness',
  DELETE_WITH_ABANDONED_DIAGNOSTIC_UI: 'delete_with_abandoned_diagnostic_ui',
  POLICY_BUILDER_BOUNDARY_CONTRACT: 'policy_builder_boundary_contract',
});

const TEST_BOUNDARY_RULE_IDS = Object.freeze({
  MODAL_DOES_NOT_GENERATE_EVIDENCE: 'modal_does_not_generate_evidence',
  DRAFT_COMMANDS_ARE_ALLOWLISTED: 'draft_commands_are_allowlisted',
  REFERENCE_OPTIONS_DISTINCT_FROM_OBSERVED_EVIDENCE: 'reference_options_distinct_from_observed_evidence',
  LEGACY_PAYLOAD_MUTATION_STAYS_IN_BRIDGE: 'legacy_payload_mutation_stays_in_bridge',
  LEGACY_COMPATIBILITY_AUDIT_IS_CLEAN: 'legacy_compatibility_audit_is_clean',
  LEGACY_DELETION_REQUIRES_COMPLETED_GATES: 'legacy_deletion_requires_completed_gates',
  UI_ONLY_STATE_IS_NOT_SERIALIZED: 'ui_only_state_is_not_serialized',
  NO_TRANSITIONAL_LAYOUT_SNAPSHOTS: 'no_transitional_layout_snapshots',
});

const TEST_BOUNDARY_ACTION_IDS = Object.freeze({
  KEEP: 'keep',
  REWRITE: 'rewrite',
  DELETE_AFTER_CUTLINE: 'delete_after_cutline',
  ADD_BOUNDARY_ASSERTION: 'add_boundary_assertion',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach(item => {
    deepFreeze(item);
  });

  return value;
}

const TEST_BOUNDARY_RECORDS = deepFreeze([
  {
    path: 'server/src/__tests__/services/policyBuilderBoundaryInventory.test.mjs',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.POLICY_BUILDER_BOUNDARY_CONTRACT,
    actionId: TEST_BOUNDARY_ACTION_IDS.KEEP,
    coveredRuleIds: [],
    freezesLayout: false,
    notes: 'Keeps current module ownership inventory visible before draft-boundary refactors continue.',
  },
  {
    path: 'server/src/__tests__/services/policyBuilderModalOrchestrationContract.test.mjs',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.POLICY_BUILDER_BOUNDARY_CONTRACT,
    actionId: TEST_BOUNDARY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      TEST_BOUNDARY_RULE_IDS.MODAL_DOES_NOT_GENERATE_EVIDENCE,
      TEST_BOUNDARY_RULE_IDS.NO_TRANSITIONAL_LAYOUT_SNAPSHOTS,
    ],
    freezesLayout: false,
    notes: 'Protects modal orchestration responsibilities without asserting layout shape.',
  },
  {
    path: 'server/src/__tests__/services/policyBuilderDraftStateBoundary.test.mjs',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.POLICY_BUILDER_BOUNDARY_CONTRACT,
    actionId: TEST_BOUNDARY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      TEST_BOUNDARY_RULE_IDS.DRAFT_COMMANDS_ARE_ALLOWLISTED,
      TEST_BOUNDARY_RULE_IDS.UI_ONLY_STATE_IS_NOT_SERIALIZED,
    ],
    freezesLayout: false,
    notes: 'Protects draft commands and save payload allow-list behavior.',
  },
  {
    path: 'server/src/__tests__/services/policyBuilderReferenceDataBoundary.test.mjs',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.POLICY_BUILDER_BOUNDARY_CONTRACT,
    actionId: TEST_BOUNDARY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      TEST_BOUNDARY_RULE_IDS.REFERENCE_OPTIONS_DISTINCT_FROM_OBSERVED_EVIDENCE,
    ],
    freezesLayout: false,
    notes: 'Protects static option and observed evidence separation.',
  },
  {
    path: 'server/src/__tests__/services/policyBuilderLegacyCompatibilityBoundary.test.mjs',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.POLICY_BUILDER_BOUNDARY_CONTRACT,
    actionId: TEST_BOUNDARY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      TEST_BOUNDARY_RULE_IDS.LEGACY_PAYLOAD_MUTATION_STAYS_IN_BRIDGE,
      TEST_BOUNDARY_RULE_IDS.LEGACY_COMPATIBILITY_AUDIT_IS_CLEAN,
      TEST_BOUNDARY_RULE_IDS.LEGACY_DELETION_REQUIRES_COMPLETED_GATES,
    ],
    freezesLayout: false,
    notes: 'Protects bridge-only raw legacy payload mutation.',
  },
  {
    path: 'client/src/__tests__/PolicyBuilderModal.test.js',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.KEEP_BEHAVIOR_REGRESSION,
    actionId: TEST_BOUNDARY_ACTION_IDS.KEEP,
    coveredRuleIds: [],
    freezesLayout: false,
    notes: 'Keep behavior coverage, but do not add snapshot assertions for transitional layout.',
  },
  {
    path: 'client/src/__tests__/PolicyIntentEditor.test.js',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.REWRITE_PRODUCT_VOCABULARY,
    actionId: TEST_BOUNDARY_ACTION_IDS.REWRITE,
    coveredRuleIds: [],
    freezesLayout: false,
    notes: 'Rewrite around destination intent language instead of legacy-first section shape.',
  },
  {
    path: 'client/src/__tests__/PolicyIntentSectionCard.test.js',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.REWRITE_PRODUCT_VOCABULARY,
    actionId: TEST_BOUNDARY_ACTION_IDS.REWRITE,
    coveredRuleIds: [],
    freezesLayout: false,
    notes: 'Keep interaction coverage while avoiding product-copy drift into old diagnostic language.',
  },
  {
    path: 'client/src/__tests__/utils/policyIntentDraftBridge.test.js',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.REWRITE_DRAFT_BRIDGE_BOUNDARY,
    actionId: TEST_BOUNDARY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      TEST_BOUNDARY_RULE_IDS.LEGACY_PAYLOAD_MUTATION_STAYS_IN_BRIDGE,
    ],
    freezesLayout: false,
    notes: 'Keep bridge parity coverage until native intent storage replaces it.',
  },
  {
    path: 'client/src/__tests__/composables/usePolicyIntentDraft.test.js',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.REWRITE_DRAFT_BRIDGE_BOUNDARY,
    actionId: TEST_BOUNDARY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      TEST_BOUNDARY_RULE_IDS.DRAFT_COMMANDS_ARE_ALLOWLISTED,
    ],
    freezesLayout: false,
    notes: 'Keep command behavior coverage and avoid direct storage-shape assertions where possible.',
  },
  {
    path: 'client/src/__tests__/composables/usePolicyBuilderState.test.js',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.REWRITE_DRAFT_BRIDGE_BOUNDARY,
    actionId: TEST_BOUNDARY_ACTION_IDS.REWRITE,
    coveredRuleIds: [
      TEST_BOUNDARY_RULE_IDS.UI_ONLY_STATE_IS_NOT_SERIALIZED,
    ],
    freezesLayout: false,
    notes: 'Rewrite around save payload boundary and bridge delegation instead of raw preset internals.',
  },
  {
    path: 'client/src/__tests__/composables/usePolicyBuilderReferenceData.test.js',
    categoryId: TEST_BOUNDARY_CATEGORY_IDS.REWRITE_FUTURE_EVIDENCE_READINESS,
    actionId: TEST_BOUNDARY_ACTION_IDS.REWRITE,
    coveredRuleIds: [
      TEST_BOUNDARY_RULE_IDS.REFERENCE_OPTIONS_DISTINCT_FROM_OBSERVED_EVIDENCE,
    ],
    freezesLayout: false,
    notes: 'Split option/reference coverage from future evidence and readiness semantics.',
  },
]);

function listTestBoundaryRecords() {
  return TEST_BOUNDARY_RECORDS;
}

function getTestBoundaryRecord(path) {
  return TEST_BOUNDARY_RECORDS.find(record => record.path === path) || null;
}

function listTestBoundaryRecordsByCategory(categoryId) {
  return TEST_BOUNDARY_RECORDS.filter(record => record.categoryId === categoryId);
}

function listTestBoundaryRules() {
  return Object.values(TEST_BOUNDARY_RULE_IDS);
}

function summarizeTestBoundaryReset() {
  const countsByCategory = TEST_BOUNDARY_RECORDS.reduce((counts, record) => {
    counts[record.categoryId] = (counts[record.categoryId] || 0) + 1;
    return counts;
  }, {});

  const coveredRuleIds = Array.from(new Set(
    TEST_BOUNDARY_RECORDS.flatMap(record => record.coveredRuleIds)
  )).sort();

  return {
    recordCount: TEST_BOUNDARY_RECORDS.length,
    countsByCategory,
    coveredRuleIds,
    uncoveredRuleIds: listTestBoundaryRules().filter(ruleId => !coveredRuleIds.includes(ruleId)),
    snapshotFreezeRecordIds: TEST_BOUNDARY_RECORDS
      .filter(record => record.freezesLayout)
      .map(record => record.path),
  };
}

function validateTestBoundaryRule(ruleId) {
  switch (ruleId) {
    case TEST_BOUNDARY_RULE_IDS.MODAL_DOES_NOT_GENERATE_EVIDENCE: {
      const result = evaluateModalResponsibilitySet([
        MODAL_PROHIBITED_RESPONSIBILITY_IDS.EVIDENCE_GENERATION,
      ]);
      return {
        valid: result.valid === false && result.prohibitedIds.includes(MODAL_PROHIBITED_RESPONSIBILITY_IDS.EVIDENCE_GENERATION),
        evidence: result,
      };
    }
    case TEST_BOUNDARY_RULE_IDS.DRAFT_COMMANDS_ARE_ALLOWLISTED:
      return {
        valid: isDraftCommandAllowed(DRAFT_COMMAND_IDS.ADD_SIGNAL) === true
          && isDraftCommandAllowed('write_raw_legacy_payload') === false,
        evidence: {
          addSignalAllowed: isDraftCommandAllowed(DRAFT_COMMAND_IDS.ADD_SIGNAL),
          unknownCommandAllowed: isDraftCommandAllowed('write_raw_legacy_payload'),
        },
      };
    case TEST_BOUNDARY_RULE_IDS.REFERENCE_OPTIONS_DISTINCT_FROM_OBSERVED_EVIDENCE: {
      const staticOption = validateReferenceDataOption({
        value: 'Animation',
        source: 'preset_reference',
      });
      const observedOption = validateReferenceDataOption({
        value: 'Animation',
        source: 'library_profile',
      });
      return {
        valid: staticOption.authorityId === REFERENCE_DATA_AUTHORITY_IDS.OPTION_ONLY
          && observedOption.authorityId === REFERENCE_DATA_AUTHORITY_IDS.OBSERVED_EVIDENCE,
        evidence: {
          staticOption,
          observedOption,
        },
      };
    }
    case TEST_BOUNDARY_RULE_IDS.LEGACY_PAYLOAD_MUTATION_STAYS_IN_BRIDGE: {
      const stateWrite = validateLegacyCompatibilityTouchpoint({
        path: 'client/src/composables/usePolicyBuilderState.js',
        artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
        operation: LEGACY_COMPATIBILITY_ACTION_IDS.WRITE_RAW_PAYLOAD,
      });
      return {
        valid: canMutateLegacyPayload('client/src/utils/policyIntentDraftBridge.js') === true
          && canMutateLegacyPayload('client/src/composables/usePolicyBuilderState.js') === false
          && stateWrite.valid === false
          && stateWrite.riskId === LEGACY_COMPATIBILITY_RISK_IDS.RAW_PAYLOAD_MUTATION,
        evidence: {
          bridgeCanMutate: canMutateLegacyPayload('client/src/utils/policyIntentDraftBridge.js'),
          stateCanMutate: canMutateLegacyPayload('client/src/composables/usePolicyBuilderState.js'),
          stateWrite,
        },
      };
    }
    case TEST_BOUNDARY_RULE_IDS.LEGACY_COMPATIBILITY_AUDIT_IS_CLEAN: {
      const audit = buildLegacyCompatibilityBoundaryAudit();
      return {
        valid: audit.ok === true && audit.issues.length === 0,
        evidence: audit,
      };
    }
    case TEST_BOUNDARY_RULE_IDS.LEGACY_DELETION_REQUIRES_COMPLETED_GATES: {
      const allGateIds = listLegacyCompatibilityDeletionGates().map(gate => gate.id);
      const incompleteReadiness = evaluateLegacyCompatibilityDeletionReadiness(allGateIds.slice(0, -1));
      const completeReadiness = evaluateLegacyCompatibilityDeletionReadiness(allGateIds);

      return {
        valid: incompleteReadiness.ready === false
          && incompleteReadiness.missingGateIds.length === 1
          && completeReadiness.ready === true
          && completeReadiness.missingGateIds.length === 0,
        evidence: {
          incompleteReadiness,
          completeReadiness,
        },
      };
    }
    case TEST_BOUNDARY_RULE_IDS.UI_ONLY_STATE_IS_NOT_SERIALIZED: {
      const result = validatePolicyBuilderSavePayloadBoundary({
        name: 'Movies policy',
        presets: [],
        expandedPresetIds: [1, 2],
        libraryProfile: { genres: ['Animation'] },
      });
      return {
        valid: result.valid === false
          && result.prohibitedFields.includes('expandedPresetIds')
          && result.prohibitedFields.includes('libraryProfile'),
        evidence: result,
      };
    }
    case TEST_BOUNDARY_RULE_IDS.NO_TRANSITIONAL_LAYOUT_SNAPSHOTS:
      return {
        valid: summarizeTestBoundaryReset().snapshotFreezeRecordIds.length === 0,
        evidence: {
          snapshotFreezeRecordIds: summarizeTestBoundaryReset().snapshotFreezeRecordIds,
        },
      };
    default:
      return {
        valid: false,
        evidence: {
          reason: 'Unknown test boundary rule.',
        },
      };
  }
}

function validatePolicyBuilderTestBoundaryReset() {
  const ruleResults = listTestBoundaryRules().map(ruleId => ({
    ruleId,
    ...validateTestBoundaryRule(ruleId),
  }));

  const summary = summarizeTestBoundaryReset();

  return {
    valid: ruleResults.every(result => result.valid)
      && summary.uncoveredRuleIds.length === 0
      && summary.snapshotFreezeRecordIds.length === 0,
    ruleResults,
    summary,
  };
}

export {
  TEST_BOUNDARY_ACTION_IDS,
  TEST_BOUNDARY_CATEGORY_IDS,
  TEST_BOUNDARY_RULE_IDS,
  getTestBoundaryRecord,
  listTestBoundaryRecords,
  listTestBoundaryRecordsByCategory,
  listTestBoundaryRules,
  summarizeTestBoundaryReset,
  validatePolicyBuilderTestBoundaryReset,
  validateTestBoundaryRule,
};
