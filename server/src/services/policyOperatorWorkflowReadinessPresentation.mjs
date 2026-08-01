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
  POLICY_AUTOMATION_READINESS_STATE_IDS,
  listPolicyAutomationReadinessStates,
} from './policyAutomationReadinessEngine.mjs';

const POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_VERSION =
  'policy.operator_workflow_readiness_presentation.v1';

const POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS = Object.freeze({
  OWNER_ACTION: 'owner_action',
  AUTOMATED_GUIDANCE: 'automated_guidance',
});

const POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS = Object.freeze({
  POLICY_BUILDER_FOOTER_ACTIONS: 'policy_builder_footer_actions',
  INTENT_SIGNAL_PICKER: 'intent_signal_picker',
  REVIEW_TRIGGER_CONTROL: 'review_trigger_control',
  HARD_LIMIT_CONTROL: 'hard_limit_control',
  DESTINATION_EMPTY_STATE_NOTICE: 'destination_empty_state_notice',
  OBSERVED_PROFILE_SUMMARY: 'observed_profile_summary',
});

const POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_version',
  UNKNOWN_STATE: 'unknown_state',
  PRIMARY_STATE_MISMATCH: 'primary_state_mismatch',
  MISSING_RESOLUTION: 'missing_resolution',
  INVALID_RESOLUTION_KIND: 'invalid_resolution_kind',
  INVALID_OWNER: 'invalid_owner',
  ACTION_WITHOUT_ACTION_ID: 'action_without_action_id',
  GUIDANCE_WITH_ACTION_ID: 'guidance_with_action_id',
  GUIDANCE_WITHOUT_MESSAGE: 'guidance_without_message',
  ROUTING_ACTION_UNAVAILABLE: 'routing_action_unavailable',
  UNEXPECTED_ACTIONABLE_EXAMPLE_STATE: 'unexpected_actionable_example_state',
  RAW_PAYLOAD_EXPOSED: 'raw_payload_exposed',
});

const KNOWN_STATE_IDS = Object.freeze(new Set(
  listPolicyAutomationReadinessStates().map(state => state.id)
));

const KNOWN_OWNER_IDS = Object.freeze(new Set(
  Object.values(POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS)
));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 240) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function isCurrentObservedProfile(observedProfile = {}) {
  const profile = asObject(observedProfile);

  return profile.available === true && profile.current === true;
}

function hasSelectableIntentSignal(intentSignalProjection = {}) {
  const projection = asObject(intentSignalProjection);

  return asArray(projection.options).some(option => option?.selectable === true) ||
    projection.customEntryInput?.enabled === true;
}

function findUnmappedLibraryAction(emptyStateProjection = {}) {
  const projection = asObject(emptyStateProjection);

  return asArray(projection.states).find(state => (
    state?.stateId === 'unmapped_library' &&
    state?.sectionId === 'can_this_route' &&
    state?.nextAction?.actionId === 'map_routing_destination' &&
    state?.nextAction?.mode === 'open_library_mapping'
  )) || null;
}

function buildOwnerAction({ stateId, ownerId, sectionId = null, actionId, message }) {
  return {
    stateId,
    kind: POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.OWNER_ACTION,
    ownerId,
    sectionId,
    actionId,
    message,
  };
}

function buildAutomatedGuidance({ stateId, ownerId, sectionId = null, message }) {
  return {
    stateId,
    kind: POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.AUTOMATED_GUIDANCE,
    ownerId,
    sectionId,
    actionId: null,
    message,
  };
}

function buildNeedsExamplesResolution({
  observedProfile,
  intentSignalProjection,
} = {}) {
  if (isCurrentObservedProfile(observedProfile) && hasSelectableIntentSignal(intentSignalProjection)) {
    return buildOwnerAction({
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
      ownerId: POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.INTENT_SIGNAL_PICKER,
      sectionId: 'what_belongs_here',
      actionId: 'add_destination_examples',
      message: 'Accept a current library suggestion or add a declared destination value.',
    });
  }

  return buildAutomatedGuidance({
    stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
    ownerId: POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.OBSERVED_PROFILE_SUMMARY,
    sectionId: 'what_belongs_here',
    message: 'Classifarr will wait for a current library profile before it offers destination values. No action is needed here.',
  });
}

