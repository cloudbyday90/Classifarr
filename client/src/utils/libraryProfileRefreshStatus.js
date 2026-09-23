/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const LIBRARY_PROFILE_REFRESH_STATUS_VERSION = 'library.profile_refresh_status.v1'

export const LIBRARY_PROFILE_REFRESH_STATUS_LABELS = Object.freeze({
  current: 'Current',
  queued: 'Queued for automatic refresh',
  processing: 'Refreshing',
  retry_wait: 'Retry scheduled',
  cooldown: 'Waiting for automatic recovery',
  waiting: 'Waiting for refresh worker',
  paused: 'Paused while library is inactive',
  unverified: 'Profile has not been verified',
  no_inventory: 'No synced items yet',
})

const revisionPattern = /^(0|[1-9]\d*)$/
export const LIBRARY_PROFILE_RECOVERY_LABELS = Object.freeze({
  planner_overdue: 'Refresh planning is overdue',
  worker_overdue: 'Queued refresh is overdue for a worker',
  lease_recovery_overdue: 'Expired worker lease is overdue for recovery',
})

function validRevision(value) {
  return value === null || (typeof value === 'string' && revisionPattern.test(value))
}

export function parseLibraryProfileRefreshStatus(value) {
  if (!value || value.version !== LIBRARY_PROFILE_REFRESH_STATUS_VERSION ||
      !Array.isArray(value.libraries) || value.libraries.length > 200 ||
      typeof value.windowTruncated !== 'boolean' || typeof value.asOf !== 'string' ||
      !Number.isFinite(Date.parse(value.asOf))) return null

  const libraries = []
  const summary = Object.fromEntries(Object.keys(LIBRARY_PROFILE_REFRESH_STATUS_LABELS).map(id => [id, 0]))
  for (const row of value.libraries) {
    if (!Number.isSafeInteger(row?.libraryId) || row.libraryId <= 0 ||
        typeof row.name !== 'string' || row.name.length > 160 ||
        typeof row.isActive !== 'boolean' ||
        !Object.hasOwn(LIBRARY_PROFILE_REFRESH_STATUS_LABELS, row.statusId) ||
        (row.recoveryReasonId != null &&
          !Object.hasOwn(LIBRARY_PROFILE_RECOVERY_LABELS, row.recoveryReasonId)) ||
        !validRevision(row.sourceRevision) || !validRevision(row.acknowledgedRevision) ||
        !validRevision(row.profileRevision)) return null
    summary[row.statusId] += 1
    libraries.push({ libraryId: row.libraryId, name: row.name, isActive: row.isActive,
      statusId: row.statusId, recoveryReasonId: row.recoveryReasonId ?? null })
  }
  return { asOf: value.asOf, windowTruncated: value.windowTruncated, summary, libraries }
}
