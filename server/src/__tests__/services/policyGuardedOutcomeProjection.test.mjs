import {
  ANSWER_OUTCOME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromRuntimeInput,
} from '../../services/policyRuntimeQuestionReduction.mjs';
import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan,
} from '../../services/policyRequestTimeLearning.mjs';
import {
  buildPolicyRequestTimeEvent,
} from '../../services/policyRequestTimeEvent.mjs';
import {
  POLICY_GUARDED_OUTCOME_PROJECTION_STATUS_IDS,
  POLICY_GUARDED_OUTCOME_REJECTION_IDS,
  buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions,
  validatePolicyGuardedOutcomeProjection,
} from '../../services/policyGuardedOutcomeProjection.mjs';

function requestTimeDecision() {
  const questionReductionPlan = buildPolicyRuntimeQuestionReductionFromRuntimeInput({
    libraryProfile: {
      identityCandidates: [
        { label: 'Animation', count: 2, confidence: 0.8 },
      ],
    },
  });
  const requestEvent = buildPolicyRequestTimeEvent({
    eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
    operatorDestination: {
      libraryId: 6,
      libraryName: 'Animated Movies',
    },
    answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
    candidate: {
      key: 'studio:pixar',
      label: 'Pixar',
      evidenceCount: 4,
    },
  });

  return buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan({
    questionReductionPlan,
    requestEvent,
  });
}

describe('policyGuardedOutcomeProjection', () => {
  test('projects only validated request-time decisions into bounded rebuild evidence', () => {
    const projection = buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions({
      requestTimeDecisions: [requestTimeDecision()],
    });

    expect(projection).toEqual(expect.objectContaining({
      statusId: POLICY_GUARDED_OUTCOME_PROJECTION_STATUS_IDS.READY,
      outcomes: [expect.objectContaining({
        evidenceFingerprint: expect.objectContaining({ algorithm: 'sha256' }),
        requestProofFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
        learning: expect.objectContaining({
          candidate: expect.objectContaining({ key: 'studio:pixar' }),
        }),
      })],
      rejections: [],
      summary: expect.objectContaining({
        decisionCount: 1,
        acceptedCount: 1,
        requestProofCount: 1,
      }),
    }));
    expect(JSON.stringify(projection)).not.toContain('questionReductionPlan');
    expect(validatePolicyGuardedOutcomeProjection(projection)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('omits invalid decisions and retains a bounded rejection reason', () => {
    const invalidDecision = requestTimeDecision();
    invalidDecision.upstreamEvidenceFingerprint = null;
    invalidDecision.learningGuardContext.upstreamEvidenceFingerprint = null;
    invalidDecision.trace.attributes[
      'classifarr.runtime.request_learning.upstream_evidence_fingerprint'
    ] = undefined;

    const projection = buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions({
      requestTimeDecisions: [invalidDecision],
    });

    expect(projection).toEqual(expect.objectContaining({
      statusId: POLICY_GUARDED_OUTCOME_PROJECTION_STATUS_IDS.READY_WITH_REJECTIONS,
      outcomes: [],
      rejections: [expect.objectContaining({
        decisionIndex: 0,
        reasonId: POLICY_GUARDED_OUTCOME_REJECTION_IDS.MISSING_FINGERPRINT,
      })],
      summary: expect.objectContaining({
        acceptedCount: 0,
        rejectedCount: 1,
        missingFingerprintCount: 1,
      }),
    }));
    expect(validatePolicyGuardedOutcomeProjection(projection).ok).toBe(true);
  });

  test('rejects a projection with unexpected fields or a drifted summary', () => {
    const projection = buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions({
      requestTimeDecisions: [requestTimeDecision()],
    });
    projection.rawDecision = requestTimeDecision();
    projection.summary.acceptedCount = 0;

    expect(validatePolicyGuardedOutcomeProjection(projection)).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ field: 'rawDecision' }),
        expect.objectContaining({ field: 'summary.acceptedCount' }),
      ]),
    }));
  });

  test('rejects unsupported adapter input before processing request-time decisions', () => {
    expect(() => buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions({
      requestTimeDecisions: [],
      automationDecision: {},
    })).toThrow('unsupported input key "automationDecision"');
  });
});
