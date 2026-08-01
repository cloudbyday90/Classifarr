/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  getLibraryProfile: vi.fn(),
  regenerateLibraryProfile: vi.fn(),
}))

vi.mock('@/api', () => ({ default: api }))

import LibraryProfile from '@/components/library/LibraryProfile.vue'

describe('LibraryProfile.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not regenerate a missing profile while loading the library detail page', async () => {
    api.getLibraryProfile.mockRejectedValue({ response: { status: 404 } })

    const wrapper = mount(LibraryProfile, {
      props: { libraryId: 14 },
    })
    await flushPromises()

    expect(api.getLibraryProfile).toHaveBeenCalledWith(14)
    expect(api.regenerateLibraryProfile).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('No profile yet.')
    expect(wrapper.text()).toContain('managed by the server, not this page')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('provides an explicit accessible administrative regeneration action', async () => {
    const profile = {
      item_count: 10,
      enriched_count: 10,
      last_generated_at: '2026-07-31T12:00:00Z',
      rating_distribution: { PG: 100 },
      genre_distribution: { Animation: 100 },
      studio_distribution: {},
      exclusion_ratings: [],
      exclusion_genres: [],
    }
    api.getLibraryProfile.mockResolvedValue(profile)
    api.regenerateLibraryProfile.mockResolvedValue({ data: { success: true } })

    const wrapper = mount(LibraryProfile, {
      props: { libraryId: 14 },
    })
    await flushPromises()

    const button = wrapper.get('button')
    expect(button.text()).toBe('Regenerate profile')
    expect(button.attributes('aria-describedby')).toBe('library-profile-regeneration-help')

    await button.trigger('click')
    await flushPromises()

    expect(api.regenerateLibraryProfile).toHaveBeenCalledWith(14)
    expect(api.getLibraryProfile).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Profile regenerated from current synced library metadata.')
  })
})
