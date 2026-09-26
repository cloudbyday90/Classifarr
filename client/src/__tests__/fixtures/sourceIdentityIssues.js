/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const sourceIssue = (index = 1, patch = {}) => ({
  key: index.toString(16).padStart(64, '0'), libraryId: 1, libraryName: 'Fixture library',
  title: `Fixture title ${index}`, year: 2020, mediaType: 'movie', issue: 'conflicting_provider_ids',
  recoveryState: 'not_recorded', retryAfter: null, lastSeenAt: '2026-09-26T12:00:00Z', ...patch,
})
export const sourceIssuePage = (offset = 0, total = 1) => ({
  version: 'library.source_identity_issues.v1', asOf: '2026-09-26T12:00:00Z',
  total, offset, pageSize: 50, coveredLibraryCount: 1, activeLibraryCount: 2,
  recovery: { retry_wait: 0, retry_due: 0, source_review: 0, not_recorded: total },
  items: Array.from({ length: Math.min(50, Math.max(0, total - offset)) }, (_, index) => sourceIssue(offset + index + 1)),
})
