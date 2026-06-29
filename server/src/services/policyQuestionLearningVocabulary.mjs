import {
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
import {
  POLICY_UX_TERM_IDS,
} from './policyUserMentalModel.mjs';

const QUESTION_FRAME_IDS = Object.freeze({
  DESTINATION_FIT: 'destination_fit',
  MISSING_EVIDENCE: 'missing_evidence',
  HARD_LIMIT_CONFLICT: 'hard_limit_conflict',
  ROUTING_GAP: 'routing_gap',
  STALE_PROFILE: 'stale_profile',
  OUTLIER_REVIEW: 'outlier_review',
});

const REJECTED_QUESTION_FRAME_IDS = Object.freeze({
  BROAD_GENRE_PRIORITY: 'broad_genre_priority',
  AI_AUTHORED_POLICY_EDIT: 'ai_authored_policy_edit',
  PROVIDER_SPECIFIC_DIAGNOSTIC: 'provider_specific_diagnostic',
  REPLAY_PARITY_INTERPRETATION: 'replay_parity_interpretation',
});

const ANSWER_OUTCOME_IDS = Object.freeze({
  RESOLVE_CURRENT_ITEM: 'resolve_current_item',
  REMEMBER_EXACT_ITEM: 'remember_exact_item',
  ADD_COMPATIBILITY_EVIDENCE: 'add_compatibility_evidence',
  ADD_IDENTITY_EVIDENCE: 'add_identity_evidence',
  ADD_HARD_LIMIT_EVIDENCE: 'add_hard_limit_evidence',
  DO_NOT_LEARN: 'do_not_learn',
});

const LEARNING_SIDE_EFFECTS = Object.freeze({
  NONE: 'none',
  EXACT_ITEM_MEMORY_CANDIDATE: 'exact_item_memory_candidate',
  COMPATIBILITY_EVIDENCE_CANDIDATE: 'compatibility_evidence_candidate',
  IDENTITY_EVIDENCE_CANDIDATE: 'identity_evidence_candidate',
  POLICY_EDIT_REQUIRED: 'policy_edit_required',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach(item => {
    deepFreeze(item);
  });

  return value;
}

const ACCEPTABLE_QUESTION_FRAMES = deepFreeze([
  {
    id: QUESTION_FRAME_IDS.DESTINATION_FIT,
    label: 'Destination fit',
    operatorQuestion: 'Does this item belong in this destination?',
    whenToUse: 'Candidate evidence is plausible but not strong enough to route automatically.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    relatedUxTermIds: [
      POLICY_UX_TERM_IDS.BELONGS_HERE,
      POLICY_UX_TERM_IDS.READINESS,
    ],
    learningEligibleByDefault: false,
  },
  {
    id: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
    label: 'Missing evidence',
    operatorQuestion: 'Is there enough evidence to treat this as a match?',
    whenToUse: 'The candidate lacks identity, compatibility, profile, or trusted metadata evidence.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    relatedUxTermIds: [
      POLICY_UX_TERM_IDS.BELONGS_HERE,
      POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
      POLICY_UX_TERM_IDS.READINESS,
    ],
    learningEligibleByDefault: false,
  },
  {
    id: QUESTION_FRAME_IDS.HARD_LIMIT_CONFLICT,
    label: 'Hard-limit conflict',
    operatorQuestion: 'Should this hard limit block the item?',
    whenToUse: 'A declared hard limit conflicts with a possible destination.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    relatedUxTermIds: [
      POLICY_UX_TERM_IDS.HARD_LIMITS,
      POLICY_UX_TERM_IDS.AVOID,
    ],
    learningEligibleByDefault: false,
  },
  {
    id: QUESTION_FRAME_IDS.ROUTING_GAP,
    label: 'Routing gap',
    operatorQuestion: 'Should this classified item wait until routing is configured?',
    whenToUse: 'Classification can resolve, but Arr mapping or routing readiness is missing.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    relatedUxTermIds: [
      POLICY_UX_TERM_IDS.ROUTING_TARGET,
      POLICY_UX_TERM_IDS.READINESS,
    ],
    learningEligibleByDefault: false,
  },
  {
    id: QUESTION_FRAME_IDS.STALE_PROFILE,
    label: 'Stale profile',
    operatorQuestion: 'Should Classifarr refresh this library profile before deciding?',
    whenToUse: 'Observed library evidence is missing, stale, or too sparse to trust.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    relatedUxTermIds: [
      POLICY_UX_TERM_IDS.READINESS,
    ],
    learningEligibleByDefault: false,
  },
  {
    id: QUESTION_FRAME_IDS.OUTLIER_REVIEW,
    label: 'Outlier review',
    operatorQuestion: 'Is this item an intentional exception?',
    whenToUse: 'The item differs from the observed profile or declared intent in a review-worthy way.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    relatedUxTermIds: [
      POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
      POLICY_UX_TERM_IDS.READINESS,
    ],
    learningEligibleByDefault: false,
  },
]);

