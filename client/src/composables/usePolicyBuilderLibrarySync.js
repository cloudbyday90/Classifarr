/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ref } from 'vue'
import { syncLibrary } from '@/api/libraryCatalogApi'

function normalizeLibraryId(value) {
  const libraryId = Number(value)
  return Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null
}

export function usePolicyBuilderLibrarySync({
  syncLibraryRequest = syncLibrary,
  refreshProfile,
} = {}) {
  const syncing = ref(false)
  const result = ref(null)

  const syncAndRefreshProfile = async (libraryIdValue) => {
    const libraryId = normalizeLibraryId(libraryIdValue)
    if (libraryId === null || syncing.value || typeof refreshProfile !== 'function') {
      return false
    }

    syncing.value = true
    result.value = null

    try {
      await syncLibraryRequest(libraryId, {
        incremental: false,
        batchSize: 100,
      })

      const profileRefreshed = await refreshProfile(libraryId)
      result.value = profileRefreshed
        ? { status: 'success' }
        : { status: 'profile_refresh_failed' }
      return profileRefreshed
    } catch {
      result.value = { status: 'sync_failed' }
      return false
    } finally {
      syncing.value = false
    }
  }

  return {
    syncing,
    result,
    syncAndRefreshProfile,
  }
}
