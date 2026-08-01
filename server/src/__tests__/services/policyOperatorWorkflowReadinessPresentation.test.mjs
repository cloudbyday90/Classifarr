import {
  POLICY_AUTOMATION_READINESS_STATE_IDS,
} from '../../services/policyAutomationReadinessEngine.mjs';
import {
  POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS,
  POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS,
  POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS,
  buildPolicyOperatorWorkflowReadinessPresentation,
  buildPolicyOperatorWorkflowReadinessPresentationAudit,
} from '../../services/policyOperatorWorkflowReadinessPresentation.mjs';

function buildReadiness(stateId, issueStateIds = [stateId]) {
  return {
    stateId,
    ready: stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.READY,
    issues: issueStateIds
      .filter(issueStateId => issueStateId !== POLICY_AUTOMATION_READINESS_STATE_IDS.READY)
      .map(issueStateId => ({ stateId: issueStateId })),
  };
}

function buildCurrentProfile(overrides = {}) {
  return {
    available: true,
    current: true,
    ...overrides,
  };
}

function buildIntentSignalProjection(overrides = {}) {
  return {
    options: [{ selectable: true }],
    customEntryInput: { enabled: true },
    ...overrides,
  };
}

function buildEmptyStateProjection(overrides = {}) {
  return {
    states: [{
      stateId: 'unmapped_library',
      sectionId: 'can_this_route',
      nextAction: {
        actionId: 'map_routing_destination',
        mode: 'open_library_mapping',
      },
    }],
    ...overrides,
  };
}

describe('policyOperatorWorkflowReadinessPresentation', () => {
  test.each([
    [
      POLICY_AUTOMATION_READINESS_STATE_IDS.READY,
      POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.OWNER_ACTION,
      POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.POLICY_BUILDER_FOOTER_ACTIONS,
      'save_policy',
    ],
    [
      POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
      POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.OWNER_ACTION,
      POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.INTENT_SIGNAL_PICKER,
      'add_destination_examples',
    ],
    [
      POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.OWNER_ACTION,
      POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.REVIEW_TRIGGER_CONTROL,
      'review_destination_intent',
    ],
    [
      POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING,
      POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.OWNER_ACTION,
      POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.DESTINATION_EMPTY_STATE_NOTICE,
      'map_routing_destination',
    ],
    [
      POLICY_AUTOMATION_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.OWNER_ACTION,
      POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.HARD_LIMIT_CONTROL,
      'edit_hard_limit',
    ],
    [
      POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE,
      POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.AUTOMATED_GUIDANCE,
      POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.OBSERVED_PROFILE_SUMMARY,
      null,
    ],
  ])('maps %s to one real owner or automatic guidance', (stateId, kind, ownerId, actionId) => {
    const readiness = buildReadiness(stateId);
    const observedProfile = stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE
      ? buildCurrentProfile({ current: false })
      : buildCurrentProfile();
    const presentation = buildPolicyOperatorWorkflowReadinessPresentation({
      readiness,
      observedProfile,
      intentSignalProjection: buildIntentSignalProjection(),
      emptyStateProjection: buildEmptyStateProjection(),
    });

    expect(presentation.primary).toEqual(expect.objectContaining({
      stateId,
      kind,
      ownerId,
      actionId,
    }));
    expect(buildPolicyOperatorWorkflowReadinessPresentationAudit({
      presentation,
      readiness,
      observedProfile,
      intentSignalProjection: buildIntentSignalProjection(),
      emptyStateProjection: buildEmptyStateProjection(),
    })).toEqual({ ok: true, issueCount: 0, issues: [] });
  });

  test('keeps current evidence selection and review in their owning controls', () => {
    const readiness = buildReadiness(
      POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
      [
        POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
        POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      ],
    );
    const presentation = buildPolicyOperatorWorkflowReadinessPresentation({
      readiness,
      observedProfile: buildCurrentProfile(),
      intentSignalProjection: buildIntentSignalProjection(),
    });

    expect(presentation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES,
        ownerId: POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.INTENT_SIGNAL_PICKER,
      }),
      expect.objectContaining({
        stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW,
        ownerId: POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.REVIEW_TRIGGER_CONTROL,
      }),
    ]));
  });

  test('turns unavailable evidence into truthful guidance instead of a false selection action', () => {
    const readiness = buildReadiness(POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES);
    const observedProfile = buildCurrentProfile({ available: false, current: false });
    const presentation = buildPolicyOperatorWorkflowReadinessPresentation({
      readiness,
      observedProfile,
      intentSignalProjection: buildIntentSignalProjection(),
    });

    expect(presentation.primary).toEqual(expect.objectContaining({
      kind: POLICY_OPERATOR_WORKFLOW_READINESS_RESOLUTION_KIND_IDS.AUTOMATED_GUIDANCE,
      ownerId: POLICY_OPERATOR_WORKFLOW_READINESS_OWNER_IDS.OBSERVED_PROFILE_SUMMARY,
      actionId: null,
    }));
  });

  test('fails closed when routing state does not expose the bounded mapping action', () => {
    const readiness = buildReadiness(POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING);
    const presentation = buildPolicyOperatorWorkflowReadinessPresentation({
      readiness,
      observedProfile: buildCurrentProfile(),
      intentSignalProjection: buildIntentSignalProjection(),
      emptyStateProjection: { states: [] },
    });

    expect(buildPolicyOperatorWorkflowReadinessPresentationAudit({
      presentation,
      readiness,
      observedProfile: buildCurrentProfile(),
      intentSignalProjection: buildIntentSignalProjection(),
      emptyStateProjection: { states: [] },
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.MISSING_RESOLUTION,
        stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING,
      }),
    ]));
  });

  test('rejects a guidance record that claims a browser action', () => {
    const readiness = buildReadiness(POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE);
    const observedProfile = buildCurrentProfile({ current: false });
    const presentation = buildPolicyOperatorWorkflowReadinessPresentation({
      readiness,
      observedProfile,
      intentSignalProjection: buildIntentSignalProjection(),
    });
    presentation.primary.actionId = 'refresh_profile';
    presentation.issues[0].actionId = 'refresh_profile';

    expect(buildPolicyOperatorWorkflowReadinessPresentationAudit({
      presentation,
      readiness,
      observedProfile,
      intentSignalProjection: buildIntentSignalProjection(),
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_RISK_IDS.GUIDANCE_WITH_ACTION_ID,
      }),
    ]));
  });
});
