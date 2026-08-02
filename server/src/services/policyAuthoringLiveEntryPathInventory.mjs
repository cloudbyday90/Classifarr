/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS = Object.freeze({
  ROUTE: 'route',
  LIST_ACTION: 'list_action',
  MODAL: 'modal',
  HASH_TARGET: 'hash_target',
  ADMIN_MAINTENANCE_ROUTE: 'admin_maintenance_route',
});

const POLICY_AUTHORING_LIVE_ACTION_KIND_IDS = Object.freeze({
  SERVER_ACTION: 'server_action',
  LOCAL_DRAFT_COMMAND: 'local_draft_command',
  ACCESSIBLE_NAVIGATION: 'accessible_navigation',
  READ_ONLY_INFORMATION: 'read_only_information',
  REPLACE_OR_REMOVE: 'replace_or_remove',
});

const POLICY_AUTHORING_LIVE_DISPOSITION_IDS = Object.freeze({
  KEEP: 'keep',
  REPLACE: 'replace',
  REMOVE: 'remove',
  OUT_OF_SCOPE: 'out_of_scope',
});

const POLICY_AUTHORING_LIVE_BROWSER_EVIDENCE_STATUS_IDS = Object.freeze({
  NOT_RUN: 'not_run',
  VERIFIED: 'verified',
});

const POLICY_AUTHORING_LIVE_INVENTORY_STATUS_IDS = Object.freeze({
  SOURCE_AUDITED: 'source_audited',
  SOURCE_AUDITED_REMEDIATION_REQUIRED: 'source_audited_remediation_required',
  INVALID: 'invalid',
});

const POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS = Object.freeze({
  ARTIFACT_RESOLVER_REQUIRED: 'artifact_resolver_required',
  ARTIFACT_MISSING: 'artifact_missing',
  ENTRY_POINT_ID_DUPLICATE: 'entry_point_id_duplicate',
  ENTRY_POINT_KIND_INVALID: 'entry_point_kind_invalid',
  ENTRY_POINT_INCOMPLETE: 'entry_point_incomplete',
  ACTION_ID_DUPLICATE: 'action_id_duplicate',
  ACTION_KIND_INVALID: 'action_kind_invalid',
  ACTION_ENTRY_POINT_UNKNOWN: 'action_entry_point_unknown',
  ACTION_INCOMPLETE: 'action_incomplete',
  NATIVE_CREATE_ENTRY_UNREACHABLE: 'native_create_entry_unreachable',
  LEGACY_CARD_NORMAL_PATH: 'legacy_card_normal_path',
  OBSERVED_VALUES_REQUIRE_RESELECTION: 'observed_values_require_reselection',
  OPTIONAL_BOUNDARIES_DEFAULT_VISIBLE: 'optional_boundaries_default_visible',
  PERSISTED_POLICY_MAINTENANCE_UNSPECIFIED: 'persisted_policy_maintenance_unspecified',
  OBSOLETE_HASH_TARGET: 'obsolete_hash_target',
  LIVE_BROWSER_EVIDENCE_PENDING: 'live_browser_evidence_pending',
});

const POLICY_AUTHORING_LIVE_ENTRY_PATH_ARTIFACT_PATHS = Object.freeze([
  'client/src/router/index.js',
  'client/src/views/PolicyList.vue',
  'client/src/components/policies/PolicyCard.vue',
  'client/src/components/policies/PolicyBuilderModal.vue',
  'client/src/components/policies/PolicyBuilderWorkflowShell.vue',
  'client/src/components/policies/PolicyBuilderFooterActions.vue',
  'client/src/components/policies/PolicyNativePolicySummary.vue',
  'client/src/components/policies/PolicyNativePolicyRecoveryNotice.vue',
  'client/src/components/policies/PolicyDestinationEmptyStateNotice.vue',
  'client/src/components/policies/PolicyIntentConstraintControlSurface.vue',
  'client/src/api/policiesApi.js',
  'server/src/routes/policiesRoutePolicyCrud.mjs',
  'server/src/routes/policiesRoutePolicyWrite.mjs',
  'server/src/routes/policiesRouteOperatorWorkflowRead.mjs',
  'server/src/routes/policiesRouteOperatorWorkflowCustomIntentSignal.mjs',
]);

