/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { it, expect } from 'vitest'
import { parseRetryReadiness, retryReadinessNextStep } from '@/utils/retryReadiness'
import { parseOmdbRetryQuota } from '@/utils/omdbRetryQuota'
const quota = { status: 'available', used: 1, limit: 2, resetAt: '2026-09-30T00:00:00Z' }
const report = { version: 1, scope: 'omdb', limitPerQueue: 50, inspected: 1, hasMore: false,
  observedAt: '2026-09-29T12:00:00Z', earliestRetryAt: null, quota,
  counts: { cached_ready: 0, provider_ready: 1, held: 0, settings_blocked: 0, provider_wait: 0, scheduled: 0 } }
it('projects only valid OMDb fields and rejects cross-provider snapshots', () => {
  expect(parseRetryReadiness(report)).toBeNull()
  expect(parseRetryReadiness({ ...report, quota: { ...quota, api_key: 'private' } }, 'omdb')).toEqual(report)
  expect(parseRetryReadiness({ ...report, scope: 'web_search' }, 'omdb')).toBeNull()
  expect(parseRetryReadiness(report, 'music')).toBeNull()
  expect(parseRetryReadiness({ ...report, inspected: 51 }, 'omdb')).toBeNull()
  expect(parseRetryReadiness({ ...report, counts: { ...report.counts, cached_ready: 1, provider_ready: 0 } }, 'omdb')).toBeNull()
  expect(parseRetryReadiness({ ...report, quota: { ...quota, status: 'limit_reached', used: 2 } }, 'omdb')).toBeNull()
})
it.each([null, {}, { ...quota, status: 'surprise' }, { ...quota, used: -1 }, { ...quota, limit: 0 },
  { ...quota, used: 2 }, { ...quota, resetAt: 'bad' }, { ...quota, status: 'credentials_rejected' }])('rejects misleading quota %j', value => {
  expect(parseOmdbRetryQuota(value)).toBeNull()
})
it.each(['not_configured', 'credentials_rejected', 'invalid_configuration'])('does not show unknown %s budget as zero', status => {
  const unknown = { status, used: null, limit: null, resetAt: null }
  expect(parseOmdbRetryQuota(unknown)).toEqual(unknown)
  expect(retryReadinessNextStep({ ...report, quota: unknown }).to.query.tab).toBe('omdb')
})
it('offers a safe next step for undated exhaustion and no action for empty setup', () => {
  expect(retryReadinessNextStep({ ...report, inspected: 0 }).text).toContain('No pending OMDb')
  expect(retryReadinessNextStep({ ...report, quota: { status: 'limit_reached', used: 2, limit: 2, resetAt: null } }).text).toContain('no automatic reset')
  expect(retryReadinessNextStep(report).text).toContain('worker to recheck')
})
