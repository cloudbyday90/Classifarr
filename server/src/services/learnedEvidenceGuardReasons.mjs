/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const LEARNED_EVIDENCE_GUARD_REASONS = Object.freeze([
  'comparison_not_supported', 'identity_not_clear', 'item_unusual',
  'familiarity_unavailable', 'prompt_evidence_changed',
]);

/** Optional, content-free subset of the existing live-guard counter. */
export function projectLearnedEvidenceGuardReasons(value, blocked) {
  if (!value || typeof value !== 'object') return null;
  const projected = {};
  for (const key of LEARNED_EVIDENCE_GUARD_REASONS) {
    const count = value[key];
    if (!Number.isInteger(count) || count < 0 || count > blocked) return null;
    projected[key] = count;
  }
  if (blocked < 1_000_000 && Object.values(projected).reduce((sum, count) => sum + count, 0) > blocked) return null;
  return projected;
}
