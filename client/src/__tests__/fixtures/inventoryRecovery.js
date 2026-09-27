/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function inventoryRecoveryFixture(afterId = 0, total = 1) {
  const caseId = '56d6ff3b-21ee-457b-bf93-b3d2ef767b4b'
  const items = Array.from({ length: Math.min(25, Math.max(0, total - afterId)) }, (_, i) => ({
    id: afterId + i + 1, caseId, title: `Example movie ${afterId + i + 1}`, year: 2020,
    libraryName: 'Movies', mediaType: 'movie', tmdbId: 7, isPlex: true,
    diagnosis: 'TMDb record not found', instruction: 'Verify the source match. No identity was replaced.',
    retryState: 'waiting', retryAt: '2026-09-28T12:00:00.000Z', attemptCount: 2,
    lastCheckedAt: '2026-09-27T12:00:00.000Z', sourceReview: true, identityCheck: null,
  }))
  return { version: 1, asOf: '2026-09-27T12:00:00.000Z', afterId, pageSize: 25,
    total, movies: total, tv: 0, items, nextCursor: afterId + 25 < total ? afterId + 25 : null }
}
export const inventoryRecoveryPlexUrl = 'https://app.plex.tv/desktop/#!/server/abcdef0123456789/details?key=%2Flibrary%2Fmetadata%2F123'

export function inventoryRecoveryProgressFixture() {
  return { version: 1, asOf: '2026-09-27T12:00:00.000Z', readiness: 'ready', limit: 1000,
    windowDays: 30, truncated: false, total: 10,
    stages: { waiting: 1, ready: 1, queued: 1, checking: 1, blocked: 1, recovered: 5, unknown: 0 },
    oldestReadySeconds: 600, eligibleToQueue: { samples: 8, seconds: 60 }, queueToRecovery: { samples: 5, seconds: 3600 } }
}
