/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
export const LEGACY_METHOD = Object.freeze({
  EXACT_MATCH:        'exact_match',
  LEARNED_PATTERN:    'learned_pattern',
  POLICY_AUTO:        'policy_auto',
  POLICY_CONFIRM:     'policy_confirm',
  AI_VERIFIED:        'ai_verified',
  MANUAL:             'manual_classification'
});

export const METHOD_LABELS = Object.freeze({
  [LEGACY_METHOD.EXACT_MATCH]:     'Exact Match',
  [LEGACY_METHOD.LEARNED_PATTERN]: 'Learned Pattern',
  [LEGACY_METHOD.POLICY_AUTO]:     'Policy Auto',
  [LEGACY_METHOD.POLICY_CONFIRM]:  'Policy Confirm',
  [LEGACY_METHOD.AI_VERIFIED]:     'AI Verified',
  [LEGACY_METHOD.MANUAL]:          'Manual Classification'
});

export function toMethod(evidenceRow) {
  if (!evidenceRow) return LEGACY_METHOD.POLICY_AUTO;

  const { scope } = evidenceRow;

  if (scope === 'item_exact') return LEGACY_METHOD.EXACT_MATCH;

  if (scope === 'genre' || scope === 'studio' || scope === 'franchise' || scope === 'certification') {
    return LEGACY_METHOD.LEARNED_PATTERN;
  }

  return LEGACY_METHOD.POLICY_AUTO;
}

export function toLabel(method) {
  return METHOD_LABELS[method] ?? method ?? 'Unknown';
}

/** @internal */
export function toMethodLabel(evidenceRow) {
  return toLabel(toMethod(evidenceRow));
}

export function isAuthoritative(evidenceRow) {
  if (!evidenceRow) return false;
  return evidenceRow.scope === 'item_exact' && evidenceRow.provenance === 'human_confirmed';
}

export function buildCompatibilityPayload(evidenceRow, fallbackMethod = null) {
  if (evidenceRow) {
    const method = toMethod(evidenceRow);
    return {
      method,
      methodLabel: toLabel(method),
      isAuthoritative: isAuthoritative(evidenceRow)
    };
  }

  const method = fallbackMethod ?? LEGACY_METHOD.POLICY_AUTO;
  return {
    method,
    methodLabel: toLabel(method),
    isAuthoritative: false
  };
}
