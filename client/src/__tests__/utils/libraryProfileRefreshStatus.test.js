/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { parseLibraryProfileRefreshStatus } from '@/utils/libraryProfileRefreshStatus'

const row = (overrides = {}) => ({
  libraryId: 7, name: 'Movies', isActive: true, statusId: 'current',
  sourceRevision: '9007199254740993', acknowledgedRevision: '9007199254740993',
  profileRevision: '9007199254740993', retryAt: null, ...overrides,
})
const report = (overrides = {}) => ({
  version: 'library.profile_refresh_status.v1', asOf: '2026-09-23T12:00:00.000Z',
  windowTruncated: false, libraries: [row()], ...overrides,
})

describe('library profile refresh status contract', () => {
  it('keeps exact revisions out of display data and derives counts from validated rows', () => {
    const parsed = parseLibraryProfileRefreshStatus(report({ libraries: [row(), row({
      libraryId: 8, name: 'TV', statusId: 'cooldown',
    })] }))
    expect(parsed.summary).toMatchObject({ current: 1, cooldown: 1 })
    expect(parsed.libraries[0]).toEqual({ libraryId: 7, name: 'Movies', isActive: true,
      statusId: 'current', recoveryReasonId: null })
    expect(JSON.stringify(parsed)).not.toContain('9007199254740993')
  })

  it('rejects unknown status, imprecise revisions, and an unbounded response', () => {
    expect(parseLibraryProfileRefreshStatus(report({ libraries: [row({ statusId: 'automatically_routed' })] }))).toBeNull()
    expect(parseLibraryProfileRefreshStatus(report({ libraries: [row({ sourceRevision: Number.MAX_SAFE_INTEGER + 2 })] }))).toBeNull()
    expect(parseLibraryProfileRefreshStatus(report({ libraries: Array.from({ length: 201 }, (_, index) =>
      row({ libraryId: index + 1 })) }))).toBeNull()
    expect(parseLibraryProfileRefreshStatus(report({ asOf: 0 }))).toBeNull()
  })

  it('accepts only bounded recovery reasons without exposing extra fields', () => {
    const parsed = parseLibraryProfileRefreshStatus(report({ libraries: [row({
      statusId: 'waiting', recoveryReasonId: 'planner_overdue', token: 'secret fixture',
    })] }))
    expect(parsed.libraries[0].recoveryReasonId).toBe('planner_overdue')
    expect(JSON.stringify(parsed)).not.toContain('secret fixture')
    expect(parseLibraryProfileRefreshStatus(report({ libraries: [row({
      recoveryReasonId: 'arbitrary',
    })] }))).toBeNull()
  })
})
