import {
  POLICY_AUTHORING_COMPONENT_IDS,
  getPolicyAuthoringTargetComponent,
  listPolicyAuthoringTargetComponents,
} from './policyAuthoringComponentSystem.mjs';
import {
  includesInternalPolicyLanguage,
} from './policyUserMentalModel.mjs';

const PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS = Object.freeze({
  DESTINATION_CONTEXT: 'destination_context',
  OBSERVED_PROFILE: 'observed_profile',
  INTENT_SIGNAL_PICKER: 'intent_signal_picker',
  INTENT_SIGNAL_CHIP_LIST: 'intent_signal_chip_list',
  HARD_LIMITS: 'hard_limits',
  AVOID: 'avoid',
  REVIEW_TRIGGERS: 'review_triggers',
  READINESS_NEXT_ACTION: 'readiness_next_action',
  STARTER_TEMPLATE_SUGGESTION: 'starter_template_suggestion',
  MIGRATION_VERIFIER: 'migration_verifier',
});

const PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS = Object.freeze({
  ACCESSIBLE_NAME: 'accessible_name',
  HELPER_TEXT: 'helper_text',
  KEYBOARD_OPERABLE: 'keyboard_operable',
  VISIBLE_FOCUS: 'visible_focus',
  DISABLED_REASON: 'disabled_reason',
  MULTI_SELECT_STATE: 'multi_select_state',
  CHIP_REMOVE_NAME: 'chip_remove_name',
  SINGLE_PRIMARY_ACTION: 'single_primary_action',
  SINGLE_NEXT_ACTION: 'single_next_action',
  DESTRUCTIVE_CONFIRMATION: 'destructive_confirmation',
  NO_DUPLICATE_WARNING_CONCEPT: 'no_duplicate_warning_concept',
  NO_INTERNAL_DIAGNOSTICS_IN_NORMAL_PATH: 'no_internal_diagnostics_in_normal_path',
});

const PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS = Object.freeze({
  UNKNOWN_SURFACE: 'unknown_surface',
  UNKNOWN_COMPONENT: 'unknown_component',
  MISSING_ACCESSIBLE_NAME: 'missing_accessible_name',
  MISSING_HELPER_TEXT: 'missing_helper_text',
  KEYBOARD_NOT_REQUIRED: 'keyboard_not_required',
  FOCUS_NOT_REQUIRED: 'focus_not_required',
  MISSING_DISABLED_REASON: 'missing_disabled_reason',
  MISSING_MULTI_SELECT_STATE: 'missing_multi_select_state',
  MISSING_CHIP_REMOVE_NAME: 'missing_chip_remove_name',
  TOO_MANY_PRIMARY_ACTIONS: 'too_many_primary_actions',
  MISSING_SINGLE_NEXT_ACTION: 'missing_single_next_action',
  MISSING_DESTRUCTIVE_CONFIRMATION: 'missing_destructive_confirmation',
  DUPLICATE_WARNING_CONCEPT: 'duplicate_warning_concept',
  INTERNAL_DIAGNOSTIC_NORMAL_PATH: 'internal_diagnostic_normal_path',
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

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACES = deepFreeze([
  {
    id: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.DESTINATION_CONTEXT,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
    label: 'Destination context',
    helperText: 'Choose the library before editing destination intent.',
    normalPath: true,
    keyboardOperable: true,
    visibleFocusRequired: true,
    disabledReasonRequired: false,
    multiSelectStateRequired: false,
    chipRemoveNameRequired: false,
    destructiveConfirmationRequired: false,
    singleNextActionRequired: false,
    maxPrimaryActions: 1,
    warningConceptIds: [],
    internalDiagnosticsAllowed: false,
  },
  {
    id: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.OBSERVED_PROFILE,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
    label: 'Observed profile',
    helperText: 'Show observed examples as suggestions before they become declared intent.',
    normalPath: true,
    keyboardOperable: true,
    visibleFocusRequired: true,
    disabledReasonRequired: false,
    multiSelectStateRequired: false,
    chipRemoveNameRequired: false,
    destructiveConfirmationRequired: false,
    singleNextActionRequired: false,
    maxPrimaryActions: 1,
    warningConceptIds: [],
    internalDiagnosticsAllowed: false,
  },
  {
    id: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.INTENT_SIGNAL_PICKER,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    label: 'Intent signal picker',
    helperText: 'Add one or more accepted belongs-here or helpful values through typed draft commands.',
    normalPath: true,
    keyboardOperable: true,
    visibleFocusRequired: true,
    disabledReasonRequired: true,
    multiSelectStateRequired: true,
    chipRemoveNameRequired: false,
    destructiveConfirmationRequired: false,
    singleNextActionRequired: false,
    maxPrimaryActions: 1,
    warningConceptIds: [],
    internalDiagnosticsAllowed: false,
  },
  {
    id: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.INTENT_SIGNAL_CHIP_LIST,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
    label: 'Declared intent chips',
    helperText: 'Show accepted values with clear removal names.',
    normalPath: true,
    keyboardOperable: true,
    visibleFocusRequired: true,
    disabledReasonRequired: false,
    multiSelectStateRequired: false,
    chipRemoveNameRequired: true,
    destructiveConfirmationRequired: false,
    singleNextActionRequired: false,
    maxPrimaryActions: 1,
    warningConceptIds: [],
    internalDiagnosticsAllowed: false,
  },
  {
    id: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.HARD_LIMITS,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    label: 'Hard limits',
    helperText: 'Confirm explicit blocking rules before they can affect classification or routing.',
    normalPath: true,
    keyboardOperable: true,
    visibleFocusRequired: true,
    disabledReasonRequired: true,
    multiSelectStateRequired: false,
    chipRemoveNameRequired: false,
    destructiveConfirmationRequired: true,
    singleNextActionRequired: false,
    maxPrimaryActions: 1,
    warningConceptIds: ['blocking_constraint'],
    internalDiagnosticsAllowed: false,
  },
  {
    id: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.AVOID,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
    label: 'Avoid',
    helperText: 'Add explicit poor-fit warnings without turning observed absence into a blocker.',
    normalPath: true,
    keyboardOperable: true,
    visibleFocusRequired: true,
    disabledReasonRequired: true,
    multiSelectStateRequired: true,
    chipRemoveNameRequired: false,
    destructiveConfirmationRequired: false,
    singleNextActionRequired: false,
    maxPrimaryActions: 1,
    warningConceptIds: ['negative_evidence'],
    internalDiagnosticsAllowed: false,
  },
  {
    id: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.REVIEW_TRIGGERS,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    label: 'Ask when unsure',
    helperText: 'Choose the conditions that should ask the operator instead of automating.',
    normalPath: true,
    keyboardOperable: true,
    visibleFocusRequired: true,
    disabledReasonRequired: true,
    multiSelectStateRequired: true,
    chipRemoveNameRequired: false,
    destructiveConfirmationRequired: false,
    singleNextActionRequired: false,
    maxPrimaryActions: 1,
    warningConceptIds: ['review_trigger'],
    internalDiagnosticsAllowed: false,
  },
  {
    id: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.READINESS_NEXT_ACTION,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
    label: 'Readiness next action',
    helperText: 'Show the highest-priority readiness issue and one action that resolves it.',
    normalPath: true,
    keyboardOperable: true,
    visibleFocusRequired: true,
    disabledReasonRequired: false,
    multiSelectStateRequired: false,
    chipRemoveNameRequired: false,
    destructiveConfirmationRequired: false,
    singleNextActionRequired: true,
    maxPrimaryActions: 1,
    warningConceptIds: ['readiness_issue'],
    internalDiagnosticsAllowed: false,
  },
  {
    id: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.STARTER_TEMPLATE_SUGGESTION,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
    label: 'Starter template suggestion',
    helperText: 'Offer an optional shortcut after destination context is visible.',
    normalPath: false,
    keyboardOperable: true,
    visibleFocusRequired: true,
    disabledReasonRequired: true,
    multiSelectStateRequired: false,
    chipRemoveNameRequired: false,
    destructiveConfirmationRequired: false,
    singleNextActionRequired: false,
    maxPrimaryActions: 1,
    warningConceptIds: [],
    internalDiagnosticsAllowed: false,
  },
  {
    id: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS.MIGRATION_VERIFIER,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.MIGRATION_VERIFIER_PANEL,
    label: 'Migration verifier',
    helperText: 'Keep migration diagnostics outside the normal authoring workflow.',
    normalPath: false,
    keyboardOperable: true,
    visibleFocusRequired: true,
    disabledReasonRequired: false,
    multiSelectStateRequired: false,
    chipRemoveNameRequired: false,
    destructiveConfirmationRequired: false,
    singleNextActionRequired: false,
    maxPrimaryActions: 2,
    warningConceptIds: [],
    internalDiagnosticsAllowed: true,
  },
]);

function listPhase3AccessibilityDecisionLoadSurfaces() {
  return PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACES;
}

function getPhase3AccessibilityDecisionLoadSurface(surfaceId) {
  return PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACES.find(surface => surface.id === surfaceId) || null;
}

function validatePhase3AccessibilityDecisionLoadSurface(surface = {}) {
  const record = getPhase3AccessibilityDecisionLoadSurface(surface.id);
  const candidate = {
    ...record,
    ...asObject(surface),
  };
  const issues = [];
  const component = getPolicyAuthoringTargetComponent(candidate.componentId);
  const candidateRequiredRuleIds = requiredRuleIds(candidate);
  const candidateProvidedRuleIds = providedRuleIds(candidate);

  if (!record) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.UNKNOWN_SURFACE,
      surfaceId: surface.id || null,
      message: 'Accessibility and decision-load surface must be part of the Phase 3R.8 contract.',
    });
  }

  if (!component) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.UNKNOWN_COMPONENT,
      surfaceId: candidate.id || null,
      componentId: candidate.componentId || null,
      message: 'Surface must map to a known policy authoring component.',
    });
  }

  if (!cleanString(candidate.label)) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.MISSING_ACCESSIBLE_NAME,
      surfaceId: candidate.id || null,
      message: 'Surface must define a visible accessible name.',
    });
  }

  if (!cleanString(candidate.helperText)) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.MISSING_HELPER_TEXT,
      surfaceId: candidate.id || null,
      message: 'Surface must provide concise helper text.',
    });
  }

  if (candidate.keyboardOperable !== true) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.KEYBOARD_NOT_REQUIRED,
      surfaceId: candidate.id || null,
      message: 'Surface must require keyboard operation.',
    });
  }

  if (candidate.visibleFocusRequired !== true) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.FOCUS_NOT_REQUIRED,
      surfaceId: candidate.id || null,
      message: 'Surface must require visible focus.',
    });
  }

  if (candidate.disabledReasonRequired === true &&
      !candidateProvidedRuleIds.includes(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.DISABLED_REASON)) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.MISSING_DISABLED_REASON,
      surfaceId: candidate.id || null,
      message: 'Surface with disabled choices must expose disabled reasons.',
    });
  }

  if (candidate.multiSelectStateRequired === true &&
      !candidateProvidedRuleIds.includes(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.MULTI_SELECT_STATE)) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.MISSING_MULTI_SELECT_STATE,
      surfaceId: candidate.id || null,
      message: 'Multi-select surface must expose selected state.',
    });
  }

  if (candidate.chipRemoveNameRequired === true &&
      !candidateProvidedRuleIds.includes(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.CHIP_REMOVE_NAME)) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.MISSING_CHIP_REMOVE_NAME,
      surfaceId: candidate.id || null,
      message: 'Chip-list surface must expose removal names that include the removed value.',
    });
  }

  if (candidate.destructiveConfirmationRequired === true &&
      !candidateProvidedRuleIds.includes(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.DESTRUCTIVE_CONFIRMATION)) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.MISSING_DESTRUCTIVE_CONFIRMATION,
      surfaceId: candidate.id || null,
      message: 'Blocking or destructive surfaces must require explicit confirmation.',
    });
  }

  if (candidate.singleNextActionRequired === true &&
      !candidateProvidedRuleIds.includes(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.SINGLE_NEXT_ACTION)) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.MISSING_SINGLE_NEXT_ACTION,
      surfaceId: candidate.id || null,
      message: 'Readiness surface must expose one primary next action.',
    });
  }

  if (Number(candidate.maxPrimaryActions) > 1 && candidate.normalPath === true) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.TOO_MANY_PRIMARY_ACTIONS,
      surfaceId: candidate.id || null,
      message: 'Normal workflow surfaces must not expose more than one primary action.',
    });
  }

  const warningConceptIds = asArray(candidate.warningConceptIds);
  if (new Set(warningConceptIds).size !== warningConceptIds.length) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.DUPLICATE_WARNING_CONCEPT,
      surfaceId: candidate.id || null,
      message: 'Surface must not repeat the same warning concept.',
    });
  }

  const surfaceText = [
    candidate.label,
    candidate.helperText,
  ].filter(Boolean).join(' ');

  if (candidate.normalPath === true &&
      candidate.internalDiagnosticsAllowed !== true &&
      includesInternalPolicyLanguage(surfaceText)) {
    issues.push({
      riskId: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS.INTERNAL_DIAGNOSTIC_NORMAL_PATH,
      surfaceId: candidate.id || null,
      message: 'Normal workflow surfaces must not expose internal diagnostic language.',
    });
  }

  return {
    ok: issues.length === 0,
    surfaceId: candidate.id || null,
    componentId: candidate.componentId || null,
    requiredRuleIds: candidateRequiredRuleIds,
    providedRuleIds: candidateProvidedRuleIds,
    issues,
  };
}

