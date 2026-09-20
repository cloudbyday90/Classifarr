/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeRepresentativeShadowSummary } from './representativeShadowSummary'
import { normalizeLibraryEvaluationGuardReasons } from './libraryEvaluationGuardReasons'
const COUNTERS = Object.freeze([
  'prepared_admin_held', 'strict_qualified_admin_held', 'calibrated_qualified_admin_held',
  'live_guard_blocked', 'busy', 'unavailable', 'fallback_blocked', 'freshness_blocked', 'qualified',
])

export function normalizeLibraryEvaluationSummary(value) {
  if (!value || value.version !== 'library_evaluation_summary_v1' || value.routingAffected !== false) return null
  if (value.status !== 'available') return null
  if (Object.keys(value).some(key => !['version', 'status', 'routingAffected', 'counts', 'representative', 'guardReasons'].includes(key))) return null
  if (!value.counts || Object.keys(value.counts).length !== COUNTERS.length) return null
  const counts = {}
  for (const key of COUNTERS) {
    const count = value.counts[key]
    if (!Number.isInteger(count) || count < 0 || count > 1_000_000) return null
    counts[key] = count
  }
  const held = counts.strict_qualified_admin_held + counts.calibrated_qualified_admin_held
  return {
    counts,
    representative: normalizeRepresentativeShadowSummary(value.representative),
    guardReasons: normalizeLibraryEvaluationGuardReasons(value.guardReasons, counts.live_guard_blocked),
    held,
    passed: held + counts.qualified,
    blocked: counts.live_guard_blocked + counts.fallback_blocked + counts.freshness_blocked,
    incomplete: counts.busy + counts.unavailable,
    capped: Object.values(counts).includes(1_000_000),
  }
}
