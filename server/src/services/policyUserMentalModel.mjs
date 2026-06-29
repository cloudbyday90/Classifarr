import {
  AUTHORITY_SOURCE_IDS,
  isDurablePolicyAuthority,
} from './policyAuthorityVocabulary.mjs';

const MENTAL_MODEL_QUESTION_IDS = Object.freeze({
  OBSERVED_BELONGS_HERE: 'observed_belongs_here',
  DECLARED_LIMITS: 'declared_limits',
  REVIEW_BEHAVIOR: 'review_behavior',
  ROUTING_TARGET: 'routing_target',
});

const POLICY_UX_TERM_IDS = Object.freeze({
  BELONGS_HERE: 'belongs_here',
  HELPFUL_MATCHES: 'helpful_matches',
  HARD_LIMITS: 'hard_limits',
  AVOID: 'avoid',
  ASK_WHEN_UNSURE: 'ask_when_unsure',
  ROUTING_TARGET: 'routing_target',
  READINESS: 'readiness',
});

const INTERNAL_LANGUAGE_FLAGS = Object.freeze([
  'scoring weight',
  'score weight',
  'customSignals',
  'provider gate',
  'replay parity',
  'tmdb coverage',
  'genre priority',
  'raw preset',
]);

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

const POLICY_USER_MENTAL_MODEL = deepFreeze({
  summary: 'Use what already exists, keep what the operator declares, and ask only when the evidence is not safe enough to automate.',
  setupQuestions: [
    {
      id: MENTAL_MODEL_QUESTION_IDS.OBSERVED_BELONGS_HERE,
      question: 'What already belongs here?',
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      purpose: 'Use observed library contents as suggestions before the operator accepts declared intent.',
    },
    {
      id: MENTAL_MODEL_QUESTION_IDS.DECLARED_LIMITS,
      question: 'What should always or never belong here?',
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      purpose: 'Capture explicit destination identity, hard limits, and avoid rules.',
    },
    {
      id: MENTAL_MODEL_QUESTION_IDS.REVIEW_BEHAVIOR,
      question: 'When should Classifarr ask?',
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      purpose: 'Define review behavior without turning every answer into learning.',
    },
    {
      id: MENTAL_MODEL_QUESTION_IDS.ROUTING_TARGET,
      question: 'Can this destination route?',
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      purpose: 'Separate classification intent from Arr routing readiness.',
    },
  ],
});

const POLICY_UX_TERMS = deepFreeze([
  {
    id: POLICY_UX_TERM_IDS.BELONGS_HERE,
    label: 'Belongs Here',
    plainQuestion: 'What clearly belongs in this destination?',
    helper: 'Use observed examples as suggestions, then accept only the values that should define this destination.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    mustMentionObservedEvidence: true,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Broad genres can suggest fit, but they do not define a destination unless the operator accepts them as intent.',
    phase6Concept: 'identity_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
    label: 'Helpful Matches',
    plainQuestion: 'What evidence helps, but should not decide alone?',
    helper: 'Add soft evidence that can support a match after destination identity is already plausible.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Broad genres usually belong here unless they are accepted as destination identity.',
    phase6Concept: 'compatibility_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.HARD_LIMITS,
    label: 'Hard Limits',
    plainQuestion: 'What should block this destination?',
    helper: 'Hard limits only come from explicit operator intent and can block classification or routing.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Do not infer hard limits from missing examples.',
    phase6Concept: 'constraint_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.AVOID,
    label: 'Avoid',
    plainQuestion: 'What should lower confidence before this destination wins?',
    helper: 'Avoid values warn Classifarr away from weak matches without becoming hard limits by default.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Avoid broad genres only when the operator explicitly marks them as poor fit.',
    phase6Concept: 'negative_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
    label: 'Ask When Unsure',
    plainQuestion: 'When should Classifarr ask for review?',
    helper: 'Use review triggers when evidence is missing, conflicting, stale, or not safe enough to automate.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Ask about destination fit, not which broad genre is more important.',
    phase6Concept: 'review_trigger',
  },
  {
    id: POLICY_UX_TERM_IDS.ROUTING_TARGET,
    label: 'Routing Target',
    plainQuestion: 'Where should confirmed matches be sent?',
    helper: 'Routing readiness is separate from classification confidence.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Genres do not prove routing readiness.',
    phase6Concept: 'routing_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.READINESS,
    label: 'Readiness',
    plainQuestion: 'What is needed before this destination can automate safely?',
    helper: 'Readiness shows the next action when intent, evidence, profile freshness, or routing is incomplete.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    mustMentionObservedEvidence: true,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Broad genre overlap can reduce readiness when identity evidence is weak.',
    phase6Concept: 'automation_readiness',
  },
]);

function listPolicySetupQuestions() {
  return POLICY_USER_MENTAL_MODEL.setupQuestions;
}

function listPolicyUxTerms() {
  return POLICY_UX_TERMS;
}

function getPolicyUxTerm(termId) {
  return POLICY_UX_TERMS.find(term => term.id === termId) || null;
}

function getPolicyUserMentalModel() {
  return POLICY_USER_MENTAL_MODEL;
}

function includesInternalPolicyLanguage(text) {
  const normalizedText = String(text || '').toLowerCase();

  return INTERNAL_LANGUAGE_FLAGS.some(flag => normalizedText.includes(flag.toLowerCase()));
}

function getDurableAuthorityTermIds() {
  return POLICY_UX_TERMS
    .filter(term => term.authoritySourceIds.some(sourceId => isDurablePolicyAuthority(sourceId)))
    .map(term => term.id);
}

export {
  MENTAL_MODEL_QUESTION_IDS,
  POLICY_UX_TERM_IDS,
  getDurableAuthorityTermIds,
  getPolicyUserMentalModel,
  getPolicyUxTerm,
  includesInternalPolicyLanguage,
  listPolicySetupQuestions,
  listPolicyUxTerms,
};