function providedRuleIds(surface = {}) {
  return Array.isArray(surface.providedRuleIds) ? surface.providedRuleIds : requiredRuleIds(surface);
}

function requiredRuleIds(surface = {}) {
  const rules = [
    PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.ACCESSIBLE_NAME,
    PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.HELPER_TEXT,
    PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.KEYBOARD_OPERABLE,
    PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.VISIBLE_FOCUS,
    PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.SINGLE_PRIMARY_ACTION,
    PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.NO_DUPLICATE_WARNING_CONCEPT,
  ];

  if (surface.disabledReasonRequired) {
    rules.push(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.DISABLED_REASON);
  }

  if (surface.multiSelectStateRequired) {
    rules.push(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.MULTI_SELECT_STATE);
  }

  if (surface.chipRemoveNameRequired) {
    rules.push(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.CHIP_REMOVE_NAME);
  }

  if (surface.destructiveConfirmationRequired) {
    rules.push(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.DESTRUCTIVE_CONFIRMATION);
  }

  if (surface.singleNextActionRequired) {
    rules.push(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.SINGLE_NEXT_ACTION);
  }

  if (surface.normalPath && !surface.internalDiagnosticsAllowed) {
    rules.push(PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS.NO_INTERNAL_DIAGNOSTICS_IN_NORMAL_PATH);
  }

  return rules;
}

