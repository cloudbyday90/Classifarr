import {
  POLICY_AUTHORING_COMPONENT_DECISION_IDS,
  POLICY_AUTHORING_COMPONENT_IDS,
  listPolicyAuthoringTargetComponents,
} from './policyAuthoringComponentSystem.mjs';

const POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS = Object.freeze({
  MODAL_SHELL: 'modal_shell',
  WORKFLOW_COMPOSITION: 'workflow_composition',
  DESTINATION_CONTEXT: 'destination_context',
  OBSERVED_PROFILE: 'observed_profile',
  INTENT_SIGNAL_PICKER: 'intent_signal_picker',
  INTENT_SIGNAL_CHIP_RENDERING: 'intent_signal_chip_rendering',
  INTENT_SIGNAL_CUSTOM_ENTRY: 'intent_signal_custom_entry',
  DESTINATION_QUESTION_CONTAINER: 'destination_question_container',
  CONSTRAINT_COMPOSITE: 'constraint_composite',
  HARD_LIMIT_CONTROL: 'hard_limit_control',
  AVOID_CONTROL: 'avoid_control',
  REVIEW_TRIGGER_CONTROL: 'review_trigger_control',
  READINESS: 'readiness',
  STATUS: 'status',
  ACTION_ADMISSION: 'action_admission',
  POLICY_RESULT: 'policy_result',
  POLICY_RECOVERY: 'policy_recovery',
  COMPATIBILITY_MAINTENANCE: 'compatibility_maintenance',
  COMPATIBILITY_SIGNAL_CONTROL: 'compatibility_signal_control',
  MIGRATION_NOTICE: 'migration_notice',
  POLICY_LIST_CARD: 'policy_list_card',
  LIBRARY_LIFECYCLE_ENTRY: 'library_lifecycle_entry',
  DESTINATION_PROPOSAL: 'destination_proposal',
});

const POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS = Object.freeze({
  IMPLEMENTED: 'implemented',
  EXTRACTION_REQUIRED: 'extraction_required',
  SPLIT_REQUIRED: 'split_required',
  OPTIONAL_DEFERRED: 'optional_deferred',
});

const POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS = Object.freeze({
  UNCLASSIFIED_COMPONENT: 'unclassified_component',
  DUPLICATE_COMPONENT_PATH: 'duplicate_component_path',
  MISSING_COMPONENT_PATH: 'missing_component_path',
  UNKNOWN_TARGET_COMPONENT: 'unknown_target_component',
  MISSING_TARGET_IMPLEMENTATION: 'missing_target_implementation',
  INVALID_TARGET_IMPLEMENTATION_STATUS: 'invalid_target_implementation_status',
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

function normalizeClientPath(filePath = '') {
  return String(filePath || '').replace(/\\/g, '/');
}

function basename(filePath) {
  return filePath.split('/').pop() || filePath;
}

const POLICY_AUTHORING_COMPONENT_INVENTORY = deepFreeze([
  {
    id: 'policy_builder_modal',
    path: 'client/src/components/policies/PolicyBuilderModal.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.MODAL_SHELL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REWRITE_AS_TARGET,
    targetComponentIds: [],
    normalAuthoringAllowed: true,
    notes: 'Keeps modal lifecycle and orchestration only; target controls own their presentation and local interaction.',
  },
  {
    id: 'policy_builder_workflow_shell',
    path: 'client/src/components/policies/PolicyBuilderWorkflowShell.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.WORKFLOW_COMPOSITION,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [],
    normalAuthoringAllowed: true,
    notes: 'Composes bounded workflow projections and target components without deriving policy or automation behavior.',
  },
  {
    id: 'policy_authoring_lifecycle_entry',
    path: 'client/src/components/policies/PolicyAuthoringLifecycleEntry.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.LIBRARY_LIFECYCLE_ENTRY,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [],
    normalAuthoringAllowed: true,
    notes: 'Renders one server-confirmed lifecycle outcome and emits only the selected library identifier; it does not prepare, infer, or create policy intent.',
  },
  {
    id: 'destination_context_card',
    path: 'client/src/components/policies/DestinationContextCard.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.DESTINATION_CONTEXT,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
    ],
    normalAuthoringAllowed: true,
    notes: 'The target destination-context primitive is implemented and renders display-only workflow values.',
  },
  {
    id: 'observed_profile_summary',
    path: 'client/src/components/policies/ObservedProfileSummary.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.OBSERVED_PROFILE,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
    ],
    normalAuthoringAllowed: true,
    notes: 'The target observed-profile primitive is implemented and keeps evidence distinct from declared intent.',
  },
  {
    id: 'policy_destination_proposal_card',
    path: 'client/src/components/policies/PolicyDestinationProposalCard.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.DESTINATION_PROPOSAL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_PROPOSAL_CARD,
    ],
    normalAuthoringAllowed: true,
    notes: 'Renders only the display-safe prepared proposal and emits one admitted create event without exposing generic rule selection.',
  },
  {
    id: 'intent_signal_picker',
    path: 'client/src/components/policies/IntentSignalPicker.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.INTENT_SIGNAL_PICKER,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER],
    normalAuthoringAllowed: true,
    notes: 'The picker owns evidence-backed option selection and typed add-command planning.',
  },
  {
    id: 'intent_signal_chip_list',
    path: 'client/src/components/policies/IntentSignalChipList.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.INTENT_SIGNAL_CHIP_RENDERING,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST],
    normalAuthoringAllowed: true,
    notes: 'The target chip-list primitive renders declared candidates and emits existing typed remove-command plans only.',
  },
  {
    id: 'policy_intent_custom_signal_entry',
    path: 'client/src/components/policies/PolicyIntentCustomSignalEntry.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.INTENT_SIGNAL_CUSTOM_ENTRY,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    ],
    normalAuthoringAllowed: true,
    notes: 'Provides the bounded custom-value fallback beneath the signal picker and emits validation input only.',
  },
  {
    id: 'policy_builder_destination_questions',
    path: 'client/src/components/policies/PolicyBuilderDestinationQuestions.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.DESTINATION_QUESTION_CONTAINER,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REWRITE_AS_TARGET,
    targetComponentIds: [],
    normalAuthoringAllowed: true,
    notes: 'Keeps destination-question layout while target controls replace its remaining generic mechanics.',
  },
  {
    id: 'hard_limit_control',
    path: 'client/src/components/policies/HardLimitControl.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.HARD_LIMIT_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL],
    normalAuthoringAllowed: true,
    notes: 'The target hard-limit control rebuilds the approved display projection, requires explicit confirmation, and emits the established typed local draft plan only.',
  },
  {
    id: 'avoid_control',
    path: 'client/src/components/policies/AvoidControl.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.AVOID_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL],
    normalAuthoringAllowed: true,
    notes: 'The target avoid control rebuilds the approved advisory display projection, requires explicit confirmation, and emits the established typed local draft plan only.',
  },
  {
    id: 'review_trigger_control',
    path: 'client/src/components/policies/ReviewTriggerControl.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.REVIEW_TRIGGER_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL],
    normalAuthoringAllowed: true,
    notes: 'The target review-trigger control rebuilds the approved non-blocking review projection and emits the established typed local draft plan only.',
  },
  {
    id: 'policy_intent_constraint_control_surface',
    path: 'client/src/components/policies/PolicyIntentConstraintControlSurface.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.CONSTRAINT_COMPOSITE,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [],
    normalAuthoringAllowed: true,
    notes: 'Coordinates valid projection availability, one status region, staged-count display, and draft clearing without changing the typed draft-command boundary.',
  },
  {
    id: 'policy_destination_empty_state_notice',
    path: 'client/src/components/policies/PolicyDestinationEmptyStateNotice.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.READINESS,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
    ],
    normalAuthoringAllowed: true,
    notes: 'Renders one bounded recovery action in the destination question that owns a server-projected empty state.',
  },
  {
    id: 'policy_builder_workflow_status_notice',
    path: 'client/src/components/policies/PolicyBuilderWorkflowStatusNotice.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.STATUS,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [],
    normalAuthoringAllowed: true,
    notes: 'Announces one ordered workflow status and does not duplicate readiness mechanics.',
  },
  {
    id: 'policy_builder_footer_actions',
    path: 'client/src/components/policies/PolicyBuilderFooterActions.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.ACTION_ADMISSION,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [],
    normalAuthoringAllowed: true,
    notes: 'Shows the save boundary and its direct returned reason without deciding policy readiness.',
  },
  {
    id: 'policy_builder_library_context',
    path: 'client/src/components/policies/PolicyBuilderLibraryContext.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.DESTINATION_CONTEXT,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REPLACE_WITH_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
    ],
    normalAuthoringAllowed: true,
    notes: 'Legacy library context duplicates target destination-context presentation and is replaced as orchestration is simplified.',
  },
  {
    id: 'policy_native_policy_summary',
    path: 'client/src/components/policies/PolicyNativePolicySummary.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.POLICY_RESULT,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Read-only persisted-policy summary, outside new-policy authoring.',
  },
  {
    id: 'policy_native_profile_recovery_status',
    path: 'client/src/components/policies/PolicyNativeProfileRecoveryStatus.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.POLICY_RECOVERY,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Read-only persisted-policy recovery state, outside new-policy authoring.',
  },
  {
    id: 'policy_native_create_handoff',
    path: 'client/src/components/policies/PolicyNativeCreateHandoff.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.POLICY_RESULT,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Post-create handoff, outside the destination-authoring component vocabulary.',
  },
  {
    id: 'policy_native_policy_recovery_notice',
    path: 'client/src/components/policies/PolicyNativePolicyRecoveryNotice.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.POLICY_RECOVERY,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Read-only recovery notice for invalid persisted native intent.',
  },
  {
    id: 'policy_compatibility_maintenance_surface',
    path: 'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_MAINTENANCE,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Compatibility-only maintenance surface; it cannot become an alternate native authoring path.',
  },
  {
    id: 'policy_intent_editor',
    path: 'client/src/components/policies/PolicyIntentEditor.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_MAINTENANCE,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Legacy editor retained only by the compatibility maintenance surface.',
  },
  {
    id: 'policy_intent_section_card',
    path: 'client/src/components/policies/PolicyIntentSectionCard.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_MAINTENANCE,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Legacy section card remains compatibility-only and is not a target container for native authoring.',
  },
  {
    id: 'policy_intent_chip',
    path: 'client/src/components/policies/PolicyIntentChip.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.INTENT_SIGNAL_CHIP_RENDERING,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REPLACE_WITH_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
    ],
    normalAuthoringAllowed: false,
    notes: 'Compatibility chip presentation includes legacy provenance and is replaced by the native declared-signal chip list.',
  },
  {
    id: 'policy_intent_certification_control',
    path: 'client/src/components/policies/PolicyIntentCertificationControl.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_SIGNAL_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REPLACE_WITH_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
    ],
    normalAuthoringAllowed: false,
    notes: 'Compatibility certification editing is superseded by separate native hard-limit and avoid controls.',
  },
  {
    id: 'policy_intent_review_trigger_control',
    path: 'client/src/components/policies/PolicyIntentReviewTriggerControl.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_SIGNAL_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REPLACE_WITH_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    ],
    normalAuthoringAllowed: false,
    notes: 'Compatibility review-trigger editing is superseded by the native review-trigger target control.',
  },
  {
    id: 'policy_intent_genre_control',
    path: 'client/src/components/policies/PolicyIntentGenreControl.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_SIGNAL_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REPLACE_WITH_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    ],
    normalAuthoringAllowed: false,
    notes: 'Compatibility genre editing is superseded by evidence-backed native signal selection.',
  },
  {
    id: 'policy_intent_option_action_group',
    path: 'client/src/components/policies/PolicyIntentOptionActionGroup.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_SIGNAL_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Generic compatibility option-action composition must not re-enter native authoring.',
  },
  {
    id: 'policy_intent_option_select',
    path: 'client/src/components/policies/PolicyIntentOptionSelect.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_SIGNAL_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Generic compatibility select remains outside the evidence-backed native component system.',
  },
  {
    id: 'policy_intent_action_button',
    path: 'client/src/components/policies/PolicyIntentActionButton.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_SIGNAL_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Generic compatibility action button is not a native authoring primitive.',
  },
  {
    id: 'policy_intent_secondary_action_button',
    path: 'client/src/components/policies/PolicyIntentSecondaryActionButton.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_SIGNAL_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Secondary compatibility action remains outside the native authoring vocabulary.',
  },
  {
    id: 'policy_preset_migration_notice',
    path: 'client/src/components/policies/PolicyPresetMigrationNotice.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.MIGRATION_NOTICE,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Migration support notice is not normal authoring UI.',
  },
  {
    id: 'policy_card',
    path: 'client/src/components/policies/PolicyCard.vue',
    roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.POLICY_LIST_CARD,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [],
    normalAuthoringAllowed: false,
    notes: 'Policy-list presentation is outside the policy-authoring component system and retains its own future redesign decision.',
  },
]);

