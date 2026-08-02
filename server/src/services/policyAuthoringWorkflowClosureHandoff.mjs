import {
  buildPolicyAuthoringWorkflowCompletionAudit,
  listPolicyAuthoringClientWorkflowComponents,
  listPolicyAuthoringCompletionArtifactPaths,
  listPolicyAuthoringServerContracts,
} from './policyAuthoringWorkflowCompletionAudit.mjs';

const POLICY_AUTHORING_WORKFLOW_CLOSURE_STATUS_IDS = Object.freeze({
  READY_FOR_LIVE_AUTHORING: 'ready_for_live_authoring',
  BLOCKED: 'blocked',
});

const POLICY_AUTHORING_WORKFLOW_CLOSURE_COMPONENT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  SUPERSEDED: 'superseded',
  MISSING_EVIDENCE: 'missing_evidence',
});

const POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS = Object.freeze({
  COMPLETION_EVIDENCE_INCOMPLETE: 'completion_evidence_incomplete',
  ARTIFACT_PRESENCE_UNVERIFIED: 'artifact_presence_unverified',
  ARTIFACT_MISSING: 'artifact_missing',
  COMPONENT_HANDOFF_MISSING: 'component_handoff_missing',
  COMPONENT_HANDOFF_DUPLICATE: 'component_handoff_duplicate',
  COMPONENT_HANDOFF_UNKNOWN: 'component_handoff_unknown',
  COMPONENT_HANDOFF_INVALID_STATUS: 'component_handoff_invalid_status',
  COMPONENT_HANDOFF_INCOMPLETE: 'component_handoff_incomplete',
  COMPONENT_HANDOFF_INVALID_OWNER: 'component_handoff_invalid_owner',
  LIVE_UI_COMPLETION_CLAIM: 'live_ui_completion_claim',
  LIVE_AUTHORING_HANDOFF_MISSING: 'live_authoring_handoff_missing',
  LIVE_AUTHORING_HANDOFF_DUPLICATE: 'live_authoring_handoff_duplicate',
  LIVE_AUTHORING_HANDOFF_INVALID_SEQUENCE: 'live_authoring_handoff_invalid_sequence',
  LIVE_AUTHORING_HANDOFF_INCOMPLETE: 'live_authoring_handoff_incomplete',
});

const LIVE_AUTHORING_TASK_IDS = Object.freeze([
  'live_entry_path_inventory',
  'workflow_presentation_adapter',
  'action_admission_feedback',
  'destination_proposal_card',
  'intent_adjustment_disclosure',
  'material_exception_controls',
  'persisted_policy_maintenance_entry',
  'legacy_builder_cutover',
  'live_authoring_accessibility_e2e',
]);

const WORKFLOW_CLOSURE_ARTIFACT_PATHS = Object.freeze([
  'docs/architecture/policy-authoring-workflow-closure-handoff.md',
  'server/src/services/policyAuthoringWorkflowClosureHandoff.mjs',
  'server/src/__tests__/services/policyAuthoringWorkflowClosureHandoff.test.mjs',
]);

const WORKFLOW_CONTRACT_HANDOFF_OWNERS = Object.freeze({
  policy_authoring_workflow_inventory: 'live_entry_path_inventory',
  policy_authoring_destination_flow: 'destination_proposal_card',
  policy_authoring_component_system: 'intent_adjustment_disclosure',
  policy_authoring_component_inventory: 'live_entry_path_inventory',
  policy_authoring_option_selection: 'intent_adjustment_disclosure',
  policy_authoring_constraints: 'material_exception_controls',
  policy_constraint_decision_model: 'material_exception_controls',
  policy_constraint_value_eligibility: 'material_exception_controls',
  policy_authoring_readiness: 'workflow_presentation_adapter',
  policy_authoring_starter_template_intent_boundary: 'intent_adjustment_disclosure',
  policy_authoring_accessibility: 'live_authoring_accessibility_e2e',
  policy_authoring_presentation_tests: 'live_authoring_accessibility_e2e',
  policy_compatibility_maintenance_test_ownership: 'legacy_builder_cutover',
  policy_authoring_library_first_workflow_shell: 'live_entry_path_inventory',
  policy_authoring_destination_sections: 'destination_proposal_card',
  policy_authoring_review_triggers: 'material_exception_controls',
  policy_authoring_workflow_readiness: 'workflow_presentation_adapter',
  policy_authoring_workflow_read_boundary: 'workflow_presentation_adapter',
  policy_authoring_save_defer_action_boundary: 'action_admission_feedback',
  policy_authoring_accessibility_decision_load_audit: 'live_authoring_accessibility_e2e',
  policy_authoring_presentation_test_reset: 'legacy_builder_cutover',
  policy_authoring_constraint_draft_command_boundary: 'intent_adjustment_disclosure',
  policy_authoring_constraint_control_surface: 'material_exception_controls',
});

