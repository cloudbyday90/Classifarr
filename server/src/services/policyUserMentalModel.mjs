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

const POLICY_UX_SELECTION_PATTERN_IDS = Object.freeze({
  OBSERVED_SUGGESTION_MULTI_SELECT: 'observed_suggestion_multi_select',
  DECLARED_SIGNAL_MULTI_SELECT: 'declared_signal_multi_select',
  DECLARED_CONSTRAINT_MULTI_SELECT: 'declared_constraint_multi_select',
  REVIEW_TRIGGER_CHECKLIST: 'review_trigger_checklist',
  ROUTING_READINESS_SUMMARY: 'routing_readiness_summary',
  NEXT_ACTION_STATUS: 'next_action_status',
});

const POLICY_UX_TERM_AUDIT_RISK_IDS = Object.freeze({
  MISSING_LABEL: 'missing_label',
  MISSING_PLAIN_QUESTION: 'missing_plain_question',
  MISSING_HELPER: 'missing_helper',
  UNKNOWN_SELECTION_PATTERN: 'unknown_selection_pattern',
  MISSING_PHASE6_CONCEPT: 'missing_phase6_concept',
  MISSING_DECLARED_INTENT_SOURCE: 'missing_declared_intent_source',
  MISSING_OBSERVED_EVIDENCE_SOURCE: 'missing_observed_evidence_source',
  HARD_LIMITS_ALLOW_OBSERVED_EVIDENCE: 'hard_limits_allow_observed_evidence',
  INTERNAL_POLICY_LANGUAGE: 'internal_policy_language',
  BROAD_GENRE_AUTHORITY_LANGUAGE: 'broad_genre_authority_language',
});

const POLICY_SETUP_COPY_RULE_IDS = Object.freeze({
  KNOWN_UX_TERM: 'known_ux_term',
  VISIBLE_LABEL: 'visible_label',
  HELPER_TEXT: 'helper_text',
  OBSERVED_EVIDENCE_CONTEXT: 'observed_evidence_context',
  DECLARED_INTENT_CONTEXT: 'declared_intent_context',
  NO_INTERNAL_LANGUAGE: 'no_internal_language',
  NO_BROAD_GENRE_AUTHORITY: 'no_broad_genre_authority',
});

const POLICY_SETUP_COPY_RISK_IDS = Object.freeze({
  UNKNOWN_UX_TERM: 'unknown_ux_term',
  MISSING_VISIBLE_LABEL: 'missing_visible_label',
  MISMATCHED_VISIBLE_LABEL: 'mismatched_visible_label',
  MISSING_HELPER_TEXT: 'missing_helper_text',
  MISSING_OBSERVED_EVIDENCE_CONTEXT: 'missing_observed_evidence_context',
  MISSING_DECLARED_INTENT_CONTEXT: 'missing_declared_intent_context',
  INTERNAL_POLICY_LANGUAGE: 'internal_policy_language',
  BROAD_GENRE_AUTHORITY_LANGUAGE: 'broad_genre_authority_language',
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
  'identity signal',
  'compatibility signal',
  'impact preview',
  'provider readiness',
  'internal diagnostic',
]);

const OBSERVED_EVIDENCE_LANGUAGE = Object.freeze([
  'observed',
  'already belongs',
  'current contents',
  'current library',
  'existing library',
  'media-server contents',
  'examples',
]);

const DECLARED_INTENT_LANGUAGE = Object.freeze([
  'declared',
  'operator',
  'explicit',
  'accepted',
  'accepts',
  'intent',
  'should',
]);

