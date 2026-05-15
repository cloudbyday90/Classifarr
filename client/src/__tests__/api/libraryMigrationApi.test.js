import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

import {
  getLibraryMigrationRules,
  getMigrationStatus,
  getMigrationLibraries,
  migrateAllLibraryRules,
  analyzeMigrationRule,
  migrateRule,
} from '../../api/libraryMigrationApi'

describe('libraryMigrationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getLibraryMigrationRules calls getDataRequest with library id in URL', async () => {
    const rules = [{ id: 'mr1', source: 'old', target: 'new' }]
    mockGetDataRequest.mockResolvedValueOnce(rules)
    const result = await getLibraryMigrationRules(5)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/migration/libraries/5/rules')
    expect(result).toEqual(rules)
  })

  it('getMigrationStatus calls getDataRequest with /migration/status', async () => {
    const status = { running: false, lastRun: '2026-01-01' }
    mockGetDataRequest.mockResolvedValueOnce(status)
    const result = await getMigrationStatus()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/migration/status')
    expect(result).toEqual(status)
  })

  it('getMigrationLibraries calls getDataRequest with /migration/libraries', async () => {
    const libraries = [{ id: 1, name: 'Movies' }]
    mockGetDataRequest.mockResolvedValueOnce(libraries)
    const result = await getMigrationLibraries()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/migration/libraries')
    expect(result).toEqual(libraries)
  })

  it('migrateAllLibraryRules calls POST with library id in URL and data', async () => {
    const data = { dryRun: true, overwrite: false }
    mockPost.mockResolvedValueOnce({ data: { migrated: 10 } })
    const result = await migrateAllLibraryRules(5, data)
    expect(mockPost).toHaveBeenCalledWith('/migration/libraries/5/migrate-all', data)
    expect(result).toEqual({ data: { migrated: 10 } })
  })

  it('analyzeMigrationRule calls getDataRequest with rule id in URL', async () => {
    const analysis = { compatible: true, conflicts: [] }
    mockGetDataRequest.mockResolvedValueOnce(analysis)
    const result = await analyzeMigrationRule('mr1')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/migration/rules/mr1/analyze')
    expect(result).toEqual(analysis)
  })

  it('migrateRule calls POST with rule id in URL and data', async () => {
    const data = { targetPolicy: 'policy-2' }
    mockPost.mockResolvedValueOnce({ data: { migrated: true } })
    const result = await migrateRule('mr1', data)
    expect(mockPost).toHaveBeenCalledWith('/migration/rules/mr1/migrate', data)
    expect(result).toEqual({ data: { migrated: true } })
  })
})