const POLICY_AUTHORING_LIVE_AUTHORING_HANDOFFS = Object.freeze([
  {
    taskId: 'live_entry_path_inventory',
    label: 'Live Entry-Path And Action Inventory',
    availability: 'next',
    renderedEntryPath: 'The current policy list route, create/edit action, modal, hash target, and deep link for each native policy state.',
    requiredServerProjection: 'The existing versioned display-only workflow projection and library identity.',
    actionContract: 'Classify every visible control as server action, typed local draft command, accessible navigation, read-only information, or removal candidate.',
    removalCriterion: 'Every normal authoring entry point and visible action has current rendered-path evidence.',
  },
  {
    taskId: 'workflow_presentation_adapter',
    label: 'Server Workflow Presentation Adapter',
    availability: 'blocked_by_sequence',
    renderedEntryPath: 'The exact normal authoring entry path identified by the inventory.',
    requiredServerProjection: 'A versioned destination proposal, one next action, bounded recovery state, and immutable display-safe values.',
    actionContract: 'Reject malformed, stale, mismatched-library, or unsupported projections before rendering actionable controls.',
    removalCriterion: 'The live entry path consumes one validated presentation model and no browser-derived policy logic.',
  },
  {
    taskId: 'action_admission_feedback',
    label: 'Action Binding And Admission Feedback',
    availability: 'blocked_by_sequence',
    renderedEntryPath: 'Each classified primary and adjustment control from the entry-path inventory.',
    requiredServerProjection: 'The current action admission result and authoritative post-action workflow projection.',
    actionContract: 'Bind one action-local pending state to one admitted server operation or typed local draft command.',
    removalCriterion: 'No rendered interactive control lacks a tested, user-visible result.',
  },
  {
    taskId: 'destination_proposal_card',
    label: 'Destination Proposal Card',
    availability: 'blocked_by_sequence',
    renderedEntryPath: 'The validated new-policy authoring entry path after presentation validation and action binding.',
    requiredServerProjection: 'Observed library context, eligible proposed intent, evidence quality, and bounded unavailable guidance.',
    actionContract: 'Create or save an eligible proposal through the admitted native policy action without implicit persistence.',
    removalCriterion: 'A well-profiled library does not require a generic belongs-here multi-select before its primary action.',
  },
  {
    taskId: 'intent_adjustment_disclosure',
    label: 'Intent Adjustment Disclosure',
    availability: 'blocked_by_sequence',
    renderedEntryPath: 'The optional adjustment disclosure attached to the proposal or persisted-policy path.',
    requiredServerProjection: 'Canonical eligible option projections, source labels, and current workflow revision.',
    actionContract: 'Emit existing typed draft commands only; revalidate or clear local changes on revision change.',
    removalCriterion: 'Editing is optional on the normal ready path and cannot emit a compatibility payload.',
  },
  {
    taskId: 'material_exception_controls',
    label: 'Material Exception Controls',
    availability: 'blocked_by_sequence',
    renderedEntryPath: 'The bounded exception area after the default proposal or adjustment disclosure.',
    requiredServerProjection: 'Server-declared constraint, routing, review, and eligibility conditions.',
    actionContract: 'Expose only an admitted exception resolution; automatic recovery remains informational and scheduler-owned.',
    removalCriterion: 'Optional empty controls and generic warnings do not block or clutter a ready destination.',
  },
  {
    taskId: 'persisted_policy_maintenance_entry',
    label: 'Persisted Policy Summary And Intentional Maintenance Entry',
    availability: 'blocked_by_sequence',
    renderedEntryPath: 'The persisted native-policy inspection state and explicit maintenance entry.',
    requiredServerProjection: 'Compact saved intent, automation status, and the next admitted action.',
    actionContract: 'Enter editing only through explicit maintenance intent and preserve navigation and focus state.',
    removalCriterion: 'Saved-policy inspection, creation, editing, and compatibility maintenance have distinct contracts.',
  },
  {
    taskId: 'legacy_builder_cutover',
    label: 'Legacy Builder Cutover And Removal',
    availability: 'blocked_by_sequence',
    renderedEntryPath: 'Each normal authoring entry point after its replacement has end-to-end evidence.',
    requiredServerProjection: 'The validated workflow projection and any named server-side maintenance gates.',
    actionContract: 'Replace or remove obsolete normal-path controls without exposing compatibility or removal operations.',
    removalCriterion: 'One normal policy-authoring path remains per native state; compatibility artifacts retain a dedicated maintenance owner.',
  },
  {
    taskId: 'live_authoring_accessibility_e2e',
    label: 'Accessibility, Responsive Behavior, And End-To-End Workflow Tests',
    availability: 'blocked_by_sequence',
    renderedEntryPath: 'All final live entry paths and action outcomes from the delivered authoring sequence.',
    requiredServerProjection: 'The same validated projection used by the rendered authoring state.',
    actionContract: 'Exercise keyboard, focus, status, responsive, success, rejection, stale, recovery, and no-action states end-to-end.',
    removalCriterion: 'The release path has live browser evidence rather than static component or screenshot evidence.',
  },
]);

