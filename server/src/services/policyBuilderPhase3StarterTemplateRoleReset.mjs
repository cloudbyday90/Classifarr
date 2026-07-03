import {
  PHASE_2R_DRAFT_COMMAND_IDS,
  validatePhase2RDraftCommand,
} from './policyBuilderPhase2DraftCommandBoundary.mjs';
import {
  PHASE_3R_COMPONENT_IDS,
  PHASE_3R_INTERACTION_RULE_IDS,
} from './policyBuilderPhase3ComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS,
} from './policyAuthoringDestinationFlow.mjs';
import {
  POLICY_AUTHORING_WORKFLOW_DECISION_IDS,
  POLICY_AUTHORING_WORKFLOW_ROLE_IDS,
} from './policyAuthoringWorkflowInventory.mjs';
import {
  POLICY_UX_TERM_IDS,
} from './policyUserMentalModel.mjs';

const PHASE_3R_TEMPLATE_ROLE_IDS = Object.freeze({
  OPTIONAL_ACCELERATOR: 'optional_accelerator',
  SECONDARY_PROVENANCE: 'secondary_provenance',
  BRIDGE_ONLY_MECHANIC: 'bridge_only_mechanic',
  DELETE_AFTER_NATIVE_STORAGE: 'delete_after_native_storage',
});

const PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS = Object.freeze({
  BELONGS_HERE: POLICY_UX_TERM_IDS.BELONGS_HERE,
  HELPFUL_MATCHES: POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
  HARD_LIMITS: POLICY_UX_TERM_IDS.HARD_LIMITS,
  AVOID: POLICY_UX_TERM_IDS.AVOID,
});

const PHASE_3R_TEMPLATE_MECHANIC_IDS = Object.freeze({
  TEMPLATE_BROWSER: 'template_browser',
  TEMPLATE_DETAILS: 'template_details',
  TEMPLATE_MECHANICS: 'template_mechanics',
  TEMPLATE_WEIGHT: 'template_weight',
  RAW_CUSTOM_SIGNALS: 'raw_custom_signals',
  REMOVED_SIGNAL_MARKERS: 'removed_signal_markers',
  STRICT_ADVISORY_METADATA: 'strict_advisory_metadata',
});

const PHASE_3R_TEMPLATE_RISK_IDS = Object.freeze({
  TEMPLATE_BEFORE_DESTINATION_CONTEXT: 'template_before_destination_context',
  TEMPLATE_REQUIRED_FOR_POLICY: 'template_required_for_policy',
  UNKNOWN_TEMPLATE_BUCKET: 'unknown_template_bucket',
  MISSING_TEMPLATE_VALUE: 'missing_template_value',
  RAW_TEMPLATE_MECHANIC_IN_NORMAL_FLOW: 'raw_template_mechanic_in_normal_flow',
  TEMPLATE_PROVENANCE_PRIMARY: 'template_provenance_primary',
  INVALID_DRAFT_COMMAND: 'invalid_draft_command',
});

