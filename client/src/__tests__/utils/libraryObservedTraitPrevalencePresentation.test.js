/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { libraryOverlapFixture } from '../fixtures/libraryOverlapFixture'
import { normalizeLibraryObservedTraitPrevalence } from '@/utils/libraryObservedTraitPrevalencePresentation'

describe('libraryObservedTraitPrevalencePresentation', () => {
  it('keeps only the bounded documented projection', () => {
    const value = libraryOverlapFixture().observedTraitPrevalence
    value.libraries[0].cohorts[0].traits[1].privateCatalogTitle = 'not projected'
    const normalized = normalizeLibraryObservedTraitPrevalence(value)

    expect(normalized.version).toBe('library.observed_trait_prevalence.v1')
    expect(normalized.libraries[0].cohorts[0].traits.find((trait) => trait.field === 'genres'))
      .toMatchObject({ entries: [expect.objectContaining({ value: 'Action' })] })
    expect(JSON.stringify(normalized)).not.toContain('privateCatalogTitle')
  })

  it('rejects malformed or unbounded server data before it reaches the disclosure', () => {
    const malformed = libraryOverlapFixture().observedTraitPrevalence
    malformed.libraries[0].cohorts[0].traits[1].entries[0].value = 'x'.repeat(161)
    expect(normalizeLibraryObservedTraitPrevalence(malformed)).toBeNull()
  })

  it('rejects inconsistent scope, counts, and field shapes', () => {
    const inconsistentScope = libraryOverlapFixture().observedTraitPrevalence
    inconsistentScope.scopeStatus = 'partial_active_library_scope'
    expect(normalizeLibraryObservedTraitPrevalence(inconsistentScope)).toBeNull()

    const inconsistentCounts = libraryOverlapFixture().observedTraitPrevalence
    inconsistentCounts.libraries[0].cohorts[0].traits[1].localConflictingIdentityCount = 2
    expect(normalizeLibraryObservedTraitPrevalence(inconsistentCounts)).toBeNull()

    const malformedField = libraryOverlapFixture().observedTraitPrevalence
    malformedField.libraries[0].cohorts[0].traits[1].truncated = 'false'
    expect(normalizeLibraryObservedTraitPrevalence(malformedField)).toBeNull()
  })
})