function listPolicyAuthoringWorkflowClosureArtifactPaths() {
  return [
    ...new Set([
      ...listPolicyAuthoringCompletionArtifactPaths(),
      ...WORKFLOW_CLOSURE_ARTIFACT_PATHS,
    ]),
  ];
}

function listPolicyAuthoringLiveAuthoringHandoffs() {
  return POLICY_AUTHORING_LIVE_AUTHORING_HANDOFFS;
}

function listPolicyAuthoringWorkflowContractHandoffs() {
  const componentRecords = [
    ...listPolicyAuthoringServerContracts().map(record => ({
      ...record,
      recordKey: `server_contract:${record.id}`,
    })),
    ...listPolicyAuthoringClientWorkflowComponents().map(record => ({
      ...record,
      recordKey: `client_workflow_component:${record.id}`,
    })),
  ];

  return componentRecords.map(record => ({
    recordKey: record.recordKey,
    recordId: record.id,
    statusId: POLICY_AUTHORING_WORKFLOW_CLOSURE_COMPONENT_STATUS_IDS.COMPLETE,
    nextOwnerTaskId: WORKFLOW_CONTRACT_HANDOFF_OWNERS[record.id] || null,
    liveUiOutcome: 'not_claimed',
  }));
}

function auditArtifactPaths(artifactPaths, artifactExists) {
  if (typeof artifactExists !== 'function') {
    return {
      ok: false,
      checkedCount: 0,
      missingPaths: [],
      issues: [{
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.ARTIFACT_PRESENCE_UNVERIFIED,
        message: 'Workflow closure requires a repository artifact resolver before it can be accepted.',
      }],
    };
  }

  const missingPaths = artifactPaths.filter(artifactPath => artifactExists(artifactPath) !== true);

  return {
    ok: missingPaths.length === 0,
    checkedCount: artifactPaths.length,
    missingPaths,
    issues: missingPaths.map(artifactPath => ({
      riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.ARTIFACT_MISSING,
      artifactPath,
        message: 'A workflow closure artifact is missing from the repository evidence set.',
    })),
  };
}

