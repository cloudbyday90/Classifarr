/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const reasons = new Map([
  ['staging_disabled', 'Runtime staging was disabled. Generic mode is intentional; no restart is needed for this notice.'],
  ['staging_invalid', 'The runtime staging setting was not recognized, so startup disabled staging. Review PGVECTOR_RUNTIME_STAGING in Compose or the template; keep security protections enabled.'],
  ['generic_build', 'The image reports a generic-only pgvector build. Restarting the same image will not add an optimized binary.'],
  ['cpu_no_avx', 'The host reports no AVX or AVX2 support. Generic mode is expected; no restart is needed for this notice.'],
  ['cpu_unknown', 'Startup could not read CPU capabilities. Review host/container CPU visibility; do not force an optimized binary.'],
  ['optimized_binary_unavailable', 'Startup found no optimized binary matching the reported CPU. Review the image build and startup logs; restarting alone will not add binaries.'],
  ['staging_target_unsafe', 'Startup rejected the optimized binary target as unsafe to load. Review image integrity and pgvector startup messages; do not remove noexec or other container protections.'],
  ['staging_failed', 'Startup could not create the optimized binary symlink. Review runtime-directory ownership and startup messages; do not broadly relax permissions.'],
  ['variant_binaries_missing', 'Startup could not find the selected variant binary. Review image integrity and startup messages before changing deployment settings.'],
  ['optimized_staged', 'Startup staged an optimized binary. This report does not verify which binary a database session loaded.'],
  ['unknown', 'The startup selection reason was not recorded. Review container startup messages.'],
])
const statuses = new Map([
  ['current_process', 'Recorded by this application process for this database run.'],
  ['other_process', 'Saved by another application process or an earlier run; do not treat it as current deployment evidence.'],
  ['database_changed', 'The database restarted or changed after this report; its selection is not verified for the current database run.'],
  ['settings_changed', 'Selection settings changed after this report, possibly from an older instance. Review current startup logs before changing the deployment.'],
  ['unavailable', 'Current database context is unavailable; report freshness cannot be verified.'],
  ['legacy', 'Detailed startup evidence is unavailable from this older report.'],
  ['invalid', 'Saved startup evidence is malformed or unsupported. Review startup logs; do not change protections based on it.'],
])

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) }
/** @param {unknown} value */
function timestamp(value) {
  if (typeof value !== 'string' || value.length !== 24) return 'Unknown'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? value : 'Unknown'
}

/** @param {unknown} selection */
export function getPgvectorSelectionDetails(selection) {
  const status = isRecord(selection) && typeof selection.status === 'string' ? selection.status : 'legacy'
  const report = isRecord(selection) && isRecord(selection.report) ? selection.report : {}
  const reason = typeof report.reason === 'string' ? report.reason : 'unknown'
  const reference = typeof report.reporterId === 'string'
    && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(report.reporterId)
    ? report.reporterId : 'Unknown'
  return {
    summary: statuses.get(status) ?? statuses.get('invalid'),
    advice: status === 'current_process' && report.databaseScope === 'embedded_entrypoint'
      ? reasons.get(reason) ?? reasons.get('unknown') : 'Use current startup logs before acting on a saved selection report.',
    reference, recordedAt: timestamp(report.recordedAt), selectedAt: timestamp(report.selectedAt),
    databaseStartedAt: timestamp(report.databaseStartedAt),
    scope: report.databaseScope === 'embedded_entrypoint' ? 'Embedded entrypoint report' : 'Database relationship unverified',
  }
}

/** @param {unknown} selection @returns {string | null} */
export function getPgvectorSelectionAdvice(selection) {
  if (!isRecord(selection) || !isRecord(selection.report)) return null
  if (selection.status !== 'current_process') {
    const status = typeof selection.status === 'string' ? selection.status : 'invalid'
    return statuses.get(status) ?? statuses.get('invalid') ?? null
  }
  if (selection.report.databaseScope !== 'embedded_entrypoint' || selection.report.selectedVariant !== 'generic') return null
  return typeof selection.report.reason === 'string' ? reasons.get(selection.report.reason) ?? null : null
}
