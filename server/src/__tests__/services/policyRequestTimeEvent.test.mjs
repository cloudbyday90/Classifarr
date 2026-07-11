import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  POLICY_REQUEST_TIME_EVENT_VERSION,
  buildPolicyRequestTimeEvent,
  validatePolicyRequestTimeEvent,
} from '../../services/policyRequestTimeEvent.mjs';

describe('policyRequestTimeEvent', () => {
  test('normalizes a bounded request event without carrying raw upstream contracts', () => {
    const event = buildPolicyRequestTimeEvent({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
      item: {
        tmdbId: 10674,
        title: ' Mulan ',
      },
      operatorDestination: {
        libraryId: 6,
        libraryName: ' Animated Movies ',
        arr_type: 'radarr',
      },
      answer: {
        label: ' Mulan belongs here ',
      },
      candidate: {
        key: 'studio:disney',
        label: ' Disney ',
        evidenceCount: '4',
      },
      context: {
        aiAuthored: true,
        providerQuotaState: ' exhausted ',
        ignored: 'not included',
      },
      actorId: ' admin-1 ',
      sourceEventId: ' request-10674 ',
      questionReductionPlan: {
        version: 'policy.runtime_question_reduction.v1',
      },
      automationDecision: {
        version: 'policy.automation_decision.v1',
      },
    });

    expect(event).toEqual(expect.objectContaining({
      version: POLICY_REQUEST_TIME_EVENT_VERSION,
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
      item: expect.objectContaining({
        itemId: 10674,
        title: 'Mulan',
      }),
      operatorDestination: expect.objectContaining({
        libraryId: 6,
        libraryName: 'Animated Movies',
        arrType: 'radarr',
      }),
      candidate: expect.objectContaining({
        label: 'Disney',
        evidenceCount: 4,
      }),
      learningContext: {
        aiExplanationText: '',
        aiAuthored: true,
        providerQuotaState: 'exhausted',
        providerCooldownState: '',
        replayDiagnosticState: '',
        tmdbDiagnosticState: '',
        tmdbCoverageState: '',
      },
      actorId: 'admin-1',
      sourceEventId: 'request-10674',
    }));
    expect(event).not.toHaveProperty('questionReductionPlan');
    expect(event).not.toHaveProperty('automationDecision');
    expect(validatePolicyRequestTimeEvent(event)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('rejects malformed or unsupported normalized events', () => {
    expect(validatePolicyRequestTimeEvent({
      version: 'policy.request_time_event.v0',
      eventTypeId: 'unknown_event',
    })).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ field: 'version' }),
        expect.objectContaining({ field: 'eventTypeId' }),
        expect.objectContaining({ field: 'item' }),
      ]),
    }));
  });

  test('rejects upstream contracts and malformed record fields on a normalized event', () => {
    const event = buildPolicyRequestTimeEvent({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
    });
    event.questionReductionPlan = {
      version: 'policy.runtime_question_reduction.v1',
    };
    event.candidate = [];

    expect(validatePolicyRequestTimeEvent(event)).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ field: 'questionReductionPlan' }),
        expect.objectContaining({ field: 'candidate' }),
      ]),
    }));
  });
});