function auditPolicyAuthoringWorkflowContractHandoffs(componentRecords, componentHandoffs) {
  const expectedRecordKeys = componentRecords.map(record => record.recordKey);
  const handoffs = Array.isArray(componentHandoffs) ? componentHandoffs : [];
  const issues = [];

  expectedRecordKeys.forEach(recordKey => {
    const record = componentRecords.find(candidate => candidate.recordKey === recordKey);
    const matchingHandoffs = handoffs.filter(handoff => handoff?.recordKey === recordKey);

    if (matchingHandoffs.length === 0) {
      issues.push({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.COMPONENT_HANDOFF_MISSING,
        recordId: record.id,
        recordKey,
        message: 'Every active workflow contract needs one explicit status and live-authoring owner.',
      });
      return;
    }

    if (matchingHandoffs.length > 1) {
      issues.push({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.COMPONENT_HANDOFF_DUPLICATE,
        recordId: record.id,
        recordKey,
        message: 'A workflow contract can have only one handoff status and owner.',
      });
      return;
    }

    const [handoff] = matchingHandoffs;
    if (!Object.values(POLICY_AUTHORING_WORKFLOW_CLOSURE_COMPONENT_STATUS_IDS).includes(handoff.statusId)) {
      issues.push({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.COMPONENT_HANDOFF_INVALID_STATUS,
        recordId: record.id,
        recordKey,
        message: 'Workflow contract handoffs must use an approved evidence status.',
      });
    }

    if (handoff.statusId !== POLICY_AUTHORING_WORKFLOW_CLOSURE_COMPONENT_STATUS_IDS.COMPLETE) {
      issues.push({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.COMPONENT_HANDOFF_INCOMPLETE,
        recordId: record.id,
        recordKey,
        message: 'Active workflow contracts must be complete; superseded or missing-evidence records must leave the active ledger.',
      });
    }

    if (!LIVE_AUTHORING_TASK_IDS.includes(handoff.nextOwnerTaskId)) {
      issues.push({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.COMPONENT_HANDOFF_INVALID_OWNER,
        recordId: record.id,
        recordKey,
        message: 'Workflow contract handoffs must name one live-authoring task owner.',
      });
    }

    if (handoff.liveUiOutcome !== 'not_claimed') {
      issues.push({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.LIVE_UI_COMPLETION_CLAIM,
        recordId: record.id,
        recordKey,
        message: 'Workflow contract evidence cannot claim that a live browser interaction is complete.',
      });
    }
  });

  handoffs
    .filter(handoff => !expectedRecordKeys.includes(handoff?.recordKey))
    .forEach(handoff => {
      issues.push({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.COMPONENT_HANDOFF_UNKNOWN,
        recordId: handoff?.recordId || null,
        recordKey: handoff?.recordKey || null,
        message: 'Workflow closure handoffs cannot include records outside the active contract ledger.',
      });
    });

  return {
    ok: issues.length === 0,
    checkedCount: expectedRecordKeys.length,
    issues,
  };
}

function auditPolicyAuthoringLiveAuthoringHandoffs(liveAuthoringHandoffs) {
  const handoffs = Array.isArray(liveAuthoringHandoffs) ? liveAuthoringHandoffs : [];
  const issues = [];

  LIVE_AUTHORING_TASK_IDS.forEach((taskId, index) => {
    const matchingHandoffs = handoffs.filter(handoff => handoff?.taskId === taskId);

    if (matchingHandoffs.length === 0) {
      issues.push({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.LIVE_AUTHORING_HANDOFF_MISSING,
        taskId,
        message: 'The workflow closure must hand every live-authoring task to a named owner.',
      });
      return;
    }

    if (matchingHandoffs.length > 1) {
      issues.push({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.LIVE_AUTHORING_HANDOFF_DUPLICATE,
        taskId,
        message: 'Each live-authoring task can have only one closure handoff record.',
      });
      return;
    }

    const [handoff] = matchingHandoffs;
    const expectedAvailability = index === 0 ? 'next' : 'blocked_by_sequence';
    if (handoff.availability !== expectedAvailability) {
      issues.push({
        riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.LIVE_AUTHORING_HANDOFF_INVALID_SEQUENCE,
        taskId,
        message: 'Only the entry-path inventory can be eligible immediately after workflow closure.',
      });
    }

    ['renderedEntryPath', 'requiredServerProjection', 'actionContract', 'removalCriterion'].forEach(field => {
      if (!handoff[field]) {
        issues.push({
          riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.LIVE_AUTHORING_HANDOFF_INCOMPLETE,
          taskId,
          field,
          message: 'Every live-authoring handoff needs a rendered path, server projection, action contract, and removal criterion.',
        });
      }
    });
  });

  return {
    ok: issues.length === 0,
    checkedCount: LIVE_AUTHORING_TASK_IDS.length,
    issues,
  };
}