const POLICY_AUTHORING_TARGET_IMPLEMENTATIONS = deepFreeze([
  {
    targetComponentId: POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
    statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
    sourcePaths: ['client/src/components/policies/DestinationContextCard.vue'],
    notes: 'Implemented as a display-only destination-context card.',
  },
  {
    targetComponentId: POLICY_AUTHORING_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
    statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
    sourcePaths: ['client/src/components/policies/ObservedProfileSummary.vue'],
    notes: 'Implemented as a read-only observed-evidence summary.',
  },
  {
    targetComponentId: POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_PROPOSAL_CARD,
    statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
    sourcePaths: ['client/src/components/policies/PolicyDestinationProposalCard.vue'],
    notes: 'Implemented as the display-safe proposal review and explicit server-admission card.',
  },
  {
    targetComponentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
    sourcePaths: ['client/src/components/policies/IntentSignalPicker.vue'],
    notes: 'Implemented as the native evidence-backed multi-select picker.',
  },
  {
    targetComponentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
    statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
    sourcePaths: ['client/src/components/policies/IntentSignalChipList.vue'],
    notes: 'Implemented as a dedicated declared-signal chip list that emits the established typed remove plan.',
  },
  {
    targetComponentId: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
    sourcePaths: ['client/src/components/policies/HardLimitControl.vue'],
    notes: 'Implemented as a self-validating hard-limit control with explicit confirmation and typed local-draft plan emission.',
  },
  {
    targetComponentId: POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
    statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
    sourcePaths: ['client/src/components/policies/AvoidControl.vue'],
    notes: 'Implemented as a self-validating advisory avoid control with explicit confirmation and typed local-draft plan emission.',
  },
  {
    targetComponentId: POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
    sourcePaths: ['client/src/components/policies/ReviewTriggerControl.vue'],
    notes: 'Implemented as a self-validating non-blocking review-trigger control with typed local-draft plan emission.',
  },
  {
    targetComponentId: POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
    statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
    sourcePaths: ['client/src/components/policies/PolicyDestinationEmptyStateNotice.vue'],
    notes: 'Implemented as the bounded, destination-question-owned readiness action.',
  },
  {
    targetComponentId: POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
    statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.OPTIONAL_DEFERRED,
    sourcePaths: [],
    notes: 'Starter-template suggestions remain server-projected optional evidence; a client component is deferred until it can add value without becoming a primary path.',
  },
]);

