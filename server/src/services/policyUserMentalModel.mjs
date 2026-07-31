const POLICY_UX_TERM_IDS = Object.freeze({
  BELONGS_HERE: 'belongs_here',
  HELPFUL_MATCHES: 'helpful_matches',
  HARD_LIMITS: 'hard_limits',
  AVOID: 'avoid',
  ASK_WHEN_UNSURE: 'ask_when_unsure',
  ROUTING_TARGET: 'routing_target',
  READINESS: 'readiness',
});

const POLICY_SETUP_FIELD_CONTROL_KIND_IDS = Object.freeze({
  OBSERVED_MULTI_SELECT: 'observed_multi_select',
  DECLARED_MULTI_SELECT: 'declared_multi_select',
  DECLARED_CHECKLIST: 'declared_checklist',
  STATUS_SUMMARY: 'status_summary',
  NEXT_ACTION_STATUS: 'next_action_status',
});

const INTERNAL_POLICY_LANGUAGE_FLAGS = Object.freeze([
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

function includesInternalPolicyLanguage(text) {
  const normalizedText = String(text || '').toLowerCase();

  return INTERNAL_POLICY_LANGUAGE_FLAGS.some(flag =>
    normalizedText.includes(flag.toLowerCase())
  );
}

export {
  POLICY_SETUP_FIELD_CONTROL_KIND_IDS,
  POLICY_UX_TERM_IDS,
  includesInternalPolicyLanguage,
};