const TEMPLATE_BUCKET_TO_SIGNAL = Object.freeze({
  [PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.BELONGS_HERE]: {
    signalType: 'genres',
    key: 'require_any',
  },
  [PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.HELPFUL_MATCHES]: {
    signalType: 'genres',
    key: 'prefer',
  },
  [PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.HARD_LIMITS]: {
    signalType: 'certifications',
    key: 'max',
  },
  [PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.AVOID]: {
    signalType: 'certifications',
    key: 'exclude',
  },
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

function toCleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const PHASE_3R_TEMPLATE_ROLE_RECORDS = deepFreeze([
  {
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.OPTIONAL_ACCELERATOR,
    label: 'Optional accelerator',
    normalAuthoringAllowed: true,
    requiresDestinationContext: true,
    canBeRequiredToSave: false,
    componentId: PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
  },
  {
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.SECONDARY_PROVENANCE,
    label: 'Secondary provenance',
    normalAuthoringAllowed: true,
    requiresDestinationContext: true,
    canBeRequiredToSave: false,
    componentId: PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
  },
  {
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.BRIDGE_ONLY_MECHANIC,
    label: 'Bridge-only mechanic',
    normalAuthoringAllowed: false,
    requiresDestinationContext: false,
    canBeRequiredToSave: false,
    componentId: PHASE_3R_COMPONENT_IDS.MIGRATION_VERIFIER_PANEL,
  },
  {
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    label: 'Delete after native storage',
    normalAuthoringAllowed: false,
    requiresDestinationContext: false,
    canBeRequiredToSave: false,
    componentId: PHASE_3R_COMPONENT_IDS.MIGRATION_VERIFIER_PANEL,
  },
]);

const PHASE_3R_TEMPLATE_MECHANIC_RECORDS = deepFreeze([
  {
    mechanicId: PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_BROWSER,
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.OPTIONAL_ACCELERATOR,
    workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
    workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.STARTER_TEMPLATE_ACCELERATOR,
    normalAuthoringAllowed: true,
    deleteAfterPhase8R: false,
    notes: 'Browser can remain only after destination context and as optional accelerator.',
  },
  {
    mechanicId: PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_DETAILS,
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.SECONDARY_PROVENANCE,
    workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
    workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.STARTER_TEMPLATE_ACCELERATOR,
    normalAuthoringAllowed: true,
    deleteAfterPhase8R: false,
    notes: 'Details can explain provenance but cannot become the primary editing surface.',
  },
  {
    mechanicId: PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_MECHANICS,
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.BRIDGE_ONLY_MECHANIC,
    workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
    normalAuthoringAllowed: false,
    deleteAfterPhase8R: true,
    notes: 'Raw mechanics are bridge/verifier-only and should leave normal authoring.',
  },
  {
    mechanicId: PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_WEIGHT,
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.BRIDGE_ONLY_MECHANIC,
    workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.COMPATIBILITY_BRIDGE,
    normalAuthoringAllowed: false,
    deleteAfterPhase8R: true,
    notes: 'Template weights are compatibility scoring mechanics, not intent language.',
  },
  {
    mechanicId: PHASE_3R_TEMPLATE_MECHANIC_IDS.RAW_CUSTOM_SIGNALS,
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.COMPATIBILITY_BRIDGE,
    normalAuthoringAllowed: false,
    deleteAfterPhase8R: true,
    notes: 'Raw customSignals must be replaced by native intent storage.',
  },
  {
    mechanicId: PHASE_3R_TEMPLATE_MECHANIC_IDS.REMOVED_SIGNAL_MARKERS,
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.COMPATIBILITY_BRIDGE,
    normalAuthoringAllowed: false,
    deleteAfterPhase8R: true,
    notes: 'Removed markers are compatibility bridge state, not a normal product concept.',
  },
  {
    mechanicId: PHASE_3R_TEMPLATE_MECHANIC_IDS.STRICT_ADVISORY_METADATA,
    roleId: PHASE_3R_TEMPLATE_ROLE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.DELETE,
    workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.COMPATIBILITY_BRIDGE,
    normalAuthoringAllowed: false,
    deleteAfterPhase8R: true,
    notes: 'Strict/advisory metadata moves to native constraint semantics.',
  },
]);

const ROLE_BY_ID = new Map(PHASE_3R_TEMPLATE_ROLE_RECORDS.map(record => [record.roleId, record]));
const MECHANIC_BY_ID = new Map(PHASE_3R_TEMPLATE_MECHANIC_RECORDS.map(record => [record.mechanicId, record]));

function listPhase3RStarterTemplateRoleRecords() {
  return PHASE_3R_TEMPLATE_ROLE_RECORDS;
}

function listPhase3RStarterTemplateMechanicRecords() {
  return PHASE_3R_TEMPLATE_MECHANIC_RECORDS;
}

function getPhase3RStarterTemplateRoleRecord(roleId) {
  return ROLE_BY_ID.get(roleId) || null;
}

function getPhase3RStarterTemplateMechanicRecord(mechanicId) {
  return MECHANIC_BY_ID.get(mechanicId) || null;
}

function normalizePhase3RTemplateSuggestion(suggestion = {}) {
  const bucketId = toCleanString(suggestion.bucketId);
  const mapping = TEMPLATE_BUCKET_TO_SIGNAL[bucketId] || null;

  return {
    templateId: toCleanString(suggestion.templateId),
    templateName: toCleanString(suggestion.templateName) || 'Starter template',
    bucketId,
    label: toCleanString(suggestion.label) || toCleanString(suggestion.value),
    value: toCleanString(suggestion.value),
    explanation: toCleanString(suggestion.explanation),
    provenanceRoleId: PHASE_3R_TEMPLATE_ROLE_IDS.SECONDARY_PROVENANCE,
    sourceLabel: 'Starter template suggestion',
    signalType: mapping?.signalType || null,
    key: mapping?.key || null,
  };
}

function validatePhase3RTemplateSuggestion(suggestion = {}) {
  const normalizedSuggestion = normalizePhase3RTemplateSuggestion(suggestion);

  if (!TEMPLATE_BUCKET_TO_SIGNAL[normalizedSuggestion.bucketId]) {
    return {
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.UNKNOWN_TEMPLATE_BUCKET,
      normalizedSuggestion,
      reason: 'Starter template suggestion bucket is not part of Phase 0R product vocabulary.',
    };
  }

  if (!normalizedSuggestion.value) {
    return {
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.MISSING_TEMPLATE_VALUE,
      normalizedSuggestion,
      reason: 'Starter template suggestion requires a value before it can become a draft command.',
    };
  }

  return {
    valid: true,
    riskId: null,
    normalizedSuggestion,
    reason: 'Starter template suggestion is mapped to Phase 0R vocabulary and secondary provenance.',
  };
}

function validatePolicyAuthoringStarterTemplatePlacement({
  destinationContextVisible = false,
  templateRequiredToSave = false,
  provenancePrimary = false,
} = {}) {
  if (!destinationContextVisible) {
    return {
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.TEMPLATE_BEFORE_DESTINATION_CONTEXT,
      reason: 'Starter templates can appear only after destination context is visible.',
    };
  }

  if (templateRequiredToSave) {
    return {
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.TEMPLATE_REQUIRED_FOR_POLICY,
      reason: 'Users must be able to build and save a policy without selecting a starter template.',
    };
  }

  if (provenancePrimary) {
    return {
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.TEMPLATE_PROVENANCE_PRIMARY,
      reason: 'Starter-template provenance must remain secondary to destination context and declared intent.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Starter templates are optional post-destination accelerators.',
  };
}

function buildPhase3RTemplateApplicationCommands({ presetId, suggestions = [] } = {}) {
  const normalizedPresetId = toCleanString(presetId);
  const validationResults = asArray(suggestions).map(suggestion => validatePhase3RTemplateSuggestion(suggestion));
  const commands = validationResults
    .filter(result => result.valid)
    .map(result => result.normalizedSuggestion)
    .map(suggestion => ({
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      payload: {
        presetId: normalizedPresetId || suggestion.templateId,
        signalType: suggestion.signalType,
        key: suggestion.key,
        value: suggestion.value,
        provenance: {
          source: 'starter_template',
          templateId: suggestion.templateId || normalizedPresetId,
          templateName: suggestion.templateName,
          roleId: suggestion.provenanceRoleId,
        },
      },
    }));
  const commandValidations = commands.map(command => validatePhase2RDraftCommand(command));

  return {
    componentId: PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    interactionRuleId: PHASE_3R_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
    commandBoundary: 'typed_draft_commands',
    commandCount: commands.length,
    commands,
    commandValidations,
    rejectedSuggestions: validationResults
      .filter(result => !result.valid)
      .map(result => ({
        bucketId: result.normalizedSuggestion.bucketId,
        value: result.normalizedSuggestion.value,
        riskId: result.riskId,
        reason: result.reason,
      })),
    valid: commandValidations.every(result => result.valid),
    riskId: commandValidations.every(result => result.valid)
      ? null
      : PHASE_3R_TEMPLATE_RISK_IDS.INVALID_DRAFT_COMMAND,
  };
}

function validatePhase3RTemplateMechanicSurface(mechanicId) {
  const record = getPhase3RStarterTemplateMechanicRecord(mechanicId);
  if (!record) {
    return {
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.RAW_TEMPLATE_MECHANIC_IN_NORMAL_FLOW,
      reason: 'Unknown starter-template mechanic cannot appear in normal authoring.',
    };
  }

  if (!record.normalAuthoringAllowed) {
    return {
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.RAW_TEMPLATE_MECHANIC_IN_NORMAL_FLOW,
      record,
      reason: 'Starter-template mechanic is bridge-only or delete-after-native-storage.',
    };
  }

  return {
    valid: true,
    riskId: null,
    record,
    reason: 'Starter-template mechanic is allowed only as an optional accelerator after destination context.',
  };
}

function summarizePhase3RStarterTemplateRoleReset() {
  return {
    roleCount: PHASE_3R_TEMPLATE_ROLE_RECORDS.length,
    mechanicCount: PHASE_3R_TEMPLATE_MECHANIC_RECORDS.length,
    suggestionBucketIds: Object.values(PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS),
    normalAuthoringMechanicIds: PHASE_3R_TEMPLATE_MECHANIC_RECORDS
      .filter(record => record.normalAuthoringAllowed)
      .map(record => record.mechanicId),
    bridgeOnlyOrDeleteMechanicIds: PHASE_3R_TEMPLATE_MECHANIC_RECORDS
      .filter(record => !record.normalAuthoringAllowed)
      .map(record => record.mechanicId),
    templatesRequiredToSave: false,
    destinationContextRequiredFirst: true,
    applicationCommandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
  };
}

export {
  PHASE_3R_TEMPLATE_MECHANIC_IDS,
  PHASE_3R_TEMPLATE_RISK_IDS,
  PHASE_3R_TEMPLATE_ROLE_IDS,
  PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS,
  buildPhase3RTemplateApplicationCommands,
  getPhase3RStarterTemplateMechanicRecord,
  getPhase3RStarterTemplateRoleRecord,
  listPhase3RStarterTemplateMechanicRecords,
  listPhase3RStarterTemplateRoleRecords,
  normalizePhase3RTemplateSuggestion,
  summarizePhase3RStarterTemplateRoleReset,
  validatePolicyAuthoringStarterTemplatePlacement,
  validatePhase3RTemplateMechanicSurface,
  validatePhase3RTemplateSuggestion,
};
