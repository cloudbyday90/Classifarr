/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ref, unref } from 'vue'
import api from '@/api'

function getLibraryId(libraryIdSource) {
  const libraryId = Number(unref(libraryIdSource))
  return Number.isSafeInteger(libraryId) && libraryId > 0 ? libraryId : null
}

function getErrorMessage(error, fallbackMessage) {
  const message = error?.response?.data?.message
  return typeof message === 'string' && message.trim()
    ? message.trim()
    : fallbackMessage
}

/**
 * Reads library-profile evidence and isolates the explicitly requested
 * administrative regeneration command from ordinary profile viewing.
 */
export function useLibraryProfileMaintenance({
  libraryId,
  apiClient = api,
} = {}) {
  const profile = ref(null)
  const loading = ref(false)
  const regenerating = ref(false)
  const error = ref('')
  const statusMessage = ref('')

  const loadProfile = async () => {
    const currentLibraryId = getLibraryId(libraryId)
    if (!currentLibraryId) {
      profile.value = null
      error.value = 'A valid library is required to view its profile.'
      statusMessage.value = ''
      return false
    }

    try {
      loading.value = true
      error.value = ''
      profile.value = await apiClient.getLibraryProfile(currentLibraryId)
      return true
    } catch (loadError) {
      profile.value = null

      if (loadError?.response?.status === 404) {
        error.value = ''
        statusMessage.value = 'No profile has been generated yet. Normal profile generation is managed by the server, not this page.'
        return true
      }

      error.value = getErrorMessage(loadError, 'Could not load the current library profile.')
      statusMessage.value = ''
      return false
    } finally {
      loading.value = false
    }
  }

  const regenerateProfile = async () => {
    const currentLibraryId = getLibraryId(libraryId)
    if (!currentLibraryId || regenerating.value) return false

    try {
      regenerating.value = true
      error.value = ''
      statusMessage.value = 'Regenerating the profile from current synced library metadata.'

      await apiClient.regenerateLibraryProfile(currentLibraryId)
      const profileLoaded = await loadProfile()
      if (!profileLoaded || !profile.value) {
        error.value = error.value || 'The profile was regenerated but could not be loaded.'
        statusMessage.value = ''
        return false
      }

      statusMessage.value = 'Profile regenerated from current synced library metadata.'
      return true
    } catch (regenerationError) {
      error.value = getErrorMessage(regenerationError, 'Could not regenerate the current library profile.')
      statusMessage.value = ''
      return false
    } finally {
      regenerating.value = false
    }
  }

  return {
    profile,
    loading,
    regenerating,
    error,
    statusMessage,
    loadProfile,
    regenerateProfile,
  }
}
