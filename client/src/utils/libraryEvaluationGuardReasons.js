/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const LABELS = Object.freeze({
  comparison_not_supported: 'Content comparison did not meet the required checks',
  identity_not_clear: 'The same item may be present in another destination',
  item_unusual: 'Item descriptions were unusual for the suggested library',
  familiarity_unavailable: 'Library familiarity could not be established',
  prompt_evidence_changed: 'Evidence no longer matched the AI comparison',
})

export function normalizeLibraryEvaluationGuardReasons(value, blocked) {
  if (!value || Object.keys(value).length !== Object.keys(LABELS).length) return []
  const reasons = []
  for (const [key, label] of Object.entries(LABELS)) {
    const count = value[key]
    if (!Number.isInteger(count) || count < 0 || count > blocked) return []
    if (count) reasons.push({ key, label, count })
  }
  if (blocked < 1_000_000 && reasons.reduce((sum, reason) => sum + reason.count, 0) > blocked) return []
  return reasons
}
