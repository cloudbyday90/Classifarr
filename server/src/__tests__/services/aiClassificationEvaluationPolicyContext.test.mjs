import {
  buildAiClassificationEvaluationPolicyContext,
  isAiClassificationEvaluationPolicyContext,
} from '../../services/aiClassificationEvaluationPolicyContext.mjs';

const baseInput = {
  policies: [{
    policy: {
      id: 7,
      name: 'Family movies',
      enabled: true,
      updated_at: '2026-08-22T10:00:00.000Z',
    },
    library: { id: 4, media_type: 'movie', is_active: true },
  }],
  presetAttachments: [{
    attachment: { policy_id: 7, preset_id: 2, weight: 1 },
    preset: { id: 2, key: 'family', signals: { genres: ['Family'] } },
  }],
  activeNativeIntents: [{ intent: { id: 19, policy_id: 7, intent_version: 3 } }],
  activeNativeRules: [{ rule: { intent_id: 19, intent_role: 'purpose', values: { require_any: ['Family'] } } }],
  activeNativeTemplates: [{ template: { intent_id: 19, preset_id: 2, weight: 1 } }],
};

describe('AI classification evaluation policy context', () => {
  test('is deterministic across row ordering and non-semantic timestamps', () => {
    const original = buildAiClassificationEvaluationPolicyContext(baseInput);
    const reordered = buildAiClassificationEvaluationPolicyContext({
      ...baseInput,
      policies: [{
        library: { is_active: true, media_type: 'movie', id: 4 },
        policy: {
          enabled: true,
          id: 7,
          name: 'Family movies',
          updated_at: '2026-08-22T11:00:00.000Z',
        },
      }],
    });

    expect(reordered.fingerprint).toBe(original.fingerprint);
    expect(isAiClassificationEvaluationPolicyContext(original)).toBe(true);
    expect(original.provenance).toEqual({
      policyCount: 1,
      presetAttachmentCount: 1,
      activeNativeIntentCount: 1,
      activeNativeRuleCount: 1,
      activeNativeTemplateCount: 1,
    });
  });

  test('changes when policy decision state changes', () => {
    const original = buildAiClassificationEvaluationPolicyContext(baseInput);
    const changed = buildAiClassificationEvaluationPolicyContext({
      ...baseInput,
      activeNativeRules: [{
        rule: { intent_id: 19, intent_role: 'purpose', values: { require_any: ['Animation'] } },
      }],
    });

    expect(changed.fingerprint).not.toBe(original.fingerprint);
    expect(isAiClassificationEvaluationPolicyContext({ ...changed, fingerprint: 'not-a-hash' })).toBe(false);
  });
});