const REJECTED_QUESTION_FRAMES = deepFreeze([
  {
    id: REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY,
    label: 'Broad genre priority',
    rejectionReason: 'Broad genres are evidence, not destination authority.',
    replacementFrameId: QUESTION_FRAME_IDS.DESTINATION_FIT,
  },
  {
    id: REJECTED_QUESTION_FRAME_IDS.AI_AUTHORED_POLICY_EDIT,
    label: 'AI-authored policy edit',
    rejectionReason: 'AI output cannot directly author policy changes or learning side effects.',
    replacementFrameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
  },
  {
    id: REJECTED_QUESTION_FRAME_IDS.PROVIDER_SPECIFIC_DIAGNOSTIC,
    label: 'Provider-specific diagnostic',
    rejectionReason: 'Operators should answer policy fit, not provider internals.',
    replacementFrameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
  },
  {
    id: REJECTED_QUESTION_FRAME_IDS.REPLAY_PARITY_INTERPRETATION,
    label: 'Replay parity interpretation',
    rejectionReason: 'Replay and parity output are verifier data, not runtime operator questions.',
    replacementFrameId: QUESTION_FRAME_IDS.OUTLIER_REVIEW,
  },
]);

const ANSWER_OUTCOMES = deepFreeze([
  {
    id: ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
    label: 'Resolve this item',
    finalOutcome: true,
    learningSideEffect: LEARNING_SIDE_EFFECTS.NONE,
    requiresLearningGuard: false,
    requiresExplicitPolicyEdit: false,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    description: 'Apply the answer to the current item only.',
  },
  {
    id: ANSWER_OUTCOME_IDS.REMEMBER_EXACT_ITEM,
    label: 'Remember exact item',
    finalOutcome: true,
    learningSideEffect: LEARNING_SIDE_EFFECTS.EXACT_ITEM_MEMORY_CANDIDATE,
    requiresLearningGuard: true,
    requiresExplicitPolicyEdit: false,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    description: 'Resolve the item and create a bounded exact-item memory candidate.',
  },
  {
    id: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
    label: 'Add compatibility evidence',
    finalOutcome: true,
    learningSideEffect: LEARNING_SIDE_EFFECTS.COMPATIBILITY_EVIDENCE_CANDIDATE,
    requiresLearningGuard: true,
    requiresExplicitPolicyEdit: false,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    description: 'Resolve the item and propose supportive evidence that should not decide alone.',
  },
  {
    id: ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE,
    label: 'Add identity evidence',
    finalOutcome: true,
    learningSideEffect: LEARNING_SIDE_EFFECTS.IDENTITY_EVIDENCE_CANDIDATE,
    requiresLearningGuard: true,
    requiresExplicitPolicyEdit: false,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    description: 'Resolve the item and propose destination-defining evidence for review.',
  },
  {
    id: ANSWER_OUTCOME_IDS.ADD_HARD_LIMIT_EVIDENCE,
    label: 'Add hard-limit evidence',
    finalOutcome: false,
    learningSideEffect: LEARNING_SIDE_EFFECTS.POLICY_EDIT_REQUIRED,
    requiresLearningGuard: true,
    requiresExplicitPolicyEdit: true,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    description: 'Require an explicit policy edit before a hard limit can become durable.',
  },
  {
    id: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
    label: 'Do not learn',
    finalOutcome: true,
    learningSideEffect: LEARNING_SIDE_EFFECTS.NONE,
    requiresLearningGuard: false,
    requiresExplicitPolicyEdit: false,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    description: 'Resolve or dismiss the current question without creating any learning candidate.',
  },
]);

function listAcceptableQuestionFrames() {
  return ACCEPTABLE_QUESTION_FRAMES;
}

function getAcceptableQuestionFrame(frameId) {
  return ACCEPTABLE_QUESTION_FRAMES.find(frame => frame.id === frameId) || null;
}

function listRejectedQuestionFrames() {
  return REJECTED_QUESTION_FRAMES;
}

function getRejectedQuestionFrame(frameId) {
  return REJECTED_QUESTION_FRAMES.find(frame => frame.id === frameId) || null;
}

function isAcceptableQuestionFrame(frameId) {
  return Boolean(getAcceptableQuestionFrame(frameId));
}

function isRejectedQuestionFrame(frameId) {
  return Boolean(getRejectedQuestionFrame(frameId));
}

function listAnswerOutcomes() {
  return ANSWER_OUTCOMES;
}

function getAnswerOutcome(outcomeId) {
  return ANSWER_OUTCOMES.find(outcome => outcome.id === outcomeId) || null;
}

function hasLearningSideEffect(outcomeId) {
  const outcome = getAnswerOutcome(outcomeId);

  return Boolean(outcome && outcome.learningSideEffect !== LEARNING_SIDE_EFFECTS.NONE);
}

function requiresLearningGuard(outcomeId) {
  return Boolean(getAnswerOutcome(outcomeId)?.requiresLearningGuard);
}

function requiresExplicitPolicyEdit(outcomeId) {
  return Boolean(getAnswerOutcome(outcomeId)?.requiresExplicitPolicyEdit);
}

function normalizeQuestionFrame(frameId) {
  if (isAcceptableQuestionFrame(frameId)) {
    return {
      accepted: true,
      frameId,
      replacementFrameId: null,
      rejectionReason: null,
    };
  }

  const rejectedFrame = getRejectedQuestionFrame(frameId);

  if (!rejectedFrame) {
    return {
      accepted: false,
      frameId: null,
      replacementFrameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
      rejectionReason: 'Unknown question frame.',
    };
  }

  return {
    accepted: false,
    frameId: rejectedFrame.id,
    replacementFrameId: rejectedFrame.replacementFrameId,
    rejectionReason: rejectedFrame.rejectionReason,
  };
}

export {
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
};
