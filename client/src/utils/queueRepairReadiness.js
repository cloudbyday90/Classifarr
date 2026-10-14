/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const reasons = new Map([
  ['provider_unconfigured', 'TMDb is not configured. Check its settings before reloading.'],
  ['provider_changed', 'TMDb settings changed since approval. Review this repair individually.'],
  ['retry_budget_exhausted', 'The remaining retry budget does not allow this repair. Review the task; limits were not reset.'],
  ['retry_budget_changed', 'Retry limits or attempts changed since approval. Review this repair individually.'],
  ['request_changed', 'The request or its source changed since approval. Review this repair individually.'],
  ['request_unsupported', 'This request format needs individual review before it can be retried.'],
  ['identity_conflict', 'Saved provider IDs conflict. Review the request identity.'],
  ['identity_invalid', 'The saved request identity is incomplete or invalid. Review it individually.'],
  ['task_ineligible', 'This task is no longer eligible for a metadata retry. Review its current state.'],
  ['task_missing', 'This task no longer exists. No retry is available.'],
  ['prior_work', 'Other work or a prior decision is recorded. Review the task before further action.'],
])

export function isRepairReady(readiness) {
  return readiness?.status === 'ready' && readiness.reason === 'ready'
}

export function repairReadinessLabel(readiness) {
  if (isRepairReady(readiness)) return 'Ready for selected retry. Safety checks will run again before queuing.'
  return (readiness?.status === 'blocked' && reasons.get(readiness.reason)) ||
    'Readiness is unavailable. Reload before selecting this repair.'
}