const POLICY_AUTHORING_LIVE_ENTRY_POINTS = Object.freeze([
  {
    id: 'policy_list_route',
    label: 'Policy list route',
    kindId: POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS.ROUTE,
    routePath: '/policies',
    sourcePaths: [
      'client/src/router/index.js',
      'client/src/views/PolicyList.vue',
    ],
    normalAuthoring: true,
    reachable: true,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REPLACE,
    nextOwnerTaskId: 'workflow_presentation_adapter',
    evidence: 'The primary route renders PolicyList, but that page is still the legacy list and modal host rather than the single validated authoring presentation.',
  },
  {
    id: 'existing_policy_configure',
    label: 'Existing policy Configure action',
    kindId: POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS.LIST_ACTION,
    routePath: '/policies',
    sourcePaths: [
      'client/src/views/PolicyList.vue',
      'client/src/components/policies/PolicyCard.vue',
      'client/src/components/policies/PolicyBuilderModal.vue',
      'client/src/api/policiesApi.js',
    ],
    normalAuthoring: true,
    reachable: true,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REPLACE,
    nextOwnerTaskId: 'persisted_policy_maintenance_entry',
    evidence: 'Configure fetches an existing policy and opens the modal. It conflates persisted native inspection, recovery, and legacy editing behind one legacy card action.',
  },
  {
    id: 'native_create_modal',
    label: 'Native policy create modal',
    kindId: POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS.MODAL,
    routePath: '/policies',
    sourcePaths: [
      'client/src/views/PolicyList.vue',
      'client/src/components/policies/PolicyBuilderModal.vue',
      'client/src/components/policies/PolicyBuilderWorkflowShell.vue',
    ],
    normalAuthoring: true,
    reachable: false,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REPLACE,
    nextOwnerTaskId: 'workflow_presentation_adapter',
    evidence: 'PolicyBuilderModal supports native-create mode when it receives no persisted policy, but PolicyList contains no assignment that opens showCreateModal.',
  },
  {
    id: 'advanced_settings_hash',
    label: 'Former advanced-settings hash',
    kindId: POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS.HASH_TARGET,
    routePath: '/policies#policy-builder-advanced-settings',
    sourcePaths: [
      'client/src/__tests__/PolicyBuilderModal.test.js',
      'client/src/components/policies/PolicyBuilderModal.vue',
    ],
    normalAuthoring: false,
    reachable: false,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REMOVE,
    nextOwnerTaskId: 'legacy_builder_cutover',
    evidence: 'The focused modal test asserts that the former hash target is absent; no current authoring component provides that target.',
  },
  {
    id: 'native_intent_reconciliation_route',
    label: 'Native intent reconciliation route',
    kindId: POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS.ADMIN_MAINTENANCE_ROUTE,
    routePath: '/policies/native-intent-reconciliation',
    sourcePaths: [
      'client/src/router/index.js',
      'client/src/views/PolicyList.vue',
    ],
    normalAuthoring: false,
    reachable: true,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.OUT_OF_SCOPE,
    nextOwnerTaskId: 'native_storage_maintenance',
    evidence: 'The router classifies reconciliation as admin-maintenance. It must not become a normal policy-authoring fallback.',
  },
]);