const BROAD_GENRE_AUTHORITY_LANGUAGE = Object.freeze([
  'genre priority',
  'genre decides',
  'genres decide',
  'genre defines',
  'genre should win',
  'prioritize genre',
  'winning genre',
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
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.OBSERVED_SUGGESTION_MULTI_SELECT,
    mustMentionObservedEvidence: true,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Broad genres can suggest fit, but they do not define a destination unless the operator accepts them as intent.',
    phase6Concept: 'identity_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
    label: 'Helpful Matches',
    plainQuestion: 'What evidence helps, but should not decide alone?',
    helper: 'Add operator-declared soft evidence that can support a match after destination identity is already plausible.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.DECLARED_SIGNAL_MULTI_SELECT,
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
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.DECLARED_CONSTRAINT_MULTI_SELECT,
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Do not infer hard limits from missing examples.',
    phase6Concept: 'constraint_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.AVOID,
    label: 'Avoid',
    plainQuestion: 'What should lower confidence before this destination wins?',
    helper: 'Avoid values come from explicit operator intent and warn Classifarr away from weak matches without becoming hard limits by default.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.DECLARED_CONSTRAINT_MULTI_SELECT,
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Avoid broad genres only when the operator explicitly marks them as poor fit.',
    phase6Concept: 'negative_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
    label: 'Ask When Unsure',
    plainQuestion: 'When should Classifarr ask for review?',
    helper: 'Use operator-declared review triggers when evidence is missing, conflicting, stale, or not safe enough to automate.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.REVIEW_TRIGGER_CHECKLIST,
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Ask about destination fit, not which broad genre is more important.',
    phase6Concept: 'review_trigger',
  },
  {
    id: POLICY_UX_TERM_IDS.ROUTING_TARGET,
    label: 'Routing Target',
    plainQuestion: 'Where should confirmed matches be sent?',
    helper: 'Operator-declared routing readiness is separate from classification confidence.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.ROUTING_READINESS_SUMMARY,
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Genres do not prove routing readiness.',
    phase6Concept: 'routing_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.READINESS,
    label: 'Readiness',
    plainQuestion: 'What is needed before this destination can automate safely?',
    helper: 'Readiness shows the next action when observed evidence, declared intent, profile freshness, or routing is incomplete.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.NEXT_ACTION_STATUS,
    mustMentionObservedEvidence: true,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Broad genre overlap can reduce readiness when identity evidence is weak.',
    phase6Concept: 'automation_readiness',
  },
]);

const DEFAULT_POLICY_SETUP_COPY = deepFreeze(POLICY_UX_TERMS.map(term => ({
  termId: term.id,
  label: term.label,
  question: term.plainQuestion,
  helperText: term.helper,
  selectionPatternId: term.selectionPatternId,
})));

function listPolicySetupQuestions() {
  return POLICY_USER_MENTAL_MODEL.setupQuestions;
}

function listPolicyUxTerms() {
  return POLICY_UX_TERMS;
}

function listDefaultPolicySetupCopy() {
  return DEFAULT_POLICY_SETUP_COPY;
}

function getPolicyUxTerm(termId) {
  return POLICY_UX_TERMS.find(term => term.id === termId) || null;
}

function getPolicySetupQuestion(questionId) {
  return POLICY_USER_MENTAL_MODEL.setupQuestions.find(question => question.id === questionId) || null;
}

function getPolicyUserMentalModel() {
  return POLICY_USER_MENTAL_MODEL;
}

function includesInternalPolicyLanguage(text) {
  const normalizedText = String(text || '').toLowerCase();

  return INTERNAL_LANGUAGE_FLAGS.some(flag => normalizedText.includes(flag.toLowerCase()));
}

function listInternalPolicyLanguageFlags() {
  return INTERNAL_LANGUAGE_FLAGS;
}

function isKnownSelectionPattern(selectionPatternId) {
  return Object.values(POLICY_UX_SELECTION_PATTERN_IDS).includes(selectionPatternId);
}

function includesAnyLanguage(text, phrases) {
  const normalizedText = String(text || '').toLowerCase();

  return phrases.some(phrase => normalizedText.includes(phrase.toLowerCase()));
}

