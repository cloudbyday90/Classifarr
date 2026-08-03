import {
  buildPolicyAuthoringWorkflowPresentation,
  buildPolicyAuthoringWorkflowPresentationAudit,
  POLICY_AUTHORING_WORKFLOW_PRESENTATION_RISK_IDS,
  POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION,
} from '../../services/policyAuthoringWorkflowPresentation.mjs';

function buildInput(overrides = {}) {
  return {
    library: {
      id: 12,
      name: 'Animated Movies',
      mediaType: 'movie',
    },
    statusId: 'ready',
    observedProfile: {
      available: true,
      current: true,
      itemCount: 24,
      suggestionCount: 2,
    },
    workflow: {
      title: 'Define this destination',
      summary: 'Use current library evidence as a proposal, not an automatic policy rule.',
      sections: [{ editable: true }],
    },
    readinessPresentation: {
      primary: {
        kind: 'owner_action',
        ownerId: 'intent_signal_picker',
        sectionId: 'what_belongs_here',
        actionId: 'add_destination_examples',
        message: 'Accept a current library suggestion or add a declared destination value.',
      },
    },
    ...overrides,
  };
}

describe('policyAuthoringWorkflowPresentation', () => {
  test('builds a bounded, display-only projection with a deterministic revision', () => {
    const input = buildInput();
    const presentation = buildPolicyAuthoringWorkflowPresentation(input);

    expect(presentation).toEqual(expect.objectContaining({
      version: POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION,
      revision: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      library: {
        id: 12,
        name: 'Animated Movies',
        mediaType: 'movie',
      },
      destinationProposal: expect.objectContaining({
        available: true,
        requiresExplicitAdmission: true,
        observedContext: {
          available: true,
          current: true,
          itemCount: 24,
          suggestionCount: 2,
        },
      }),
      nextAction: expect.objectContaining({
        kind: 'owner_action',
        actionId: 'add_destination_examples',
      }),
      adjustment: {
        available: true,
        statusId: 'available',
      },
      recovery: {
        statusId: 'ready',
        automated: false,
        message: null,
      },
      authority: {
        displayProjection: true,
        automationDecision: false,
        policyPersistence: false,
        routingExecution: false,
      },
      rawPayloadExposed: false,
    }));
    expect(buildPolicyAuthoringWorkflowPresentation(input)).toEqual(presentation);
    expect(buildPolicyAuthoringWorkflowPresentationAudit({
      ...input,
      presentation,
    })).toEqual({ ok: true, issueCount: 0, issues: [] });
  });

  test('accepts equivalent projection key ordering but rejects unsupported action shapes', () => {
    const input = buildInput();
    const presentation = buildPolicyAuthoringWorkflowPresentation(input);
    const reordered = {
      rawPayloadExposed: presentation.rawPayloadExposed,
      authority: presentation.authority,
      recovery: presentation.recovery,
      adjustment: presentation.adjustment,
      nextAction: presentation.nextAction,
      destinationProposal: presentation.destinationProposal,
      library: presentation.library,
      revision: presentation.revision,
      version: presentation.version,
    };

    expect(buildPolicyAuthoringWorkflowPresentationAudit({
      ...input,
      presentation: reordered,
    })).toEqual({ ok: true, issueCount: 0, issues: [] });
    expect(buildPolicyAuthoringWorkflowPresentation(buildInput({
      readinessPresentation: {
        primary: {
          kind: 'browser_inference',
          ownerId: 'intent_signal_picker',
          actionId: 'add_destination_examples',
          message: 'The browser should not own this decision.',
        },
      },
    })).nextAction).toBeNull();
  });

  test('marks stale or unsafe presentation changes as invalid without accepting extra data', () => {
    const input = buildInput();
    const presentation = buildPolicyAuthoringWorkflowPresentation(input);
    const tampered = structuredClone(presentation);
    tampered.nextAction.actionId = 'save_policy';
    tampered.authority.policyPersistence = true;
    tampered.rawPayloadExposed = true;
    tampered.providerPayload = { token: 'not-for-display' };

    const audit = buildPolicyAuthoringWorkflowPresentationAudit({
      ...input,
      presentation: tampered,
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_AUTHORING_WORKFLOW_PRESENTATION_RISK_IDS.INVALID_PROJECTION,
      POLICY_AUTHORING_WORKFLOW_PRESENTATION_RISK_IDS.UNSAFE_AUTHORITY,
      POLICY_AUTHORING_WORKFLOW_PRESENTATION_RISK_IDS.RAW_PAYLOAD_EXPOSED,
    ]));
  });
});