const POLICY_AUTHORING_LIVE_ACTIONS = Object.freeze([
  {
    id: 'open_existing_policy',
    label: 'Open existing policy',
    entryPointId: 'existing_policy_configure',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.REPLACE_OR_REMOVE,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REPLACE,
    nextOwnerTaskId: 'persisted_policy_maintenance_entry',
    clientOperation: 'getPolicy',
    serverContract: 'GET /policies/:id',
    outcome: 'Loads a policy then enters a modal mode determined by the persisted record. The replacement must make inspection and intentional maintenance distinct.',
  },
  {
    id: 'reset_existing_policy',
    label: 'Reset existing policy',
    entryPointId: 'existing_policy_configure',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.REPLACE_OR_REMOVE,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REMOVE,
    nextOwnerTaskId: 'legacy_builder_cutover',
    clientOperation: 'deletePolicy',
    serverContract: 'DELETE /policies/:id',
    outcome: 'Deletes and recreates a legacy policy through a browser confirm dialog. It is not an automation-first native authoring action.',
  },
  {
    id: 'toggle_legacy_weights',
    label: 'Show legacy scoring weights',
    entryPointId: 'existing_policy_configure',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.REPLACE_OR_REMOVE,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REMOVE,
    nextOwnerTaskId: 'legacy_builder_cutover',
    clientOperation: 'local showWeights toggle',
    serverContract: null,
    outcome: 'Exposes legacy scoring mechanics without changing policy state. It has no place in normal native authoring.',
  },
  {
    id: 'create_native_policy',
    label: 'Create native policy',
    entryPointId: 'native_create_modal',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.SERVER_ACTION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REPLACE,
    nextOwnerTaskId: 'action_admission_feedback',
    clientOperation: 'createPolicy',
    serverContract: 'POST /policies with native_intent_establishment',
    outcome: 'The server validates and persists a native policy transaction, but the current normal authoring route cannot open the create mode that owns this action.',
  },
  {
    id: 'defer_native_policy',
    label: 'Defer native policy creation',
    entryPointId: 'native_create_modal',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.ACCESSIBLE_NAVIGATION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'action_admission_feedback',
    clientOperation: 'close modal',
    serverContract: null,
    outcome: 'Closes without persisting. The replacement must retain an explicit no-save path and restore focus to the invoking control.',
  },
  {
    id: 'select_observed_intent_options',
    label: 'Select observed destination options',
    entryPointId: 'native_create_modal',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.LOCAL_DRAFT_COMMAND,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REPLACE,
    nextOwnerTaskId: 'destination_proposal_card',
    clientOperation: 'select checkbox candidates',
    serverContract: null,
    outcome: 'Selection remains transient until a typed add command. A well-profiled library should receive a proposed intent without mandatory reselection of eligible observed values.',
  },
  {
    id: 'accept_observed_intent_options',
    label: 'Add selected destination signals',
    entryPointId: 'native_create_modal',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.LOCAL_DRAFT_COMMAND,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REPLACE,
    nextOwnerTaskId: 'destination_proposal_card',
    clientOperation: 'draft-command-plan add_signal_value',
    serverContract: null,
    outcome: 'Adds an explicit transient intent value. The later proposal card must preserve explicit create admission while reducing this from the ready-path prerequisite.',
  },
  {
    id: 'validate_custom_intent_signal',
    label: 'Validate custom destination value',
    entryPointId: 'native_create_modal',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.SERVER_ACTION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'intent_adjustment_disclosure',
    clientOperation: 'validatePolicyOperatorWorkflowCustomIntentSignal',
    serverContract: 'POST /policies/operator-workflow/libraries/:libraryId/intent-signals/custom',
    outcome: 'Requests a display-only refreshed workflow projection. It does not persist, route, learn, or grant client authority.',
  },
  {
    id: 'stage_or_clear_constraint',
    label: 'Stage or clear optional destination boundaries',
    entryPointId: 'native_create_modal',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.LOCAL_DRAFT_COMMAND,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REPLACE,
    nextOwnerTaskId: 'material_exception_controls',
    clientOperation: 'constraint draft-command plan',
    serverContract: null,
    outcome: 'Stages transient hard-limit, avoid, or review commands. The current native create surface renders optional boundaries by default instead of only for material exceptions.',
  },
  {
    id: 'open_library_mapping',
    label: 'Open library routing mapping',
    entryPointId: 'native_create_modal',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.ACCESSIBLE_NAVIGATION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'material_exception_controls',
    clientOperation: 'router.push LibraryDetail with focus handoff',
    serverContract: null,
    outcome: 'Navigates to the library mapping when the server-projected empty state requests it. It does not execute routing or retry recovery.',
  },
  {
    id: 'inspect_native_policy_summary',
    label: 'Inspect persisted native policy',
    entryPointId: 'existing_policy_configure',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.READ_ONLY_INFORMATION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.REPLACE,
    nextOwnerTaskId: 'persisted_policy_maintenance_entry',
    clientOperation: 'getPolicyNativeReadinessSummary',
    serverContract: 'GET /policies/:id/native-intent/readiness-summary',
    outcome: 'Displays declared purpose, readiness, and automatic recovery state, but provides no deliberate maintenance entry after inspection.',
  },
  {
    id: 'automatic_native_recovery',
    label: 'Automatic native policy recovery',
    entryPointId: 'existing_policy_configure',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.READ_ONLY_INFORMATION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'material_exception_controls',
    clientOperation: 'none',
    serverContract: 'server-owned reconciliation and profile recovery',
    outcome: 'In-progress recovery is intentionally informational and read-only. The normal browser path must not offer provider, quota, reset, or retry controls.',
  },
]);

