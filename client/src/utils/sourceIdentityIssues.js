/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const recoveryLabels = Object.freeze({
  retry_wait: 'Automatic retry waiting',
  retry_due: 'Automatic retry eligible',
  source_review: 'Check source metadata',
  not_recorded: 'Recovery not confirmed',
})

export const issueLabels = Object.freeze({
  conflicting_provider_ids: 'Conflicting movie / TV identifiers',
  invalid_provider_ids: 'Invalid movie / TV identifiers',
  invalid_media_type: 'Unknown content type',
})

const isCount = value => Number.isSafeInteger(value) && value >= 0
const isDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const isText = value => value === null || (typeof value === 'string' && value.length <= 500)
const owns = (object, key) => Object.hasOwn(object, key)

export function parseSourceIdentityIssues(value, offset) {
  if (value?.version !== 'library.source_identity_issues.v1' || !isDate(value.asOf) ||
      value.offset !== offset || value.pageSize !== 50 || !isCount(value.total) ||
      !isCount(value.coveredLibraryCount) || !isCount(value.activeLibraryCount) ||
      value.coveredLibraryCount > value.activeLibraryCount ||
      !Object.keys(recoveryLabels).every(key => isCount(value.recovery?.[key])) ||
      Object.keys(recoveryLabels).reduce((sum, key) => sum + value.recovery[key], 0) !== value.total ||
      !Array.isArray(value.items) || value.items.length !== Math.min(50, Math.max(0, value.total - offset))) return null
  const keys = new Set()
  const pageRecovery = Object.fromEntries(Object.keys(recoveryLabels).map(key => [key, 0]))
  for (const item of value.items) {
    if (!item || typeof item.key !== 'string' || !/^[a-f0-9]{64}$/.test(item.key) || keys.has(item.key) ||
        !isCount(item.libraryId) || item.libraryId === 0 || !isText(item.libraryName) || !isText(item.title) ||
        !(item.year === null || (isCount(item.year) && item.year > 0 && item.year <= 9999)) ||
        ![null, 'movie', 'tv'].includes(item.mediaType) || !owns(issueLabels, item.issue) ||
        !owns(recoveryLabels, item.recoveryState) || !isDate(item.lastSeenAt) ||
        !(item.retryAfter === null || isDate(item.retryAfter)) ||
        (['retry_wait', 'retry_due'].includes(item.recoveryState) && !isDate(item.retryAfter))) return null
    keys.add(item.key)
    const expectedState = item.issue !== 'conflicting_provider_ids' ? 'source_review'
      : item.retryAfter === null ? 'not_recorded'
        : Date.parse(item.retryAfter) > Date.parse(value.asOf) ? 'retry_wait' : 'retry_due'
    if (item.recoveryState !== expectedState) return null
    pageRecovery[item.recoveryState]++
  }
  if (Object.keys(pageRecovery).some(key => pageRecovery[key] > value.recovery[key])) return null
  return value
}

export function sourceIssueNextStep(item) {
  if (item.recoveryState === 'retry_wait') return 'No action needed yet. A later library sync can retry after the time below.'
  if (item.recoveryState === 'retry_due') return 'The retry delay has elapsed. Recovery can be attempted on a later library sync; it is not confirmed running.'
  if (item.issue === 'invalid_media_type') return 'Check the item’s content type in your media server. Classifarr supports movies and TV, not music.'
  return 'Find this title in the named library in your media server. Check its match and year, correct it if needed, then sync the library again.'
}
