/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { libraryOverlapFixture } from '../fixtures/libraryOverlapFixture'
import { normalizeLibraryCommonTraitEvidence } from '@/utils/libraryCommonTraitEvidencePresentation'

describe('libraryCommonTraitEvidencePresentation', () => {
  it('keeps only the bounded documented observation projection', () => {
    const value = libraryOverlapFixture().commonTraitEvidence
    value.groups[0].traits[1].entries[0].libraryIds = [1, 2]
    const normalized = normalizeLibraryCommonTraitEvidence(value)

    expect(normalized.groups[0].traits.find((trait) => trait.field === 'genres').entries)
      .toEqual([{ value: 'Action', observedLibraryCount: 2, matchingIdentityObservationCount: 2 }])
    expect(JSON.stringify(normalized)).not.toContain('libraryIds')
  })

  it('admits fixed administrator policy-purpose totals only when explicitly included', () => {
    const value = libraryOverlapFixture().commonTraitEvidence
    value.policyPurposeProvenanceIncluded = true
    value.groups[0].traits[1].entries[0].policyPurpose = {
      noActiveValidatedPolicyLibraryCount: 0,
      profileOnlySpecializedPurposeLibraryCount: 1,
      noRetainedDeclaredPurposeLibraryCount: 0,
      retainedDeclaredPurposeLibraryCount: 1,
      privateRule: 'not projected',
    }
    const normalized = normalizeLibraryCommonTraitEvidence(value)

    expect(normalized.groups[0].traits[1].entries[0].policyPurpose)
      .toMatchObject({ profileOnlySpecializedPurposeLibraryCount: 1, retainedDeclaredPurposeLibraryCount: 1 })
    expect(JSON.stringify(normalized)).not.toContain('privateRule')
  })

  it('rejects malformed, inconsistent, or unbounded data before disclosure', () => {
    const oversized = libraryOverlapFixture().commonTraitEvidence
    oversized.groups[0].traits[1].entries[0].value = 'x'.repeat(161)
    expect(normalizeLibraryCommonTraitEvidence(oversized)).toBeNull()

    const inconsistent = libraryOverlapFixture().commonTraitEvidence
    inconsistent.groups[0].traits[1].knownLibraryCount = 1
    expect(normalizeLibraryCommonTraitEvidence(inconsistent)).toBeNull()

    const invalidProvenance = libraryOverlapFixture().commonTraitEvidence
    invalidProvenance.policyPurposeProvenanceIncluded = true
    invalidProvenance.groups[0].traits[1].entries[0].policyPurpose = {
      noActiveValidatedPolicyLibraryCount: 1,
      profileOnlySpecializedPurposeLibraryCount: 1,
      noRetainedDeclaredPurposeLibraryCount: 1,
      retainedDeclaredPurposeLibraryCount: 1,
    }
    expect(normalizeLibraryCommonTraitEvidence(invalidProvenance)).toBeNull()
  })
})