function listPolicyAuthoringComponentInventory() {
  return POLICY_AUTHORING_COMPONENT_INVENTORY;
}

function listPolicyAuthoringTargetImplementations() {
  return POLICY_AUTHORING_TARGET_IMPLEMENTATIONS;
}

function classifyPolicyAuthoringComponent(filePath = '') {
  const path = normalizeClientPath(filePath);
  const record = POLICY_AUTHORING_COMPONENT_INVENTORY.find(candidate => candidate.path === path);

  if (!record) {
    return {
      path,
      name: basename(path),
      id: null,
      roleId: null,
      decisionId: null,
      targetComponentIds: [],
      normalAuthoringAllowed: false,
      riskIds: [POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS.UNCLASSIFIED_COMPONENT],
      notes: 'No policy-authoring component inventory record matched this path.',
    };
  }

  return {
    ...record,
    name: basename(path),
    riskIds: [],
  };
}

function getPolicyAuthoringTargetImplementation(targetComponentId) {
  return POLICY_AUTHORING_TARGET_IMPLEMENTATIONS.find(
    record => record.targetComponentId === targetComponentId,
  ) || null;
}

function summarizePolicyAuthoringComponentInventory(filePaths = []) {
  const records = (Array.isArray(filePaths) ? filePaths : [])
    .map(classifyPolicyAuthoringComponent);
  const unclassifiedPaths = records
    .filter(record => record.id === null)
    .map(record => record.path);
  const normalAuthoringPaths = records
    .filter(record => record.normalAuthoringAllowed)
    .map(record => record.path);
  const implementationStatusCounts = POLICY_AUTHORING_TARGET_IMPLEMENTATIONS.reduce((counts, record) => {
    counts[record.statusId] = (counts[record.statusId] || 0) + 1;
    return counts;
  }, {});

  return {
    total: records.length,
    normalAuthoringPaths,
    unclassifiedPaths,
    implementationStatusCounts,
    nextTargetImplementation: POLICY_AUTHORING_TARGET_IMPLEMENTATIONS.find(record => (
      record.statusId === POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.EXTRACTION_REQUIRED ||
      record.statusId === POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.SPLIT_REQUIRED
    )) || null,
  };
}

