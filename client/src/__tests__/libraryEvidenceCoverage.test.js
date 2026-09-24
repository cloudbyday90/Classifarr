/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { parseLibraryEvidenceCoverage } from '@/utils/libraryEvidenceCoverage'

const report = {
  version: 'library.evidence_coverage.v1', libraryId: 7,
  asOf: '2026-09-24T12:00:00.000Z', inventoryRevision: '8', mediaType: 'movie',
  statusId: 'measured', classificationQuality: 'not_measured',
  source: { itemCount: 4, candidateRowCount: 3,
    excluded: { typeMismatch: 0, missingIdentity: 1, sourceConflict: 0 } },
  description: { candidateIdentityCount: 2, usableIdentityCount: 1,
    missingIdentityCount: 1, conflictingIdentityCount: 0, uniqueDescriptionCount: 1 },
  retrieval: { statusId: 'recently_verified', eligibleIdentityCount: 1,
    indexedIdentityCount: 0, retryDeferredIdentityCount: 1, retryDueIdentityCount: 0 },
}

describe('library evidence coverage contract', () => {
  it('retains only bounded counts, not private extras', () => {
    const parsed = parseLibraryEvidenceCoverage({ ...report, privateDescription: 'secret' }, 7)
    expect(parsed).toMatchObject({ statusId: 'measured', description: { usableIdentityCount: 1 } })
    expect(parsed).not.toHaveProperty('privateDescription')
    expect(parseLibraryEvidenceCoverage(report, 8)).toBeNull()
  })
  it('rejects inconsistent denominators and made-up quality', () => {
    expect(parseLibraryEvidenceCoverage({ ...report, source: {
      ...report.source, candidateRowCount: 4 } })).toBeNull()
    expect(parseLibraryEvidenceCoverage({ ...report, classificationQuality: 'accurate' })).toBeNull()
    expect(parseLibraryEvidenceCoverage({ ...report, retrieval: {
      ...report.retrieval, indexedIdentityCount: 2 } })).toBeNull()
  })
  it('does not invent cache coverage when the model is unverified', () => {
    const unknown = { ...report, retrieval: { statusId: 'model_unverified',
      eligibleIdentityCount: 1, indexedIdentityCount: null,
      retryDeferredIdentityCount: null, retryDueIdentityCount: null } }
    expect(parseLibraryEvidenceCoverage(unknown)?.retrieval.indexedIdentityCount).toBeNull()
    expect(parseLibraryEvidenceCoverage({ ...unknown, retrieval: {
      ...unknown.retrieval, indexedIdentityCount: 0 } })).toBeNull()
  })
  it('rejects inconsistent no-inventory and truncated states', () => {
    const noInventory = { ...report, statusId: 'no_inventory',
      source: { itemCount: 0, candidateRowCount: 0,
        excluded: { typeMismatch: 0, missingIdentity: 0, sourceConflict: 0 } },
      description: null, retrieval: null }
    expect(parseLibraryEvidenceCoverage(noInventory)).not.toBeNull()
    expect(parseLibraryEvidenceCoverage({ ...noInventory, source: {
      ...noInventory.source, itemCount: 1 } })).toBeNull()
    const truncated = { ...noInventory, statusId: 'window_truncated',
      source: { ...noInventory.source, itemCount: 10001, candidateRowCount: 10001 } }
    expect(parseLibraryEvidenceCoverage(truncated)).not.toBeNull()
    expect(parseLibraryEvidenceCoverage({ ...truncated, source: {
      ...truncated.source, candidateRowCount: 9999 } })).toBeNull()
  })
})
