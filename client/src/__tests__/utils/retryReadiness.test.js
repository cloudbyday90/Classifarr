/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, it, expect } from 'vitest'
import { parseRetryReadiness, retryReadinessNextStep } from '@/utils/retryReadiness'

const report = { version: 1, scope: 'web_search', limitPerQueue: 50, observedAt: '2026-09-29T20:00:00Z',
  inspected: 0, hasMore: false, earliestRetryAt: null,
  counts: { cached_ready: 0, provider_ready: 0, provider_wait: 0, settings_blocked: 0, scheduled: 0, held: 0 } }
describe('retry readiness contract', () => {
  it('allowlists public fields and keeps a real empty observation distinct from missing data', () => {
    expect(parseRetryReadiness({ ...report, private: 'secret' })).toEqual(report)
    expect(parseRetryReadiness(null)).toBeNull()
    expect(retryReadinessNextStep(report).text).toContain('No action needed')
  })
  it.each([
    { version: 2 }, { scope: 'all' }, { limitPerQueue: 500 }, { hasMore: 1 },
    { observedAt: 'bad' }, { inspected: -1 }, { inspected: 101 }, { inspected: 1 },
    { earliestRetryAt: 'bad' }, { counts: {} }, { counts: { ...report.counts, held: '0' } },
  ])('rejects invalid or misleading counts %j', change => {
    expect(parseRetryReadiness({ ...report, ...change })).toBeNull()
  })
  it('prioritizes settings or safeguards over ready work without granting a retry action', () => {
    const withCounts = counts => ({ ...report, inspected: 2, counts: { ...report.counts, ...counts } })
    expect(retryReadinessNextStep(withCounts({ settings_blocked: 1, provider_ready: 1 })).to.query.tab).toBe('web-search')
    expect(retryReadinessNextStep(withCounts({ held: 1, cached_ready: 1 })).to).toBe('/libraries')
    expect(retryReadinessNextStep(withCounts({ cached_ready: 2 })).text).toContain('worker to recheck')
    expect(retryReadinessNextStep(withCounts({ scheduled: 2 })).text).toContain('Waiting')
  })
})
