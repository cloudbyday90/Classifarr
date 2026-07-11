/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Evidence administration: reactive filter state.
 */

import { reactive, computed } from 'vue'

export const VALID_SCOPES      = ['item_exact', 'genre', 'studio', 'franchise', 'certification']
export const VALID_PROVENANCES = ['human_confirmed', 'policy_confirmed', 'mined']
export const VALID_STATUSES    = ['active', 'candidate']

export function useEvidenceFilters() {
  const filters = reactive({
    scope:      '',
    provenance: '',
    status:     '',
    libraryId:  '',
    mediaType:  ''
  })

  /** Only the non-empty values — passed directly to api.list() */
  const activeFilters = computed(() => {
    const f = {}
    if (filters.scope)      f.scope      = filters.scope
    if (filters.provenance) f.provenance = filters.provenance
    if (filters.status)     f.status     = filters.status
    if (filters.libraryId)  f.libraryId  = filters.libraryId
    if (filters.mediaType)  f.mediaType  = filters.mediaType
    return f
  })

  /** True when at least one filter is active (used to gate the purge button) */
  const hasActiveFilters = computed(() => Object.keys(activeFilters.value).length > 0)

  function resetFilters() {
    filters.scope      = ''
    filters.provenance = ''
    filters.status     = ''
    filters.libraryId  = ''
    filters.mediaType  = ''
  }

  return { filters, activeFilters, hasActiveFilters, resetFilters }
}
