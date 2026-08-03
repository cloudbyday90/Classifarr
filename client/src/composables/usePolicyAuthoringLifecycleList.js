/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { computed, ref } from 'vue'
import { getPolicyAuthoringLifecycle } from '@/api/policiesApi'
import {
  adaptPolicyAuthoringLifecyclePresentation,
  buildPolicyAuthoringLifecycleLoadingPresentation,
  buildPolicyAuthoringLifecycleUnavailablePresentation,
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS,
} from '@/utils/policyAuthoringLifecyclePresentation'

const DEFAULT_CONCURRENCY = 4

function normalizePositiveInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function normalizeConcurrency(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : DEFAULT_CONCURRENCY
}

function normalizeLibraries(value) {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  return value.filter(library => {
    const libraryId = normalizePositiveInteger(library?.id)
    if (!libraryId || seen.has(libraryId)) return false
    seen.add(libraryId)
    return true
  })
}

async function mapWithConcurrency(items, concurrency, mapItem) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapItem(items[index])
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  ))

  return results
}

export function usePolicyAuthoringLifecycleList({
  loadLifecycleRequest = getPolicyAuthoringLifecycle,
  concurrency = DEFAULT_CONCURRENCY,
} = {}) {
  const entries = ref([])
  const loading = ref(false)
  let activeRequestId = 0

  const hasUnavailableEntries = computed(() => entries.value.some(entry => (
    entry.statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.UNAVAILABLE
  )))

  const clear = () => {
    activeRequestId += 1
    entries.value = []
    loading.value = false
  }

  const load = async (libraries) => {
    const normalizedLibraries = normalizeLibraries(libraries)
    const requestId = activeRequestId + 1
    activeRequestId = requestId
    entries.value = normalizedLibraries.map(buildPolicyAuthoringLifecycleLoadingPresentation)
    loading.value = normalizedLibraries.length > 0

    if (normalizedLibraries.length === 0) return true

    const request = typeof loadLifecycleRequest === 'function'
      ? loadLifecycleRequest
      : null
    const results = await mapWithConcurrency(
      normalizedLibraries,
      normalizeConcurrency(concurrency),
      async library => {
        if (!request) return buildPolicyAuthoringLifecycleUnavailablePresentation(library)

        try {
          const lifecycle = await request(library.id)
          return adaptPolicyAuthoringLifecyclePresentation({
            lifecycle,
            expectedLibrary: library,
          }).presentation
        } catch {
          return buildPolicyAuthoringLifecycleUnavailablePresentation(library)
        }
      }
    )

    if (requestId !== activeRequestId) return false

    entries.value = results
    loading.value = false
    return !results.some(entry => (
      entry.statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.UNAVAILABLE
    ))
  }

  return {
    entries,
    loading,
    hasUnavailableEntries,
    clear,
    load,
  }
}
