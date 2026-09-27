/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const RETRY_LABELS = {
  waiting: 'Waiting for scheduled retry', eligible: 'Eligible for retry — waiting for queue admission',
  in_progress: 'Recovery attempt in progress', source_blocked: 'Retry blocked by source conflict',
  not_scheduled: 'Retry time not recorded',
}
export const recoveryRetryLabel = value => RETRY_LABELS[value] || 'Retry state unknown'
export const recoveryDate = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not recorded'
export function safePlexItemLink(url) {
  return typeof url === 'string' && /^https:\/\/app\.plex\.tv\/desktop\/#!\/server\/[a-fA-F0-9-]{16,64}\/details\?key=%2Flibrary%2Fmetadata%2F[1-9][0-9]{0,19}$/.test(url)
}

export function parseInventoryRecovery(value, afterId) {
  const count = n => Number.isSafeInteger(n) && n >= 0
  if (value?.version !== 1 || value.afterId !== afterId || value.pageSize !== 25 ||
    ![value.total, value.movies, value.tv].every(count) || value.movies + value.tv !== value.total ||
    !Number.isFinite(Date.parse(value.asOf)) || !Array.isArray(value.items) || value.items.length > 25 ||
    value.items.length > value.total) throw new TypeError('Invalid recovery snapshot')
  let previous = afterId
  for (const item of value.items) {
    if (!count(item.id) || item.id <= previous || !['movie', 'tv'].includes(item.mediaType) ||
      ![item.title, item.libraryName, item.diagnosis, item.instruction].every(text => typeof text === 'string' && text.length <= 500) ||
      !Object.hasOwn(RETRY_LABELS, item.retryState)) throw new TypeError('Invalid recovery item')
    previous = item.id
  }
  if (value.nextCursor !== null && (value.items.length !== 25 || value.nextCursor !== previous)) throw new TypeError('Invalid recovery cursor')
  return value
}
