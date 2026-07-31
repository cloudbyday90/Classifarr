/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { computed, ref, unref, watch } from 'vue'
import api from '@/api'
import presetsApi from '@/api/presets'
import {
  mergePolicyBuilderGenreOptions,
  summarizeLibraryProfileGenres,
} from '@/utils/policyBuilderLibraryGenreOptions'
import { buildPolicyBuilderProfileFreshness } from '@/utils/policyBuilderProfileFreshness'
import { buildPolicyBuilderProfileRefreshResult } from '@/utils/policyBuilderProfileRefreshResult'

export const PRESET_MIGRATION_NOTICE_DISMISS_KEY = 'classifarr.presetMigrationNotice.dismissed'

const getBrowserStorage = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage || null
}

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : []
}

export function parsePresetMigrationReport(rawValue, storage = getBrowserStorage()) {
  if (!rawValue) {
    return null
  }

  try {
    const report = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
    const droppedCount = Number.parseInt(report?.dropped_count, 10)

    if (!Number.isFinite(droppedCount) || droppedCount <= 0) {
      return null
    }

    const affectedPolicies = Number.parseInt(report?.affected_policy_count, 10)
    const droppedAttachments = normalizeArray(report?.dropped_attachments)
    const previewNames = droppedAttachments
      .slice(0, 3)
      .map(attachment => attachment?.preset_name || attachment?.preset_key)
      .filter(Boolean)
    const reportVersion = String(
      report?.executed_at ||
      report?.migration ||
      `${droppedCount}:${affectedPolicies || 0}`
    )

    if (storage?.getItem?.(PRESET_MIGRATION_NOTICE_DISMISS_KEY) === reportVersion) {
      return null
    }

    const summaryParts = [
      `${droppedCount} incompatible preset ${droppedCount === 1 ? 'attachment was' : 'attachments were'} removed automatically`,
      Number.isFinite(affectedPolicies) && affectedPolicies > 0
        ? `across ${affectedPolicies} ${affectedPolicies === 1 ? 'policy' : 'policies'}`
        : null,
    ].filter(Boolean)

    return {
      version: reportVersion,
      summary: `${summaryParts.join(' ')}.`,
      preview: previewNames.length > 0
        ? `Affected presets: ${previewNames.join(', ')}${droppedAttachments.length > previewNames.length ? ', ...' : ''}`
        : '',
    }
  } catch (_error) {
    return null
  }
}