function buildPhase3AccessibilityDecisionLoadAudit(surfaces = PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACES) {
  const results = (Array.isArray(surfaces) ? surfaces : [])
    .map(surface => validatePhase3AccessibilityDecisionLoadSurface(surface));
  const issues = results.flatMap(result => result.issues);
  const componentIds = new Set(listPolicyAuthoringTargetComponents().map(component => component.id));
  const coveredComponentIds = new Set((Array.isArray(surfaces) ? surfaces : [])
    .map(surface => surface.componentId)
    .filter(componentId => componentIds.has(componentId)));
  const uncoveredComponentIds = [...componentIds].filter(componentId => !coveredComponentIds.has(componentId));

  return {
    ok: issues.length === 0 && uncoveredComponentIds.length === 0,
    checkedSurfaceCount: results.length,
    coveredComponentCount: coveredComponentIds.size,
    uncoveredComponentIds,
    issueCount: issues.length,
    results,
    issues,
  };
}

function summarizePhase3AccessibilityDecisionLoad() {
  const normalPathSurfaceIds = PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACES
    .filter(surface => surface.normalPath)
    .map(surface => surface.id);
  const multiSelectSurfaceIds = PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACES
    .filter(surface => surface.multiSelectStateRequired)
    .map(surface => surface.id);
  const disabledReasonSurfaceIds = PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACES
    .filter(surface => surface.disabledReasonRequired)
    .map(surface => surface.id);

  return {
    surfaceCount: PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACES.length,
    normalPathSurfaceIds,
    multiSelectSurfaceIds,
    disabledReasonSurfaceIds,
    maxNormalPathPrimaryActions: Math.max(
      ...PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACES
        .filter(surface => surface.normalPath)
        .map(surface => surface.maxPrimaryActions),
    ),
  };
}

export {
  PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RISK_IDS,
  PHASE_3R_ACCESSIBILITY_DECISION_LOAD_RULE_IDS,
  PHASE_3R_ACCESSIBILITY_DECISION_LOAD_SURFACE_IDS,
  buildPhase3AccessibilityDecisionLoadAudit,
  getPhase3AccessibilityDecisionLoadSurface,
  listPhase3AccessibilityDecisionLoadSurfaces,
  summarizePhase3AccessibilityDecisionLoad,
  validatePhase3AccessibilityDecisionLoadSurface,
};
