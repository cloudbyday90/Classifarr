/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { parseLibraryUpgradeReadiness } from '@/utils/libraryUpgradeReadiness'

const report = {
  version: 'library.upgrade_readiness.v1', asOf: '2026-09-23T12:00:00.000Z',
  libraryCount: 2, activeLibraryCount: 1, mediaTypes: { movie: 1, tv: 1, other: 0 },
  profile: { current: 1, queued: 0, processing: 0, retryWait: 0, cooldown: 0,
    waiting: 0, paused: 1, unverified: 0, noInventory: 0, missing: 0 },
  upgradeEnrollmentRecorded: true,
  recovery: { plannerOverdue: 0, workerOverdue: 0, leaseRecoveryOverdue: 0, graceMinutes: 15 },
  sourceIdentity: { completeCaptureLibraryCount: 1, unresolvedItemCount: 2,
    conflictingProviderItemCount: 2, invalidProviderItemCount: 0, invalidMediaTypeItemCount: 0,
    scope: 'active_complete_full_captures_last_30_days' },
}

describe('upgrade readiness contract', () => {
  it('accepts a complete, count-only report', () => {
    expect(parseLibraryUpgradeReadiness(report)?.profile.paused).toBe(1)
    expect(parseLibraryUpgradeReadiness({ ...report, sourceIdentity: {
      ...report.sourceIdentity, title: 'private source title',
    } }).sourceIdentity).not.toHaveProperty('title')
  })
  it('rejects inconsistent or unbounded counts', () => {
    expect(parseLibraryUpgradeReadiness({ ...report, libraryCount: 3 })).toBeNull()
    expect(parseLibraryUpgradeReadiness({ ...report, profile: { ...report.profile, paused: -1 } })).toBeNull()
    expect(parseLibraryUpgradeReadiness({ ...report, recovery: { ...report.recovery,
      workerOverdue: 2 } })).toBeNull()
    expect(parseLibraryUpgradeReadiness({ ...report, sourceIdentity: {
      ...report.sourceIdentity, completeCaptureLibraryCount: 2,
    } })).toBeNull()
    expect(parseLibraryUpgradeReadiness({ ...report, sourceIdentity: {
      ...report.sourceIdentity, unresolvedItemCount: 3,
    } })).toBeNull()
  })
})
