/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, it, expect } from 'vitest'
import { parseSourceIdentityIssues, sourceIssueNextStep } from '@/utils/sourceIdentityIssues'
import { sourceIssue, sourceIssuePage } from '../fixtures/sourceIdentityIssues'

describe('source issue contract', () => {
  it('accepts complete, paginated, and empty current snapshots', () => {
    for (const [offset, total] of [[0, 0], [0, 51], [50, 51], [100, 2]]) {
      const report = sourceIssuePage(offset, total)
      expect(parseSourceIdentityIssues(report, offset)).toBe(report)
    }
  })
  it.each([
    { version: 'wrong' }, { asOf: null }, { offset: 1 }, { pageSize: 100 }, { total: -1 },
    { coveredLibraryCount: 3 }, { activeLibraryCount: null }, { recovery: {} },
    { recovery: { retry_wait: 0, retry_due: 0, source_review: 0, not_recorded: 2 } }, { items: [] },
  ])('rejects contradictory snapshots %j', patch => {
    expect(parseSourceIdentityIssues({ ...sourceIssuePage(), ...patch }, 0)).toBeNull()
  })
  it.each([
    { key: 'bad' }, { libraryId: 0 }, { title: {} }, { year: -1 }, { mediaType: 'music' },
    { issue: 'toString' }, { recoveryState: 'toString' }, { lastSeenAt: '' },
    { retryAfter: '' }, { recoveryState: 'retry_wait' },
  ])('rejects invalid item fields %j', patch => {
    expect(parseSourceIdentityIssues({ ...sourceIssuePage(), items: [sourceIssue(1, patch)] }, 0)).toBeNull()
  })
  it('rejects duplicate keys', () => {
    expect(parseSourceIdentityIssues({ ...sourceIssuePage(0, 2), items: [sourceIssue(), sourceIssue()] }, 0)).toBeNull()
  })
  it('rejects contradictory retry states or page breakdowns', () => {
    const report = sourceIssuePage()
    report.items[0].recoveryState = 'source_review'
    expect(parseSourceIdentityIssues(report, 0)).toBeNull()
    report.items[0].recoveryState = 'retry_wait'
    report.items[0].retryAfter = '2026-09-27T12:00:00Z'
    expect(parseSourceIdentityIssues(report, 0)).toBeNull()
    report.recovery = { retry_wait: 1, retry_due: 0, source_review: 0, not_recorded: 0 }
    expect(parseSourceIdentityIssues(report, 0)).toBe(report)
    report.items[0].retryAfter = '2026-09-25T12:00:00Z'
    expect(parseSourceIdentityIssues(report, 0)).toBeNull()
    report.items[0].recoveryState = 'retry_due'
    report.recovery = { retry_wait: 0, retry_due: 1, source_review: 0, not_recorded: 0 }
    expect(parseSourceIdentityIssues(report, 0)).toBe(report)
    report.items[0].issue = 'invalid_provider_ids'
    report.items[0].recoveryState = 'source_review'
    report.recovery = { retry_wait: 0, retry_due: 0, source_review: 1, not_recorded: 0 }
    expect(parseSourceIdentityIssues(report, 0)).toBe(report)
  })
  it('gives recovery-aware instructions without selecting an identity', () => {
    expect(sourceIssueNextStep(sourceIssue(1, { recoveryState: 'retry_wait' }))).toContain('No action needed yet')
    expect(sourceIssueNextStep(sourceIssue(1, { recoveryState: 'retry_due' }))).toContain('not confirmed running')
    expect(sourceIssueNextStep(sourceIssue(1, { issue: 'invalid_media_type' }))).toContain('not music')
    expect(sourceIssueNextStep(sourceIssue())).toContain('Check its match and year')
  })
})
