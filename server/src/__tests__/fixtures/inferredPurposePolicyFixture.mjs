/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function inferredRule(overrides = {}) {
  return { intent_role: 'purpose', signal_type: 'genres', operator: 'require_any',
    values: { require_any: ['Animation', 'Adventure'] }, semantics: 'identity',
    source: 'media_server_library_profile', inference_state: 'inferred', constraint_mode: 'advisory', ...overrides };
}

export function inferredPolicy(overrides = {}) {
  return { id: 1, library_id: 1, library_name: 'Library A', library_media_type: 'movie',
    enabled: true, auto_classify_threshold: 85, prompt_threshold: 60,
    trust_patterns: false, trust_rag: true, trust_history: false,
    policy_runtime_authority: { sourceId: 'native_intent', validationOk: true },
    policy_intent_contract: { source: 'native_intent', validation: { valid: true },
      purpose: [inferredRule(), inferredRule({ signal_type: 'media_type', values: { require_any: ['movie'] } })],
      hard_limits: [], helpful_hints: [], avoid: [], review_behavior: { combination_mode: 'best_match' } }, ...overrides };
}
