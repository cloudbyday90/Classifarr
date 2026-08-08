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
  CONTROLLED_RENDER_VERIFIED: 'controlled_render_verified',
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
  LIVE_BROWSER_EVIDENCE_PENDING: 'live_browser_evidence_pending',
  LIVE_BROWSER_EVIDENCE_STATUS_INVALID: 'live_browser_evidence_status_invalid',
});

const POLICY_AUTHORING_LIVE_ENTRY_PATH_ARTIFACT_PATHS = Object.freeze([
  'client/src/router/index.js',
  'client/src/views/PolicyList.vue',
  'client/src/components/policies/PolicyAuthoringLifecycleEntry.vue',
  'client/src/components/policies/PolicyDestinationProposalCard.vue',
  'client/src/components/policies/PolicyDestinationProposalAdjustmentDisclosure.vue',
  'client/src/api/policiesApi.js',
  'server/src/routes/policiesRoutePolicyAuthoringProposal.mjs',
  'client/browser-tests/policy-authoring-live-entry-path.spec.js',
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
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'authoring_route_regression',
    evidence: 'The primary route renders the server-confirmed library lifecycle list. It does not mount the retired policy card or modal host.',
  },
  {
    id: 'library_lifecycle_review_action',
    label: 'Review destination proposal action',
    kindId: POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS.LIST_ACTION,
    routePath: '/policies',
    sourcePaths: [
      'client/src/views/PolicyList.vue',
      'client/src/components/policies/PolicyAuthoringLifecycleEntry.vue',
    ],
    normalAuthoring: true,
    reachable: true,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'authoring_route_regression',
    evidence: 'Only an eligible server-confirmed lifecycle state renders Review destination proposal. The action changes the selected-library route without creating a policy.',
  },
  {
    id: 'selected_library_proposal_route',
    label: 'Selected library destination proposal route',
    kindId: POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS.ROUTE,
    routePath: '/policies?library=:libraryId',
    sourcePaths: [
      'client/src/views/PolicyList.vue',
      'client/src/components/policies/PolicyDestinationProposalCard.vue',
      'client/src/components/policies/PolicyDestinationProposalAdjustmentDisclosure.vue',
      'client/src/api/policiesApi.js',
      'server/src/routes/policiesRoutePolicyAuthoringProposal.mjs',
    ],
    normalAuthoring: true,
    reachable: true,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'authoring_route_regression',
    evidence: 'An eligible selected library prepares a server-owned proposal and exposes one admitted Create policy action. Existing, blocked, and recovering states remain non-creating.',
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
    nextOwnerTaskId: 'legacy_hash_regression',
    evidence: 'The focused legacy modal test asserts that the former hash target is absent; no normal authoring component provides that target.',
  },
  {
    id: 'native_intent_reconciliation_route',
    label: 'Native intent reconciliation route',
    kindId: POLICY_AUTHORING_LIVE_ENTRY_POINT_KIND_IDS.ADMIN_MAINTENANCE_ROUTE,
    routePath: '/policies/native-intent-reconciliation',
    sourcePaths: [
      'client/src/router/index.js',
      'client/src/views/PolicyNativeIntentReconciliation.vue',
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
    id: 'review_destination_proposal',
    label: 'Review destination proposal',
    entryPointId: 'library_lifecycle_review_action',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.ACCESSIBLE_NAVIGATION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'authoring_route_regression',
    clientOperation: 'router.push Policies with library query',
    serverContract: null,
    outcome: 'Moves to the selected library route and shifts focus to its destination proposal state. It does not create, edit, route, or recover a policy.',
  },
  {
    id: 'prepare_server_destination_proposal',
    label: 'Prepare server destination proposal',
    entryPointId: 'selected_library_proposal_route',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.SERVER_ACTION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'proposal_lifecycle_regression',
    clientOperation: 'preparePolicyAuthoringProposal',
    serverContract: 'POST /policies/operator-workflow/libraries/:libraryId/proposals',
    outcome: 'The selected route asks the server for one current proposal. The browser cannot synthesize proposal values or eligibility.',
  },
  {
    id: 'admit_server_prepared_proposal',
    label: 'Create policy',
    entryPointId: 'selected_library_proposal_route',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.SERVER_ACTION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'proposal_admission_regression',
    clientOperation: 'admitPolicyAuthoringProposal',
    serverContract: 'POST /policies/operator-workflow/libraries/:libraryId/proposals/:proposalReference/admission',
    outcome: 'Sends only the opaque proposal reference, revision, idempotency key, and allowed adjustments. Server admission remains the policy-write authority.',
  },
  {
    id: 'narrow_prepared_proposal',
    label: 'Adjust this policy',
    entryPointId: 'selected_library_proposal_route',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.LOCAL_DRAFT_COMMAND,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'proposal_adjustment_regression',
    clientOperation: 'revision-bound adjustment commands',
    serverContract: null,
    outcome: 'Keeps purpose-genre and helpful-studio narrowing collapsed until requested. The commands are revalidated by proposal admission and cannot create a policy on their own.',
  },
  {
    id: 'return_to_library_policy_setup',
    label: 'Back to library policy setup',
    entryPointId: 'selected_library_proposal_route',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.ACCESSIBLE_NAVIGATION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'authoring_route_regression',
    clientOperation: 'router.push Policies without library query',
    serverContract: null,
    outcome: 'Returns to the lifecycle list without persisting and restores focus to the selected library action.',
  },
  {
    id: 'reload_unavailable_authoring_states',
    label: 'Reload authoring states',
    entryPointId: 'policy_list_route',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.SERVER_ACTION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'authoring_route_regression',
    clientOperation: 'reloadLifecycleEntries',
    serverContract: 'GET /policies/operator-workflow/libraries/:libraryId/authoring-lifecycle',
    outcome: 'Appears only when a lifecycle state is unavailable and reloads server-confirmed lifecycle projections without changing policy state.',
  },
  {
    id: 'existing_policy_status',
    label: 'Existing policy status',
    entryPointId: 'selected_library_proposal_route',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.READ_ONLY_INFORMATION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'persisted_policy_maintenance_regression',
    clientOperation: 'render selected lifecycle projection',
    serverContract: 'GET /policies/operator-workflow/libraries/:libraryId/authoring-lifecycle',
    outcome: 'An existing native or compatibility policy remains non-creating on the selected route. The browser does not expose a second create or legacy Configure action.',
  },
  {
    id: 'automatic_profile_recovery_status',
    label: 'Automatic profile recovery status',
    entryPointId: 'selected_library_proposal_route',
    kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.READ_ONLY_INFORMATION,
    dispositionId: POLICY_AUTHORING_LIVE_DISPOSITION_IDS.KEEP,
    nextOwnerTaskId: 'automatic_recovery_regression',
    clientOperation: 'render selected lifecycle projection',
    serverContract: 'server-owned profile recovery and GET /policies/operator-workflow/libraries/:libraryId/authoring-lifecycle',
    outcome: 'Recovery is informational and read-only. The normal path exposes no provider, quota, reset, retry, or maintenance action.',
  },
]);

