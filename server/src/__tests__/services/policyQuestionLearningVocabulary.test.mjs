import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  POLICY_UX_TERM_IDS,
} from '../../services/policyUserMentalModel.mjs';
import {
  ANSWER_OUTCOME_IDS,
  LEARNING_SIDE_EFFECTS,
  QUESTION_FRAME_IDS,
  REJECTED_QUESTION_FRAME_IDS,
  getAcceptableQuestionFrame,
  getAnswerOutcome,
  getRejectedQuestionFrame,
  hasLearningSideEffect,
  isAcceptableQuestionFrame,
  isRejectedQuestionFrame,
  listAcceptableQuestionFrames,
  listAnswerOutcomes,
  listRejectedQuestionFrames,
  normalizeQuestionFrame,
  requiresExplicitPolicyEdit,
  requiresLearningGuard,
} from '../../services/policyQuestionLearningVocabulary.mjs';

describe('policyQuestionLearningVocabulary', () => {
  test('defines accepted runtime question frames from Phase 0R.4', () => {
    expect(listAcceptableQuestionFrames().map(frame => frame.id)).toEqual([
      QUESTION_FRAME_IDS.DESTINATION_FIT,
      QUESTION_FRAME_IDS.MISSING_EVIDENCE,
      QUESTION_FRAME_IDS.HARD_LIMIT_CONFLICT,
      QUESTION_FRAME_IDS.ROUTING_GAP,
      QUESTION_FRAME_IDS.STALE_PROFILE,
      QUESTION_FRAME_IDS.OUTLIER_REVIEW,
    ]);
  });

  test('keeps destination-fit questions about destination fit rather than genre priority', () => {
    const frame = getAcceptableQuestionFrame(QUESTION_FRAME_IDS.DESTINATION_FIT);

    expect(frame.operatorQuestion).toBe('Does this item belong in this destination?');
    expect(frame.authoritySourceIds).toEqual([
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(frame.relatedUxTermIds).toEqual([
      POLICY_UX_TERM_IDS.BELONGS_HERE,
      POLICY_UX_TERM_IDS.READINESS,
    ]);
    expect(frame.learningEligibleByDefault).toBe(false);
  });

  test('marks hard-limit conflict as declared-intent review without default learning', () => {
    const frame = getAcceptableQuestionFrame(QUESTION_FRAME_IDS.HARD_LIMIT_CONFLICT);

    expect(frame.authoritySourceIds).toEqual([
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(frame.relatedUxTermIds).toEqual([
      POLICY_UX_TERM_IDS.HARD_LIMITS,
      POLICY_UX_TERM_IDS.AVOID,
    ]);
    expect(frame.learningEligibleByDefault).toBe(false);
  });

  test('defines rejected frames and deterministic replacement frames', () => {
    expect(listRejectedQuestionFrames().map(frame => frame.id)).toEqual([
      REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY,
      REJECTED_QUESTION_FRAME_IDS.AI_AUTHORED_POLICY_EDIT,
      REJECTED_QUESTION_FRAME_IDS.PROVIDER_SPECIFIC_DIAGNOSTIC,
      REJECTED_QUESTION_FRAME_IDS.REPLAY_PARITY_INTERPRETATION,
    ]);

    expect(getRejectedQuestionFrame(REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY))
      .toEqual(expect.objectContaining({
        rejectionReason: 'Broad genres are evidence, not destination authority.',
        replacementFrameId: QUESTION_FRAME_IDS.DESTINATION_FIT,
      }));
  });

  test('normalizes accepted, rejected, and unknown question frames', () => {
    expect(normalizeQuestionFrame(QUESTION_FRAME_IDS.ROUTING_GAP)).toEqual({
      accepted: true,
      frameId: QUESTION_FRAME_IDS.ROUTING_GAP,
      replacementFrameId: null,
      rejectionReason: null,
    });

    expect(normalizeQuestionFrame(REJECTED_QUESTION_FRAME_IDS.PROVIDER_SPECIFIC_DIAGNOSTIC))
      .toEqual({
        accepted: false,
        frameId: REJECTED_QUESTION_FRAME_IDS.PROVIDER_SPECIFIC_DIAGNOSTIC,
        replacementFrameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
        rejectionReason: 'Operators should answer policy fit, not provider internals.',
      });

    expect(normalizeQuestionFrame('unknown')).toEqual({
      accepted: false,
      frameId: null,
      replacementFrameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
      rejectionReason: 'Unknown question frame.',
    });
  });

  test('defines answer outcomes separately from learning side effects', () => {
    expect(listAnswerOutcomes().map(outcome => outcome.id)).toEqual([
      ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
      ANSWER_OUTCOME_IDS.REMEMBER_EXACT_ITEM,
      ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE,
      ANSWER_OUTCOME_IDS.ADD_HARD_LIMIT_EVIDENCE,
      ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
    ]);

    expect(getAnswerOutcome(ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM))
      .toEqual(expect.objectContaining({
        finalOutcome: true,
        learningSideEffect: LEARNING_SIDE_EFFECTS.NONE,
        requiresLearningGuard: false,
      }));
  });

  test('requires the learning guard for every learning side effect', () => {
    [
      ANSWER_OUTCOME_IDS.REMEMBER_EXACT_ITEM,
      ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
      ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE,
      ANSWER_OUTCOME_IDS.ADD_HARD_LIMIT_EVIDENCE,
    ].forEach(outcomeId => {
      expect(hasLearningSideEffect(outcomeId)).toBe(true);
      expect(requiresLearningGuard(outcomeId)).toBe(true);
    });

    expect(hasLearningSideEffect(ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM)).toBe(false);
    expect(requiresLearningGuard(ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM)).toBe(false);
    expect(hasLearningSideEffect(ANSWER_OUTCOME_IDS.DO_NOT_LEARN)).toBe(false);
    expect(requiresLearningGuard(ANSWER_OUTCOME_IDS.DO_NOT_LEARN)).toBe(false);
  });

  test('requires explicit policy edit for hard-limit evidence', () => {
    const outcome = getAnswerOutcome(ANSWER_OUTCOME_IDS.ADD_HARD_LIMIT_EVIDENCE);

    expect(outcome).toEqual(expect.objectContaining({
      finalOutcome: false,
      learningSideEffect: LEARNING_SIDE_EFFECTS.POLICY_EDIT_REQUIRED,
      requiresLearningGuard: true,
      requiresExplicitPolicyEdit: true,
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    }));
    expect(requiresExplicitPolicyEdit(ANSWER_OUTCOME_IDS.ADD_HARD_LIMIT_EVIDENCE)).toBe(true);
    expect(requiresExplicitPolicyEdit(ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE)).toBe(false);
  });

  test('exposes immutable question and answer records', () => {
    const frames = listAcceptableQuestionFrames();
    const rejectedFrames = listRejectedQuestionFrames();
    const outcomes = listAnswerOutcomes();

    expect(Object.isFrozen(frames)).toBe(true);
    expect(Object.isFrozen(frames[0])).toBe(true);
    expect(Object.isFrozen(frames[0].authoritySourceIds)).toBe(true);
    expect(Object.isFrozen(rejectedFrames)).toBe(true);
    expect(Object.isFrozen(outcomes)).toBe(true);
    expect(Object.isFrozen(outcomes[0])).toBe(true);
  });

  test('returns false or null for unknown frames and outcomes', () => {
    expect(getAcceptableQuestionFrame('unknown')).toBeNull();
    expect(getRejectedQuestionFrame('unknown')).toBeNull();
    expect(getAnswerOutcome('unknown')).toBeNull();
    expect(isAcceptableQuestionFrame('unknown')).toBe(false);
    expect(isRejectedQuestionFrame('unknown')).toBe(false);
    expect(hasLearningSideEffect('unknown')).toBe(false);
    expect(requiresLearningGuard('unknown')).toBe(false);
    expect(requiresExplicitPolicyEdit('unknown')).toBe(false);
  });
});