function normalizePolicySetupCopy(candidate = {}) {
  const term = getPolicyUxTerm(candidate.termId);
  const label = String(candidate.label || '').trim();
  const helperText = String(candidate.helperText || '').trim();
  const supportingText = [
    label,
    helperText,
    candidate.question,
    candidate.bodyText,
    candidate.disabledReason,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    termId: String(candidate.termId || '').trim(),
    label,
    helperText,
    expectedLabel: term?.label || null,
    supportingText,
  };
}

function validatePolicyUxTermContract(term = {}) {
  const issues = [];
  const authoritySourceIds = Array.isArray(term.authoritySourceIds) ? term.authoritySourceIds : [];

  if (!String(term.label || '').trim()) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_LABEL,
      message: 'Policy UX term must expose a visible label.',
    });
  }

  if (!String(term.plainQuestion || '').trim()) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_PLAIN_QUESTION,
      message: 'Policy UX term must expose a plain setup question.',
    });
  }

  if (!String(term.helper || '').trim()) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_HELPER,
      message: 'Policy UX term must expose helper text.',
    });
  }

  if (!isKnownSelectionPattern(term.selectionPatternId)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.UNKNOWN_SELECTION_PATTERN,
      message: 'Policy UX term must map to an approved interaction pattern.',
    });
  }

  if (!String(term.phase6Concept || '').trim()) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_PHASE6_CONCEPT,
      message: 'Policy UX term must map to a future Phase 6R engine concept.',
    });
  }

  if (term.mustMentionObservedEvidence &&
      !authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_OBSERVED_EVIDENCE_SOURCE,
      message: 'Observed-evidence copy must include media-server contents as an authority source.',
    });
  }

  if (term.mustMentionDeclaredIntent &&
      !authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_DECLARED_INTENT_SOURCE,
      message: 'Declared-intent copy must include operator-declared intent as an authority source.',
    });
  }

  if (term.id === POLICY_UX_TERM_IDS.HARD_LIMITS &&
      authoritySourceIds.some(sourceId => sourceId !== AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.HARD_LIMITS_ALLOW_OBSERVED_EVIDENCE,
      message: 'Hard Limits must remain explicit operator intent only.',
    });
  }

  const termText = [
    term.label,
    term.plainQuestion,
    term.helper,
    term.broadGenreRule,
  ]
    .filter(Boolean)
    .join(' ');

  if (includesInternalPolicyLanguage(termText)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
      message: 'Policy UX term must avoid internal diagnostic or scoring language.',
    });
  }

  if (includesAnyLanguage(termText, BROAD_GENRE_AUTHORITY_LANGUAGE)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      message: 'Policy UX term must not present broad genres as the authority that decides destination fit.',
    });
  }

  return {
    ok: issues.length === 0,
    termId: term.id || null,
    selectionPatternId: term.selectionPatternId || null,
    issues,
  };
}

function buildPolicyUserMentalModelAudit({ terms = POLICY_UX_TERMS, setupCopy = DEFAULT_POLICY_SETUP_COPY } = {}) {
  const termResults = terms.map(term => validatePolicyUxTermContract(term));
  const setupCopyAudit = buildPolicySetupCopyAudit(setupCopy);
  const issueCount = termResults.reduce((count, result) => count + result.issues.length, 0) +
    setupCopyAudit.issueCount;

  return {
    ok: issueCount === 0,
    checkedTermCount: termResults.length,
    checkedSetupCopyCount: setupCopyAudit.checkedCount,
    issueCount,
    termResults,
    setupCopyAudit,
  };
}