const POLICY_AUTHORING_LIVE_REMEDIATION = Object.freeze([]);

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
        message: 'Every live policy-authoring action must have one unique identifier.',
      });
    }
    actionIds.add(action?.id);

    if (!Object.values(POLICY_AUTHORING_LIVE_ACTION_KIND_IDS).includes(action?.kindId)) {
      issues.push({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ACTION_KIND_INVALID,
        actionId: action?.id || null,
        message: 'Every action must use an approved action kind.',
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
  const browserEvidenceStatusIsValid = Object.values(
    POLICY_AUTHORING_LIVE_BROWSER_EVIDENCE_STATUS_IDS,
  ).includes(browserEvidenceStatus);
  const browserEvidenceVerified = browserEvidenceStatus ===
    POLICY_AUTHORING_LIVE_BROWSER_EVIDENCE_STATUS_IDS.CONTROLLED_RENDER_VERIFIED;
  const browserEvidenceIssues = !browserEvidenceStatusIsValid
    ? [{
      riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.LIVE_BROWSER_EVIDENCE_STATUS_INVALID,
      message: 'Live entry-path evidence must use an approved evidence status.',
    }]
    : browserEvidenceVerified
      ? []
      : [{
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.LIVE_BROWSER_EVIDENCE_PENDING,
        message: 'Source-backed inventory is complete, but live browser rendering and interaction verification has not yet been recorded.',
      }];
  const remediation = validationIssues.length === 0
    ? listPolicyAuthoringLiveRemediation()
    : [];

  return {
    version: 2,
    auditId: 'policy_authoring_live_entry_path_inventory',
    inventoryComplete: validationIssues.length === 0,
    sourceExperienceReady: validationIssues.length === 0 && remediation.length === 0,
    renderedExperienceReady: validationIssues.length === 0 && remediation.length === 0 &&
      browserEvidenceVerified,
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
      mode: 'controlled_browser_render',
      specPath: 'client/browser-tests/policy-authoring-live-entry-path.spec.js',
      issues: browserEvidenceIssues,
    },
    entryPoints: listPolicyAuthoringLiveEntryPoints(),
    actions: listPolicyAuthoringLiveActions(),
    remediation,
    nextStep: browserEvidenceVerified
      ? {
        id: 'ai_provider_capability_authority_modes',
        label: 'AI Provider Capability And Authority Modes',
        reason: 'The lifecycle-based rendered entry path and admitted action are verified. The next dependency is server-owned provider capability and authority before adding runtime or maintenance controls.',
      }
      : {
        id: 'live_entry_path_browser_verification',
        label: 'Live Entry-Path Browser Verification',
        reason: 'Run the controlled browser spec before treating source inventory as rendered-path evidence.',
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
