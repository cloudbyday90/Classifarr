/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const getLibraryEvidenceCoverage = vi.fn()
vi.mock('@/api', () => ({ default: { getLibraryEvidenceCoverage: (...args) => getLibraryEvidenceCoverage(...args) } }))

import LibraryEvidenceCoverage from '@/components/library/LibraryEvidenceCoverage.vue'

const report = {
  version: 'library.evidence_coverage.v2', libraryId: 7,
  asOf: '2026-09-24T12:00:00.000Z', inventoryRevision: '8', mediaType: 'movie',
  statusId: 'measured', classificationQuality: 'not_measured',
  source: { itemCount: 4, candidateRowCount: 3,
    excluded: { typeMismatch: 0, missingIdentity: 1, sourceConflict: 0 } },
  sourceEvidence: { statusId: 'measured', typeMatchedItemCount: 4,
    anchoredItemCount: 4, conflictBlockedItemCount: 0, eligibleItemCount: 4,
    describedItemCount: 2, missingDescriptionItemCount: 2,
    describedWithoutTmdbItemCount: 1, alternateProviderObservedItemCount: 1 },
  description: { candidateIdentityCount: 2, usableIdentityCount: 1,
    missingIdentityCount: 1, conflictingIdentityCount: 0, uniqueDescriptionCount: 1 },
  retrieval: { statusId: 'model_unverified', eligibleIdentityCount: 1,
    indexedIdentityCount: null, retryDeferredIdentityCount: null, retryDueIdentityCount: null },
}

beforeEach(() => { getLibraryEvidenceCoverage.mockReset() })

describe('LibraryEvidenceCoverage', () => {
  it('loads read-only evidence and keeps unverified cache status explicit', async () => {
    getLibraryEvidenceCoverage.mockResolvedValue(report)
    const wrapper = mount(LibraryEvidenceCoverage, { props: { libraryId: 7 },
      global: { stubs: { RouterLink: true } },
    })
    await flushPromises()
    expect(getLibraryEvidenceCoverage).toHaveBeenCalledWith(7)
    expect(wrapper.text()).toContain('1 of 2 eligible movie/TV identities')
    expect(wrapper.text()).toContain('current cache coverage is unknown')
    expect(wrapper.text()).toContain('1 described source item has no TMDB ID')
    expect(wrapper.text()).toContain('Classification quality remains unmeasured')
    expect(wrapper.text()).not.toContain('Private')
  })

  it('hides the administrator diagnostic after a denied request', async () => {
    getLibraryEvidenceCoverage.mockRejectedValue({ response: { status: 403 } })
    const wrapper = mount(LibraryEvidenceCoverage, { props: { libraryId: 7 } })
    await flushPromises()
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