function auditPolicyAuthoringComponentInventory(filePaths = []) {
  const summary = summarizePolicyAuthoringComponentInventory(filePaths);
  const inventoryPaths = POLICY_AUTHORING_COMPONENT_INVENTORY.map(record => record.path);
  const inputPaths = (Array.isArray(filePaths) ? filePaths : []).map(normalizeClientPath);
  const duplicateComponentPaths = inventoryPaths.filter((path, index) => (
    inventoryPaths.indexOf(path) !== index
  ));
  const missingComponentPaths = inventoryPaths.filter(path => !inputPaths.includes(path));
  const targetComponentIds = new Set(listPolicyAuthoringTargetComponents().map(component => component.id));
  const targetImplementationIds = POLICY_AUTHORING_TARGET_IMPLEMENTATIONS.map(
    record => record.targetComponentId,
  );
  const unknownTargetComponentIds = POLICY_AUTHORING_TARGET_IMPLEMENTATIONS
    .map(record => record.targetComponentId)
    .filter(componentId => !targetComponentIds.has(componentId));
  const missingTargetImplementationIds = [...targetComponentIds].filter(
    componentId => !targetImplementationIds.includes(componentId),
  );
  const validImplementationStatusIds = new Set(
    Object.values(POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS),
  );
  const invalidTargetImplementationStatusIds = POLICY_AUTHORING_TARGET_IMPLEMENTATIONS
    .filter(record => !validImplementationStatusIds.has(record.statusId))
    .map(record => record.targetComponentId);
  const issues = [
    ...summary.unclassifiedPaths.map(path => ({
      riskId: POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS.UNCLASSIFIED_COMPONENT,
      path,
    })),
    ...duplicateComponentPaths.map(path => ({
      riskId: POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS.DUPLICATE_COMPONENT_PATH,
      path,
    })),
    ...missingComponentPaths.map(path => ({
      riskId: POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS.MISSING_COMPONENT_PATH,
      path,
    })),
    ...unknownTargetComponentIds.map(targetComponentId => ({
      riskId: POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS.UNKNOWN_TARGET_COMPONENT,
      targetComponentId,
    })),
    ...missingTargetImplementationIds.map(targetComponentId => ({
      riskId: POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS.MISSING_TARGET_IMPLEMENTATION,
      targetComponentId,
    })),
    ...invalidTargetImplementationStatusIds.map(targetComponentId => ({
      riskId: POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS.INVALID_TARGET_IMPLEMENTATION_STATUS,
      targetComponentId,
    })),
  ];

  return {
    ok: issues.length === 0,
    checkedComponentCount: summary.total,
    checkedTargetImplementationCount: POLICY_AUTHORING_TARGET_IMPLEMENTATIONS.length,
    nextTargetImplementation: summary.nextTargetImplementation,
    issues,
  };
}

export {
  POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS,
  POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS,
  POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS,
  auditPolicyAuthoringComponentInventory,
  classifyPolicyAuthoringComponent,
  getPolicyAuthoringTargetImplementation,
  listPolicyAuthoringComponentInventory,
  listPolicyAuthoringTargetImplementations,
  summarizePolicyAuthoringComponentInventory,
};