function buildReadinessResolution({
  stateId,
  observedProfile,
  intentSignalProjection,
  emptyStateProjection,
} = {}) {
  if (stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.READY) {
    return buildOwnerAction({
      stateId,
      ownerId: POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.POLICY_BUILDER_FOOTER_ACTIONS,
      actionId: 'save_policy',
      message: 'Create the policy or defer without changing routing behavior.',
    });
  }

  if (stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES) {
    return buildNeedsExamplesResolution({ observedProfile, intentSignalProjection });
  }

  if (stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW) {
    return buildOwnerAction({
      stateId,
      ownerId: POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.REVIEW_TRIGGER_CONTROL,
      sectionId: 'when_should_classifarr_ask',
      actionId: 'review_destination_intent',
      message: 'Review the declared condition that requires Classifarr to ask.',
    });
  }

  if (stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT) {
    return buildOwnerAction({
      stateId,
      ownerId: POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.HARD_LIMIT_CONTROL,
      sectionId: 'what_should_not_go_here',
      actionId: 'edit_hard_limit',
      message: 'Review the hard limit that blocks automatic application.',
    });
  }

  if (stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING) {
    const unmappedLibraryAction = findUnmappedLibraryAction(emptyStateProjection);

    return unmappedLibraryAction
      ? buildOwnerAction({
          stateId,
          ownerId: POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.DESTINATION_EMPTY_STATE_NOTICE,
          sectionId: 'can_this_route',
          actionId: unmappedLibraryAction.nextAction.actionId,
          message: 'Open the existing library mapping action before confirmed matches can route.',
        })
      : null;
  }

  if (stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE) {
    return buildAutomatedGuidance({
      stateId,
      ownerId: POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.OBSERVED_PROFILE_SUMMARY,
      sectionId: 'what_belongs_here',
      message: 'Classifarr waits for automatic profile recovery before it uses these observations for automation. No action is needed here.',
    });
  }

  return null;
}

function normalizeReadinessIssue(issue = {}) {
  const source = asObject(issue);

  return {
    stateId: normalizeString(source.stateId, 80) || null,
    reasonCode: normalizeString(source.reasonCode, 120) || null,
  };
}

function buildPolicyOperatorWorkflowReadinessPresentation({
  readiness = {},
  observedProfile = {},
  intentSignalProjection = {},
  emptyStateProjection = {},
} = {}) {
  const normalizedReadiness = asObject(readiness);
  const primaryStateId = normalizeString(normalizedReadiness.stateId, 80) || null;
  const issueStates = asArray(normalizedReadiness.issues)
    .map(normalizeReadinessIssue)
    .filter(issue => KNOWN_STATE_IDS.has(issue.stateId));
  const uniqueIssueStates = [...new Set(issueStates.map(issue => issue.stateId))];
  const stateIds = primaryStateId === POLICY_AUTOMATION_READINESS_STATE_IDS.READY
    ? [primaryStateId]
    : uniqueIssueStates;
  const resolutions = stateIds
    .map(stateId => buildReadinessResolution({
      stateId,
      observedProfile,
      intentSignalProjection,
      emptyStateProjection,
    }))
    .filter(Boolean);

  return {
    version: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_VERSION,
    primary: resolutions.find(resolution => resolution.stateId === primaryStateId) || null,
    issues: resolutions,
    rawPayloadExposed: false,
  };
}

