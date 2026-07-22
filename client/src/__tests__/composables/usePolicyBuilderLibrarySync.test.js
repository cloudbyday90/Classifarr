/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it, vi } from 'vitest'
import { usePolicyBuilderLibrarySync } from '@/composables/usePolicyBuilderLibrarySync'

describe('usePolicyBuilderLibrarySync', () => {
  it('runs a full library sync before generating its profile', async () => {
    const syncLibraryRequest = vi.fn().mockResolvedValue({ data: { success: true } })
    const refreshProfile = vi.fn().mockResolvedValue(true)
    const { syncing, result, syncAndRefreshProfile } = usePolicyBuilderLibrarySync({
      syncLibraryRequest,
      refreshProfile,
    })

    await expect(syncAndRefreshProfile(6)).resolves.toBe(true)

    expect(syncLibraryRequest).toHaveBeenCalledWith(6, {
      incremental: false,
      batchSize: 100,
    })
    expect(refreshProfile).toHaveBeenCalledWith(6)
    expect(syncing.value).toBe(false)
    expect(result.value).toEqual({ status: 'success' })
  })

  it('does not generate a profile when the library sync fails', async () => {
    const syncLibraryRequest = vi.fn().mockRejectedValue(new Error('unavailable'))
    const refreshProfile = vi.fn()
    const { result, syncAndRefreshProfile } = usePolicyBuilderLibrarySync({
      syncLibraryRequest,
      refreshProfile,
    })

    await expect(syncAndRefreshProfile(6)).resolves.toBe(false)

    expect(refreshProfile).not.toHaveBeenCalled()
    expect(result.value).toEqual({ status: 'sync_failed' })
  })
})
