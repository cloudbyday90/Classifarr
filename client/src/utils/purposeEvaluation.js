/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { purposeExact as exact, purposeTime as time, readPurposeEvaluationReport,
  PURPOSE_EVALUATION_FAILURES as failures, PURPOSE_EVALUATION_DEFERRALS as deferrals } from './purposeEvaluationContract'

/** Fixed saved summary only. Never retain unknown response fields or private error text. */
export function normalizePurposeEvaluation(value) {
  if (!exact(value, ['version', 'status', 'reason', 'checkedAt', 'observedAt', 'nextCheckAt', 'report']) ||
      value.version !== 'purpose_evaluation_status.v1' || !time(value.checkedAt) ||
      !['complete', 'never_run', 'unavailable', 'invalid', 'stale', 'deferred', 'failed'].includes(value.status) ||
      value.observedAt !== null && (!time(value.observedAt) || value.observedAt > value.checkedAt) ||
      value.nextCheckAt !== null && (!time(value.nextCheckAt) || !value.observedAt || value.nextCheckAt <= value.observedAt ||
        Date.parse(value.nextCheckAt) > Date.parse(value.checkedAt) + 60 * 60000)) return null
  const missingSources = value.status === 'unavailable' && value.reason === 'sources_unavailable'
  if (['failed', 'deferred'].includes(value.status) || missingSources) {
    if (!failures.includes(value.reason) || (value.status === 'deferred') !== deferrals.includes(value.reason) ||
        (value.reason === 'sources_unavailable') !== missingSources || !value.observedAt || !value.nextCheckAt || value.report !== null) return null
  } else if (value.reason !== null) return null
  if ((value.status === 'never_run' || value.status === 'unavailable' && !missingSources) &&
      (value.observedAt !== null || value.nextCheckAt !== null)) return null
  if (value.status === 'stale' && (!value.observedAt || !value.nextCheckAt || Date.parse(value.checkedAt) - Date.parse(value.observedAt) < 15 * 60000)) return null
  if (value.status === 'complete') {
    if (!value.observedAt || !value.nextCheckAt || Date.parse(value.checkedAt) - Date.parse(value.observedAt) >= 15 * 60000 ||
        !readPurposeEvaluationReport(value.report) || value.report.window.until !== value.observedAt) return null
  } else if (value.report !== null) return null
  return value
}