const POLICY_AUTHORING_LIVE_REMEDIATION = Object.freeze([
  {
    riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.NATIVE_CREATE_ENTRY_UNREACHABLE,
    entryPointId: 'native_create_modal',
    nextOwnerTaskId: 'workflow_presentation_adapter',
    message: 'The native create modal has no normal PolicyList trigger, so the current Create Policy action cannot be reached by a normal operator flow.',
  },
  {
    riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.LEGACY_CARD_NORMAL_PATH,
    entryPointId: 'existing_policy_configure',
    nextOwnerTaskId: 'legacy_builder_cutover',
    message: 'The normal policy card still exposes presets, thresholds, reset, Configure, and raw scoring weights as the authoring path.',
  },
  {
    riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.OBSERVED_VALUES_REQUIRE_RESELECTION,
    entryPointId: 'native_create_modal',
    nextOwnerTaskId: 'destination_proposal_card',
    message: 'The native workflow shows observed library values but requires explicit checkbox selection and add before the create boundary can be admitted.',
  },
  {
    riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.OPTIONAL_BOUNDARIES_DEFAULT_VISIBLE,
    entryPointId: 'native_create_modal',
    nextOwnerTaskId: 'material_exception_controls',
    message: 'Optional hard-limit, avoid, and review controls render whenever their decision model is available instead of only for a material exception.',
  },
  {
    riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.PERSISTED_POLICY_MAINTENANCE_UNSPECIFIED,
    entryPointId: 'existing_policy_configure',
    nextOwnerTaskId: 'persisted_policy_maintenance_entry',
    message: 'The persisted native summary is read-only but has no explicit maintenance entry, leaving Configure to carry incompatible lifecycle meanings.',
  },
  {
    riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.OBSOLETE_HASH_TARGET,
    entryPointId: 'advanced_settings_hash',
    nextOwnerTaskId: 'legacy_builder_cutover',
    message: 'The documented former advanced-settings hash has no current target and must not be treated as a live authoring deep link.',
  },
]);

function listPolicyAuthoringLiveEntryPathArtifactPaths() {
  return [...POLICY_AUTHORING_LIVE_ENTRY_PATH_ARTIFACT_PATHS];
}

function listPolicyAuthoringLiveEntryPoints() {
  return POLICY_AUTHORING_LIVE_ENTRY_POINTS.map(entryPoint => ({
    ...entryPoint,
    sourcePaths: [...entryPoint.sourcePaths],
  }));
}

