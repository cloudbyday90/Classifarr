// Public, read-only projection of the existing process-local evaluation counters.
export const LIBRARY_EVALUATION_COUNTERS = Object.freeze([
  'prepared_admin_held', 'strict_qualified_admin_held', 'calibrated_qualified_admin_held',
  'live_guard_blocked', 'busy', 'unavailable', 'fallback_blocked', 'freshness_blocked', 'qualified',
]);

export function readLibraryEvaluationSummary(readStatus) {
  const unavailable = { version: 'library_evaluation_summary_v1', status: 'unavailable', routingAffected: false };
  try {
    const source = readStatus();
    if (source?.version !== 'learned_evidence_evaluation_v1' || source.automaticRouteAllowed !== false) return unavailable;
    const counts = {};
    for (const key of LIBRARY_EVALUATION_COUNTERS) {
      const count = source.counts?.[key];
      if (!Number.isInteger(count) || count < 0 || count > 1_000_000) return unavailable;
      counts[key] = count;
    }
    return { ...unavailable, status: 'available', counts };
  } catch {
    return unavailable;
  }
}
