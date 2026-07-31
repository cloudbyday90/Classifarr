import * as policyUserMentalModel from '../../services/policyUserMentalModel.mjs';

const {
  POLICY_SETUP_FIELD_CONTROL_KIND_IDS,
  POLICY_UX_TERM_IDS,
  includesInternalPolicyLanguage,
} = policyUserMentalModel;

describe('policyUserMentalModel', () => {
  test('exports only the production vocabulary and language guard', () => {
    expect(Object.keys(policyUserMentalModel).sort()).toEqual([
      'POLICY_SETUP_FIELD_CONTROL_KIND_IDS',
      'POLICY_UX_TERM_IDS',
      'includesInternalPolicyLanguage',
    ]);
  });

  test('keeps the destination-first UX terms stable for active policy services', () => {
    expect(POLICY_UX_TERM_IDS).toEqual({
      BELONGS_HERE: 'belongs_here',
      HELPFUL_MATCHES: 'helpful_matches',
      HARD_LIMITS: 'hard_limits',
      AVOID: 'avoid',
      ASK_WHEN_UNSURE: 'ask_when_unsure',
      ROUTING_TARGET: 'routing_target',
      READINESS: 'readiness',
    });
    expect(Object.isFrozen(POLICY_UX_TERM_IDS)).toBe(true);
  });

  test('keeps the live workflow control kinds stable', () => {
    expect(POLICY_SETUP_FIELD_CONTROL_KIND_IDS).toEqual({
      OBSERVED_MULTI_SELECT: 'observed_multi_select',
      DECLARED_MULTI_SELECT: 'declared_multi_select',
      DECLARED_CHECKLIST: 'declared_checklist',
      STATUS_SUMMARY: 'status_summary',
      NEXT_ACTION_STATUS: 'next_action_status',
    });
    expect(Object.isFrozen(POLICY_SETUP_FIELD_CONTROL_KIND_IDS)).toBe(true);
  });

  test('detects internal diagnostics without rejecting normal operator language', () => {
    expect(includesInternalPolicyLanguage('Adjust scoring weights before replay parity.')).toBe(true);
    expect(includesInternalPolicyLanguage('Provider gate blocked by TMDB coverage.')).toBe(true);
    expect(includesInternalPolicyLanguage('Use observed examples as suggestions.')).toBe(false);
    expect(includesInternalPolicyLanguage()).toBe(false);
  });
});
