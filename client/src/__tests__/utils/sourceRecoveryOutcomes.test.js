/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { it, expect } from 'vitest'
import { recoveryOutcomeLabel, validRecoveryOutcome } from '@/utils/sourceRecoveryOutcomes'
import { parseSourceIdentityIssues, sourceIssueNextStep } from '@/utils/sourceIdentityIssues'
import { sourceIssuePage } from '../fixtures/sourceIdentityIssues'

const now = '2026-09-26T12:00:00Z'
const outcome = { reason: 'provider_unavailable', attemptedAt: '2026-09-26T11:00:00Z', completedAt: now }
it('accepts legacy, unfinished, preflight, and completed outcome evidence', () => {
  for (const value of [undefined, null, outcome, { ...outcome, attemptedAt: null },
    { ...outcome, reason: null, completedAt: null }]) expect(validRecoveryOutcome(value, now)).toBe(true)
  expect(recoveryOutcomeLabel(null)).toContain('No recovery result')
  expect(recoveryOutcomeLabel({ reason: null })).toContain('completion is not confirmed')
  expect(recoveryOutcomeLabel(outcome)).toBe('Metadata provider request failed')
})
it.each([
  { reason: 'toString' }, { attemptedAt: 'bad' }, { completedAt: null }, { reason: null },
  { completedAt: '2026-09-26T10:00:00Z' }, { completedAt: '2026-09-27T12:00:00Z' }, { token: 'private' },
])('rejects malformed or contradictory evidence %j', patch => {
  expect(validRecoveryOutcome({ ...outcome, ...patch }, now)).toBe(false)
})
it('requires source-review categorization for recorded disagreements even during cooldown', () => {
  const report = sourceIssuePage()
  Object.assign(report.items[0], { lastRecovery: { ...outcome, reason: 'title_year_mismatch' },
    retryAfter: '2026-09-27T12:00:00Z', recoveryState: 'source_review' })
  report.recovery = { retry_wait: 0, retry_due: 0, source_review: 1, not_recorded: 0 }
  expect(parseSourceIdentityIssues(report, 0)).toBe(report)
  expect(sourceIssueNextStep(report.items[0])).toContain('No conflicting ID was selected')
  report.items[0].recoveryState = 'retry_wait'
  expect(parseSourceIdentityIssues(report, 0)).toBeNull()
})
it.each(['internal_error', 'persistence_failed'])('directs local %s to service health, not Plex matching', reason => {
  expect(sourceIssueNextStep({ lastRecovery: { reason } })).toContain('service health and logs')
})