function buildPolicyAuthoringWorkflowClosureHandoff({
  completionAudit = buildPolicyAuthoringWorkflowCompletionAudit(),
  artifactExists,
  componentHandoffs = listPolicyAuthoringWorkflowContractHandoffs(),
  liveAuthoringHandoffs = POLICY_AUTHORING_LIVE_AUTHORING_HANDOFFS,
} = {}) {
  const componentRecords = [
    ...listPolicyAuthoringServerContracts().map(record => ({
      ...record,
      recordKey: `server_contract:${record.id}`,
    })),
    ...listPolicyAuthoringClientWorkflowComponents().map(record => ({
      ...record,
      recordKey: `client_workflow_component:${record.id}`,
    })),
  ];
  const artifactAudit = auditArtifactPaths(
    listPolicyAuthoringWorkflowClosureArtifactPaths(),
    artifactExists,
  );
  const componentHandoffAudit = auditPolicyAuthoringWorkflowContractHandoffs(
    componentRecords,
    componentHandoffs,
  );
  const liveAuthoringHandoffAudit = auditPolicyAuthoringLiveAuthoringHandoffs(
    liveAuthoringHandoffs,
  );
  const issues = [
    ...(completionAudit?.ok === true ? [] : [{
      riskId: POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS.COMPLETION_EVIDENCE_INCOMPLETE,
      message: 'Workflow closure requires the underlying contract-completion audit to pass.',
    }]),
    ...artifactAudit.issues,
    ...componentHandoffAudit.issues,
    ...liveAuthoringHandoffAudit.issues,
  ];

  return {
    version: 1,
    taskId: 'policy_authoring_workflow_contract_closure',
    ok: issues.length === 0,
    statusId: issues.length === 0
      ? POLICY_AUTHORING_WORKFLOW_CLOSURE_STATUS_IDS.READY_FOR_LIVE_AUTHORING
      : POLICY_AUTHORING_WORKFLOW_CLOSURE_STATUS_IDS.BLOCKED,
    issueCount: issues.length,
    completionAudit,
    artifactAudit,
    componentHandoffAudit,
    liveAuthoringHandoffAudit,
    issues,
    nextStep: {
      stepId: 'live_entry_path_inventory',
      label: 'Live Entry-Path And Action Inventory',
      reason: 'Workflow closure does not prove a rendered browser flow. Live entry-path and end-to-end interaction evidence start with the inventory.',
    },
  };
}

export {
  POLICY_AUTHORING_WORKFLOW_CLOSURE_COMPONENT_STATUS_IDS,
  POLICY_AUTHORING_WORKFLOW_CLOSURE_RISK_IDS,
  POLICY_AUTHORING_WORKFLOW_CLOSURE_STATUS_IDS,
  auditArtifactPaths,
  auditPolicyAuthoringLiveAuthoringHandoffs,
  auditPolicyAuthoringWorkflowContractHandoffs,
  buildPolicyAuthoringWorkflowClosureHandoff,
  listPolicyAuthoringLiveAuthoringHandoffs,
  listPolicyAuthoringWorkflowContractHandoffs,
  listPolicyAuthoringWorkflowClosureArtifactPaths,
};
