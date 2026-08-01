/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useLibraryProfileMaintenance } from '@/composables/useLibraryProfileMaintenance'

function createApiClient(overrides = {}) {
  return {
    getLibraryProfile: vi.fn(),
    regenerateLibraryProfile: vi.fn(),
    ...overrides,
  }
}

describe('useLibraryProfileMaintenance', () => {
  it('treats a missing profile as server-managed state without triggering regeneration', async () => {
    const apiClient = createApiClient({
      getLibraryProfile: vi.fn().mockRejectedValue({
        response: { status: 404 },
      }),
    })
    const maintenance = useLibraryProfileMaintenance({
      libraryId: ref(14),
      apiClient,
    })

    await expect(maintenance.loadProfile()).resolves.toBe(true)

    expect(maintenance.profile.value).toBeNull()
    expect(maintenance.error.value).toBe('')
    expect(maintenance.statusMessage.value).toContain('managed by the server')
    expect(apiClient.regenerateLibraryProfile).not.toHaveBeenCalled()
  })

  it('regenerates only after an explicit maintenance request and rereads the stored profile', async () => {
    const storedProfile = {
      id: 6,
      library_id: 14,
      genre_distribution: { Animation: 42 },
    }
    const apiClient = createApiClient({
      regenerateLibraryProfile: vi.fn().mockResolvedValue({ data: { success: true } }),
      getLibraryProfile: vi.fn().mockResolvedValue(storedProfile),
    })
    const maintenance = useLibraryProfileMaintenance({
      libraryId: ref(14),
      apiClient,
    })

    await expect(maintenance.regenerateProfile()).resolves.toBe(true)

    expect(apiClient.regenerateLibraryProfile).toHaveBeenCalledWith(14)
    expect(apiClient.getLibraryProfile).toHaveBeenCalledWith(14)
    expect(maintenance.profile.value).toEqual(storedProfile)
    expect(maintenance.statusMessage.value).toContain('Profile regenerated')
    expect(maintenance.error.value).toBe('')
  })

  it('surfaces a bounded maintenance error without clearing an existing profile', async () => {
    const apiClient = createApiClient({
      regenerateLibraryProfile: vi.fn().mockRejectedValue({
        response: { data: { message: 'Library has no synced items' } },
      }),
    })
    const maintenance = useLibraryProfileMaintenance({
      libraryId: ref(14),
      apiClient,
    })
    maintenance.profile.value = { id: 6, library_id: 14 }

    await expect(maintenance.regenerateProfile()).resolves.toBe(false)

    expect(maintenance.profile.value).toEqual({ id: 6, library_id: 14 })
    expect(maintenance.error.value).toBe('Library has no synced items')
    expect(maintenance.statusMessage.value).toBe('')
  })
})
