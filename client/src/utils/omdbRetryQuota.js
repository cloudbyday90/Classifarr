/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const statuses = ['available', 'limit_reached', 'not_configured', 'credentials_rejected', 'invalid_configuration']
export function parseOmdbRetryQuota(value) {
  if (!value || !statuses.includes(value.status)) return null
  const known = ['available', 'limit_reached'].includes(value.status)
  if (known) {
    if (![value.used, value.limit].every(n => Number.isInteger(n) && n >= 0 && n <= 2147483647) || value.limit < 1 ||
      (value.status === 'available') !== (value.used < value.limit)) return null
    if (value.resetAt !== null && (typeof value.resetAt !== 'string' || !Number.isFinite(Date.parse(value.resetAt)))) return null
  } else if (value.used !== null || value.limit !== null || value.resetAt !== null) return null
  return { status: value.status, used: value.used, limit: value.limit, resetAt: value.resetAt }
}

export function omdbRetryNextStep(report) {
  if (!report.inspected) return { text: 'No pending OMDb retries. No action needed.' }
  const reasons = {
    not_configured: 'OMDb is off or has no saved key. Keep it off if intentional.',
    credentials_rejected: 'OMDb rejected access. Correct the saved key or account access before retrying.',
    invalid_configuration: 'The saved OMDb budget or reset date is invalid. Review settings before retrying.',
  }
  const text = reasons[report.quota.status] || (report.counts.settings_blocked ? 'OMDb access needs review before retrying.' : null) || (report.quota.status === 'limit_reached' && !report.quota.resetAt
    ? 'Saved usage has no reset date. Review OMDb usage; no automatic reset is assumed.' : null)
  return text ? { text, label: 'Review OMDb settings', to: { path: '/settings', query: { tab: 'omdb' } } } : null
}