function listPolicyAuthoringLiveActions() {
  return POLICY_AUTHORING_LIVE_ACTIONS.map(action => ({ ...action }));
}

function listPolicyAuthoringLiveRemediation() {
  return POLICY_AUTHORING_LIVE_REMEDIATION.map(remediation => ({ ...remediation }));
}

function auditArtifactPaths(artifactPaths, artifactExists) {
  if (typeof artifactExists !== 'function') {
    return {
      ok: false,
      checkedCount: 0,
      missingPaths: [],
      issues: [{
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ARTIFACT_RESOLVER_REQUIRED,
        message: 'Live entry-path inventory requires a repository artifact resolver.',
      }],
    };
  }

  const missingPaths = artifactPaths.filter(artifactPath => artifactExists(artifactPath) !== true);

  return {
    ok: missingPaths.length === 0,
    checkedCount: artifactPaths.length,
    missingPaths,
    issues: missingPaths.map(artifactPath => ({
      riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ARTIFACT_MISSING,
      artifactPath,
      message: 'A live entry-path inventory artifact is missing from the repository evidence set.',
    })),
  };
}

function auditEntryPoints(entryPoints = []) {
  const records = Array.isArray(entryPoints) ? entryPoints : [];
  const issues = [];
  const entryPointIds = new Set();

  records.forEach(entryPoint => {
    if (!entryPoint?.id || entryPointIds.has(entryPoint.id)) {
      issues.push({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ENTRY_POINT_ID_DUPLICATE,
        entryPointId: entryPoint?.id || null,
        message: 'Every live policy-authoring entry point must have one unique identifier.',
      });
    }
    entryPointIds.add(entryPoint?.id);

    if (!Object.values(POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS).includes(entryPoint?.kindId)) {
      issues.push({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ENTRY_POINT_KIND_INVALID,
        entryPointId: entryPoint?.id || null,
        message: 'Every entry point must use an approved entry-point kind.',
      });
    }

    if (!entryPoint?.label || !entryPoint?.routePath || !Array.isArray(entryPoint?.sourcePaths) ||
      entryPoint.sourcePaths.length === 0 || typeof entryPoint.normalAuthoring !== 'boolean' ||
      typeof entryPoint.reachable !== 'boolean' ||
      !Object.values(POLICY_AUTHORING_LIVE_DISPOSITION_IDS).includes(entryPoint?.dispositionId) ||
      !entryPoint?.nextOwnerTaskId || !entryPoint?.evidence) {
      issues.push({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ENTRY_POINT_INCOMPLETE,
        entryPointId: entryPoint?.id || null,
        message: 'Every entry point needs route, source, reachability, disposition, owner, and evidence.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    checkedCount: records.length,
    issues,
  };
}

function auditActions(actions = [], entryPoints = []) {
  const records = Array.isArray(actions) ? actions : [];
  const entryPointIds = new Set((Array.isArray(entryPoints) ? entryPoints : []).map(entryPoint => entryPoint?.id));
  const issues = [];
  const actionIds = new Set();

  records.forEach(action => {
    if (!action?.id || actionIds.has(action.id)) {
      issues.push({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ACTION_ID_DUPLICATE,
        actionId: action?.id || null,
        message: 'Every visible policy-authoring action must have one unique identifier.',
      });
    }
    actionIds.add(action?.id);

    if (!Object.values(POLICY_AUTHORING_LIVE_ACTION_KIND_IDS).includes(action?.kindId)) {
      issues.push({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ACTION_KIND_INVALID,
        actionId: action?.id || null,
        message: 'Every action must use an approved action classification.',
      });
    }

    if (!entryPointIds.has(action?.entryPointId)) {
      issues.push({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ACTION_ENTRY_POINT_UNKNOWN,
        actionId: action?.id || null,
        entryPointId: action?.entryPointId || null,
        message: 'Every action must belong to one inventoried entry point.',
      });
    }

    if (!action?.label || !Object.values(POLICY_AUTHORING_LIVE_DISPOSITION_IDS).includes(action?.dispositionId) ||
      !action?.nextOwnerTaskId || !action?.clientOperation || !action?.outcome ||
      (action.kindId === POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.SERVER_ACTION && !action?.serverContract)) {
      issues.push({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ACTION_INCOMPLETE,
        actionId: action?.id || null,
        message: 'Every action needs classification, owner, client operation, outcome, and a server contract when it calls the server.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    checkedCount: records.length,
    issues,
  };
}

function buildPolicyAuthoringLiveEntryPathInventory({
  artifactExists,
  entryPoints = POLICY_AUTHORING_LIVE_ENTRY_POINTS,
  actions = POLICY_AUTHORING_LIVE_ACTIONS,
  browserEvidenceStatus = POLICY_AUTHORING_LIVE_BROWSER_EVIDENCE_STATUS_IDS.NOT_RUN,
} = {}) {
  const artifactAudit = auditArtifactPaths(
    listPolicyAuthoringLiveEntryPathArtifactPaths(),
    artifactExists,
  );
  const entryPointAudit = auditEntryPoints(entryPoints);
  const actionAudit = auditActions(actions, entryPoints);
  const validationIssues = [
    ...artifactAudit.issues,
    ...entryPointAudit.issues,
    ...actionAudit.issues,
  ];
  const browserEvidenceIssue = browserEvidenceStatus === POLICY_AUTHORING_LIVE_BROWSER_EVIDENCE_STATUS_IDS.VERIFIED
    ? []
    : [{
      riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.LIVE_BROWSER_EVIDENCE_PENDING,
      message: 'Source-backed inventory is complete, but live browser rendering and interaction verification has not yet been recorded.',
    }];
  const remediation = validationIssues.length === 0
    ? listPolicyAuthoringLiveRemediation()
    : [];

  return {
    version: 1,
    auditId: 'policy_authoring_live_entry_path_inventory',
    inventoryComplete: validationIssues.length === 0,
    sourceExperienceReady: validationIssues.length === 0 && remediation.length === 0,
    statusId: validationIssues.length > 0
      ? POLICY_AUTHORING_LIVE_INVENTORY_STATUS_IDS.INVALID
      : remediation.length > 0
        ? POLICY_AUTHORING_LIVE_INVENTORY_STATUS_IDS.SOURCE_AUDITED_REMEDIATION_REQUIRED
        : POLICY_AUTHORING_LIVE_INVENTORY_STATUS_IDS.SOURCE_AUDITED,
    artifactAudit,
    entryPointAudit,
    actionAudit,
    browserEvidence: {
      statusId: browserEvidenceStatus,
      required: true,
      issues: browserEvidenceIssue,
    },
    entryPoints: listPolicyAuthoringLiveEntryPoints(),
    actions: listPolicyAuthoringLiveActions(),
    remediation,
    nextStep: {
      id: 'policy_intent_contract_authority',
      label: 'Server Intent Contract Authority',
      reason: 'The inventory identifies /policies as the replacement cutline. Its successor cannot render a new primary action until the server-owned intent and admitted write contracts are reconciled.',
    },
  };
}

export {
  POLICY_AUTHORING_LIVE_ACTION_KIND_IDS,
  POLICY_AUTHORING_LIVE_BROWSER_EVIDENCE_STATUS_IDS,
  POLICY_AUTHORING_LIVE_DISPOSITION_IDS,
  POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS,
  POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS,
  POLICY_AUTHORING_LIVE_INVENTORY_STATUS_IDS,
  auditActions,
  auditArtifactPaths,
  auditEntryPoints,
  buildPolicyAuthoringLiveEntryPathInventory,
  listPolicyAuthoringLiveActions,
  listPolicyAuthoringLiveEntryPathArtifactPaths,
  listPolicyAuthoringLiveEntryPoints,
  listPolicyAuthoringLiveRemediation,
};