function validatePolicySetupCopy(candidate = {}) {
  const normalizedCopy = normalizePolicySetupCopy(candidate);
  const term = getPolicyUxTerm(normalizedCopy.termId);
  const issues = [];

  if (!term) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.KNOWN_UX_TERM,
      riskId: POLICY_SETUP_COPY_RISK_IDS.UNKNOWN_UX_TERM,
      message: 'Setup copy must map to an approved Phase 0R policy UX term.',
    });
  }

  if (!normalizedCopy.label) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.VISIBLE_LABEL,
      riskId: POLICY_SETUP_COPY_RISK_IDS.MISSING_VISIBLE_LABEL,
      message: 'Setup copy must expose a visible label.',
    });
  } else if (term && normalizedCopy.label !== term.label) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.VISIBLE_LABEL,
      riskId: POLICY_SETUP_COPY_RISK_IDS.MISMATCHED_VISIBLE_LABEL,
      message: `Setup copy label must use the approved "${term.label}" label.`,
    });
  }

  if (!normalizedCopy.helperText) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.HELPER_TEXT,
      riskId: POLICY_SETUP_COPY_RISK_IDS.MISSING_HELPER_TEXT,
      message: 'Setup copy must include helper text that explains the operator decision.',
    });
  }

  if (term?.mustMentionObservedEvidence &&
      !includesAnyLanguage(normalizedCopy.supportingText, OBSERVED_EVIDENCE_LANGUAGE)) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.OBSERVED_EVIDENCE_CONTEXT,
      riskId: POLICY_SETUP_COPY_RISK_IDS.MISSING_OBSERVED_EVIDENCE_CONTEXT,
      message: 'Setup copy must explain when observed library evidence is being used.',
    });
  }

  if (term?.mustMentionDeclaredIntent &&
      !includesAnyLanguage(normalizedCopy.supportingText, DECLARED_INTENT_LANGUAGE)) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.DECLARED_INTENT_CONTEXT,
      riskId: POLICY_SETUP_COPY_RISK_IDS.MISSING_DECLARED_INTENT_CONTEXT,
      message: 'Setup copy must explain when operator-declared intent is required.',
    });
  }

  if (includesInternalPolicyLanguage(normalizedCopy.supportingText)) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.NO_INTERNAL_LANGUAGE,
      riskId: POLICY_SETUP_COPY_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
      message: 'Setup copy must avoid internal diagnostic or scoring language.',
    });
  }

  if (includesAnyLanguage(normalizedCopy.supportingText, BROAD_GENRE_AUTHORITY_LANGUAGE)) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.NO_BROAD_GENRE_AUTHORITY,
      riskId: POLICY_SETUP_COPY_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      message: 'Setup copy must not present broad genres as the authority that decides destination fit.',
    });
  }

  return {
    ok: issues.length === 0,
    termId: normalizedCopy.termId,
    expectedLabel: normalizedCopy.expectedLabel,
    issues,
  };
}

function buildPolicySetupCopyAudit(candidates = []) {
  const results = candidates.map(candidate => validatePolicySetupCopy(candidate));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function getDurableAuthorityTermIds() {
  return POLICY_UX_TERMS
    .filter(term => term.authoritySourceIds.some(sourceId => isDurablePolicyAuthority(sourceId)))
    .map(term => term.id);
}

export {
  MENTAL_MODEL_QUESTION_IDS,
  POLICY_SETUP_COPY_RISK_IDS,
  POLICY_SETUP_COPY_RULE_IDS,
  POLICY_UX_SELECTION_PATTERN_IDS,
  POLICY_UX_TERM_AUDIT_RISK_IDS,
  POLICY_UX_TERM_IDS,
  buildPolicyUserMentalModelAudit,
  buildPolicySetupCopyAudit,
  getDurableAuthorityTermIds,
  listDefaultPolicySetupCopy,
  getPolicySetupQuestion,
  getPolicyUserMentalModel,
  getPolicyUxTerm,
  includesInternalPolicyLanguage,
  listInternalPolicyLanguageFlags,
  listPolicySetupQuestions,
  listPolicyUxTerms,
  normalizePolicySetupCopy,
  validatePolicyUxTermContract,
  validatePolicySetupCopy,
};
