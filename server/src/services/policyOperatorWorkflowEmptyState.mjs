/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS,
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
  getPolicyAuthoringDestinationEmptyState,
} from './policyAuthoringDestinationFlow.mjs';
import {
  POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS,
} from './policyLibraryProfileEvidenceLoader.mjs';

const POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_VERSION = 'policy.operator_workflow_empty_state.v1';

const POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_ACTION_MODE_IDS = Object.freeze({
  SYNC_LIBRARY: 'sync_library',
  OPEN_LIBRARY_MAPPING: 'open_library_mapping',
  GUIDANCE: 'guidance',
});

const POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_version',
  UNKNOWN_STATE: 'unknown_state',
  DUPLICATE_STATE: 'duplicate_state',
  INVALID_SECTION: 'invalid_section',
  INVALID_NEXT_ACTION: 'invalid_next_action',
  INTERNAL_DETAILS_EXPOSED: 'internal_details_exposed',
});

const EMPTY_STATE_PRESENTATION = Object.freeze({
  [POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.NEW_LIBRARY]: Object.freeze({
    sectionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    actionLabel: 'Sync library now',
    busyLabel: 'Syncing library...',
    busyMessage: 'Classifarr is syncing this library and refreshing its profile.',
    targetId: 'policy-builder-library-context',
    actionMode: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_ACTION_MODE_IDS.SYNC_LIBRARY,
  }),
  [POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.SPARSE_LIBRARY]: Object.freeze({
    sectionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    actionLabel: 'Add declared intent',
    targetId: 'policy-builder-belongs-here',
    actionMode: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_ACTION_MODE_IDS.GUIDANCE,
  }),
  [POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.UNMAPPED_LIBRARY]: Object.freeze({
    sectionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.CAN_THIS_ROUTE,
    actionLabel: 'Open library mapping',
    busyLabel: 'Opening library mapping...',
    busyMessage: 'Classifarr is opening the library mapping page.',
    targetId: 'library-arr-mapping',
    actionMode: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_ACTION_MODE_IDS.OPEN_LIBRARY_MAPPING,
  }),
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasValidLibrary(library = {}) {
  const libraryId = Number(library?.id ?? library?.libraryId);
  return Number.isInteger(libraryId) && libraryId > 0;
}

function toNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function buildEmptyState(stateId) {
  const contract = getPolicyAuthoringDestinationEmptyState(stateId);
  const presentation = EMPTY_STATE_PRESENTATION[stateId];
  if (!contract || !presentation) return null;

  return {
    stateId: contract.id,
    sectionId: presentation.sectionId,
    label: contract.label,
    description: contract.description,
    nextAction: {
      actionId: contract.nextActionId,
      label: presentation.actionLabel,
      targetId: presentation.targetId,
      mode: presentation.actionMode,
      ...(presentation.busyLabel ? {
        busyLabel: presentation.busyLabel,
        busyMessage: presentation.busyMessage,
      } : {}),
    },
  };
}

/**
 * Builds product-facing empty states from already-read, bounded data only.
 * A failed profile read is intentionally not treated as a new library: the
 * evidence-recovery path owns that failure and must remain distinguishable.
 */
function buildPolicyOperatorWorkflowEmptyStateProjection({
  library = {},
  profileHandoff = {},
  observedProfile = {},
  routing = {},
} = {}) {
  if (!hasValidLibrary(library)) {
    return {
      version: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_VERSION,
      states: [],
    };
  }

  const profile = asObject(profileHandoff);
  const observed = asObject(observedProfile);
  const normalizedRouting = asObject(routing);
  const stateIds = [];

  if (profile.statusId === POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.PROFILE_NOT_FOUND) {
    stateIds.push(POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.NEW_LIBRARY);
  } else if (
    profile.ok === true &&
    observed.current === true &&
    toNonNegativeInteger(observed.suggestionCount) === 0
  ) {
    stateIds.push(POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.SPARSE_LIBRARY);
  }

  if (normalizedRouting.configured !== true || normalizedRouting.routeReady !== true) {
    stateIds.push(POLICY_AUTHORING_DESTINATION_EMPTY_STATE_IDS.UNMAPPED_LIBRARY);
  }

  return {
    version: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_VERSION,
    states: stateIds.map(buildEmptyState).filter(Boolean),
  };
}

function buildPolicyOperatorWorkflowEmptyStateAudit(projection = {}) {
  const source = asObject(projection);
  const states = asArray(source.states);
  const issues = [];
  const seenStateIds = new Set();

  if (source.version !== POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_VERSION) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Workflow empty-state projections must use the current contract version.',
    });
  }

  states.forEach((state) => {
    const contract = getPolicyAuthoringDestinationEmptyState(state?.stateId);
    const presentation = EMPTY_STATE_PRESENTATION[state?.stateId];

    if (!contract || !presentation) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_AUDIT_RISK_IDS.UNKNOWN_STATE,
        message: 'Workflow empty-state projections may include only known destination states.',
      });
      return;
    }

    if (seenStateIds.has(state.stateId)) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_AUDIT_RISK_IDS.DUPLICATE_STATE,
        message: 'Workflow empty-state projections must not repeat a destination state.',
      });
    }
    seenStateIds.add(state.stateId);

    if (state.sectionId !== presentation.sectionId) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_AUDIT_RISK_IDS.INVALID_SECTION,
        message: 'Each workflow empty state must remain attached to its destination question.',
      });
    }

    if (
      state.nextAction?.actionId !== contract.nextActionId ||
      state.nextAction?.label !== presentation.actionLabel ||
      state.nextAction?.targetId !== presentation.targetId ||
      state.nextAction?.mode !== presentation.actionMode ||
      state.nextAction?.busyLabel !== presentation.busyLabel ||
      state.nextAction?.busyMessage !== presentation.busyMessage
    ) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_AUDIT_RISK_IDS.INVALID_NEXT_ACTION,
        message: 'Each workflow empty state must expose its bounded next action.',
      });
    }

    if (contract.internalDetailsAllowed !== false || state.internalDetails !== undefined) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_AUDIT_RISK_IDS.INTERNAL_DETAILS_EXPOSED,
        message: 'Workflow empty-state projections must not expose internal diagnostics.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_ACTION_MODE_IDS,
  POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_AUDIT_RISK_IDS,
  POLICY_OPERATOR_WORKFLOW_EMPTY_STATE_VERSION,
  buildPolicyOperatorWorkflowEmptyStateAudit,
  buildPolicyOperatorWorkflowEmptyStateProjection,
};