function buildPolicyOperatorWorkflowReadinessPresentationAudit({
  presentation = {},
  readiness = {},
  observedProfile = {},
  intentSignalProjection = {},
  emptyStateProjection = {},
} = {}) {
  const source = asObject(presentation);
  const normalizedReadiness = asObject(readiness);
  const primaryStateId = normalizeString(normalizedReadiness.stateId, 80) || null;
  const issues = [];
  const resolutions = asArray(source.issues);
  const declaredIssueStateIds = [...new Set(asArray(normalizedReadiness.issues)
    .map(issue => normalizeString(issue?.stateId, 80))
    .filter(stateId => KNOWN_STATE_IDS.has(stateId)))];
  const expectedIssueStateIds = primaryStateId === POLICY_AUTOMATION_READINESS_STATE_IDS.READY
    ? [primaryStateId]
    : declaredIssueStateIds.length > 0
      ? declaredIssueStateIds
      : [primaryStateId];

  if (source.version !== POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_VERSION) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.INVALID_VERSION,
      message: 'Readiness presentation must use the current version.',
    });
  }

  if (!KNOWN_STATE_IDS.has(primaryStateId)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.UNKNOWN_STATE,
      message: 'Readiness presentation requires a known primary readiness state.',
    });
  }

  if (source.primary?.stateId !== primaryStateId) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.PRIMARY_STATE_MISMATCH,
      message: 'Readiness presentation primary resolution must match the readiness state.',
    });
  }

  expectedIssueStateIds.forEach(stateId => {
    const resolution = resolutions.find(item => item?.stateId === stateId);

    if (!resolution) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.MISSING_RESOLUTION,
        stateId,
        message: 'Every live readiness state requires an owned action or automated guidance.',
      });
      return;
    }

    if (!Object.values(POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS).includes(resolution.kind)) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.INVALID_RESOLUTION_KIND,
        stateId,
        message: 'Readiness resolutions must use an approved presentation kind.',
      });
    }

    if (!KNOWN_OWNER_IDS.has(resolution.ownerId)) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.INVALID_OWNER,
        stateId,
        message: 'Readiness resolutions must use an approved owner surface.',
      });
    }

    if (resolution.kind === POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.OWNER_ACTION &&
        !normalizeString(resolution.actionId, 120)) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.ACTION_WITHOUT_ACTION_ID,
        stateId,
        message: 'Actionable readiness resolutions require an action id.',
      });
    }

    if (resolution.kind === POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.AUTOMATED_GUIDANCE) {
      if (normalizeString(resolution.actionId, 120)) {
        issues.push({
          riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.GUIDANCE_WITH_ACTION_ID,
          stateId,
          message: 'Automated guidance must not imply a browser action.',
        });
      }

      if (!normalizeString(resolution.message)) {
        issues.push({
          riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.GUIDANCE_WITHOUT_MESSAGE,
          stateId,
          message: 'Automated guidance must explain why no browser action is offered.',
        });
      }
    }
  });

  const routingResolution = resolutions.find(resolution => (
    resolution?.stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING
  ));
  if (routingResolution && !findUnmappedLibraryAction(emptyStateProjection)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.ROUTING_ACTION_UNAVAILABLE,
      message: 'Routing readiness can only point to the bounded library-mapping action.',
    });
  }

  const examplesResolution = resolutions.find(resolution => (
    resolution?.stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES
  ));
  if (
    examplesResolution?.kind === POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.OWNER_ACTION &&
    (!isCurrentObservedProfile(observedProfile) || !hasSelectableIntentSignal(intentSignalProjection))
  ) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.UNEXPECTED_ACTIONABLE_EXAMPLE_STATE,
      message: 'Destination selection must remain unavailable until the observed profile is current and supplies a safe input.',
    });
  }

  if (source.rawPayloadExposed !== false) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      message: 'Readiness presentation must not expose raw profile, provider, or diagnostic payloads.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS,
  POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS,
  POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_VERSION,
  POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS,
  buildPolicyOperatorWorkflowReadinessPresentation,
  buildPolicyOperatorWorkflowReadinessPresentationAudit,
};