export function usePolicyBuilderReferenceData({
  apiClient = api,
  presetsClient = presetsApi,
  storage = getBrowserStorage(),
} = {}) {
  const libraries = ref([])
  const allPresets = ref([])
  const libraryProfile = ref(null)
  const libraryProfileLoading = ref(false)
  const libraryProfileRefreshing = ref(false)
  const libraryProfileError = ref('')
  const libraryProfileRefreshResult = ref(null)
  const presetMigrationNotice = ref(null)

  const collectPresetSignalValues = (signalType, keys) => {
    const values = new Set()

    for (const preset of allPresets.value) {
      const signalConfig = preset?.signals?.[signalType]
      if (!signalConfig || typeof signalConfig !== 'object') {
        continue
      }

      for (const key of keys) {
        const entries = signalConfig[key]
        if (!Array.isArray(entries)) {
          continue
        }

        for (const entry of entries) {
          const normalizedEntry = String(entry || '').trim()
          if (normalizedEntry) {
            values.add(normalizedEntry)
          }
        }
      }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }

  const availableRatings = computed(() => collectPresetSignalValues('certifications', ['include']))
  const presetGenres = computed(() => collectPresetSignalValues('genres', ['prefer', 'exclude', 'require_any']))
  const availableGenreOptions = computed(() => mergePolicyBuilderGenreOptions({
    libraryProfile: libraryProfile.value,
    presetGenres: presetGenres.value,
  }))
  const availableGenres = computed(() => availableGenreOptions.value.map(option => option.value))
  const libraryProfileGenreSummary = computed(() => summarizeLibraryProfileGenres(libraryProfile.value))
  const libraryProfileFreshness = computed(() => buildPolicyBuilderProfileFreshness({
    profile: libraryProfile.value,
    loading: libraryProfileLoading.value,
    refreshing: libraryProfileRefreshing.value,
    error: libraryProfileError.value,
  }))

  const loadLibraries = async () => {
    try {
      libraries.value = await apiClient.getLibraries()
    } catch (error) {
      console.error('Failed to fetch libraries:', error)
    }
  }

  const loadPresets = async () => {
    try {
      allPresets.value = await presetsClient.getPresetReferenceValues()
    } catch (error) {
      console.error('Failed to fetch presets:', error)
    }
  }

  const loadPresetMigrationNotice = async () => {
    try {
      const response = await apiClient.getGeneralSettings()
      presetMigrationNotice.value = parsePresetMigrationReport(
        response?.preset_semantics_v2_auto_drop_report,
        storage
      )
    } catch (error) {
      console.error('Failed to fetch preset migration report:', error)
      presetMigrationNotice.value = null
    }
  }

  const loadInitialData = async () => {
    await Promise.all([
      loadLibraries(),
      loadPresets(),
      loadPresetMigrationNotice(),
    ])
  }

  const loadLibraryContext = async () => {
    await loadLibraries()
  }

  const dismissPresetMigrationNotice = () => {
    if (presetMigrationNotice.value?.version) {
      storage?.setItem?.(
        PRESET_MIGRATION_NOTICE_DISMISS_KEY,
        presetMigrationNotice.value.version
      )
    }

    presetMigrationNotice.value = null
  }

  const loadLibraryProfile = async (libraryId) => {
    libraryProfileRefreshResult.value = null

    if (!libraryId) {
      libraryProfile.value = null
      libraryProfileError.value = ''
      return
    }

    try {
      libraryProfileLoading.value = true
      libraryProfileError.value = ''
      libraryProfile.value = await apiClient.getLibraryProfile(libraryId)
    } catch (error) {
      libraryProfile.value = null

      if (error?.response?.status === 404) {
        libraryProfileError.value = ''
        return
      }

      console.error('Failed to fetch library profile:', error)
      libraryProfileError.value = 'Could not load the current library profile.'
    } finally {
      libraryProfileLoading.value = false
    }
  }

  const refreshLibraryProfile = async (libraryId) => {
    if (!libraryId || libraryProfileRefreshing.value) return false

    try {
      libraryProfileRefreshing.value = true
      libraryProfileError.value = ''
      libraryProfileRefreshResult.value = null
      const response = await apiClient.refreshLibraryProfile(libraryId)
      const refreshedProfile = response?.data?.profile || response?.profile || null

      if (refreshedProfile) {
        libraryProfile.value = refreshedProfile
      } else {
        await loadLibraryProfile(libraryId)
      }

      libraryProfileRefreshResult.value = buildPolicyBuilderProfileRefreshResult({
        outcome: 'success',
        profile: libraryProfile.value,
      })
      return true
    } catch (error) {
      console.error('Failed to refresh library profile:', error)
      const message = error?.response?.data?.message || 'Could not refresh the current library profile.'
      libraryProfileError.value = message
      libraryProfileRefreshResult.value = buildPolicyBuilderProfileRefreshResult({
        outcome: 'error',
        error: message,
      })
      return false
    } finally {
      libraryProfileRefreshing.value = false
    }
  }

  const watchLibraryProfile = (libraryIdSource) => {
    return watch(
      () => unref(libraryIdSource),
      loadLibraryProfile,
      { immediate: true }
    )
  }

  return {
    libraries,
    allPresets,
    libraryProfile,
    libraryProfileLoading,
    libraryProfileRefreshing,
    libraryProfileError,
    libraryProfileRefreshResult,
    presetMigrationNotice,
    availableRatings,
    availableGenres,
    availableGenreOptions,
    libraryProfileGenreSummary,
    libraryProfileFreshness,
    collectPresetSignalValues,
    loadLibraries,
    loadPresets,
    loadLibraryProfile,
    refreshLibraryProfile,
    loadPresetMigrationNotice,
    loadInitialData,
    loadLibraryContext,
    dismissPresetMigrationNotice,
    watchLibraryProfile,
  }
}
