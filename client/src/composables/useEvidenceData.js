/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Phase 6 — Evidence admin: data fetching.
 * SWR for the summary (rarely changes). Manual fetch for the paginated list
 * because filters + page are dynamic.
 */

import { ref, computed } from 'vue'
import { useSWR } from '@/composables/useSWR'
import api from '@/api'
import { CACHE_TTL } from '@/constants/cacheKeys'

const LIMIT = 50

export function useEvidenceData() {
  // ── Summary (SWR, auto-refreshed) ─────────────────────────────────────────

  const {
    data:      summaryData,
    isLoading: summaryLoading,
    error:     summaryError,
    refresh:   refreshSummary
  } = useSWR(
    'evidence:summary',
    () => api.getSummary(),
    { ttl: CACHE_TTL.MEDIUM, initialData: null }
  )

  const summary = computed(() => summaryData.value ?? { byScope: {}, byProvenance: {}, byStatus: {}, total: 0 })

  // ── Paginated list (manual fetch) ──────────────────────────────────────────

  const rows        = ref([])
  const total       = ref(0)
  const page        = ref(0)        // 0-indexed internally
  const listLoading = ref(false)
  const listError   = ref(null)

  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / LIMIT)))

  async function loadList(activeFilters) {
    listLoading.value = true
    listError.value   = null
    try {
      const result = await api.list({
        ...activeFilters,
        limit:  LIMIT,
        offset: page.value * LIMIT
      })
      rows.value  = result?.rows  ?? []
      total.value = result?.total ?? 0
    } catch (err) {
      listError.value = err.message ?? 'Failed to load evidence'
      rows.value      = []
      total.value     = 0
    } finally {
      listLoading.value = false
    }
  }

  function goToPage(n, activeFilters) {
    page.value = Math.max(0, Math.min(n, pageCount.value - 1))
    loadList(activeFilters)
  }

  function resetPage() {
    page.value = 0
  }

  // ── Diagnose (on-demand, cached in a Map) ──────────────────────────────────

  const diagnosisCache  = ref(new Map())
  const diagnosisLoading = ref(false)
  const diagnosisError   = ref(null)

  async function loadDiagnosis(id) {
    if (diagnosisCache.value.has(id)) return diagnosisCache.value.get(id)

    diagnosisLoading.value = true
    diagnosisError.value   = null
    try {
      const data = await api.diagnose(id)
      diagnosisCache.value.set(id, data)
      return data
    } catch (err) {
      diagnosisError.value = err.message ?? 'Failed to load diagnosis'
      return null
    } finally {
      diagnosisLoading.value = false
    }
  }

  function evictDiagnosis(id) {
    diagnosisCache.value.delete(id)
  }

  return {
    // Summary
    summary, summaryLoading, summaryError, refreshSummary,
    // List
    rows, total, page, pageCount, listLoading, listError,
    loadList, goToPage, resetPage,
    // Diagnosis
    loadDiagnosis, diagnosisLoading, diagnosisError, evictDiagnosis,
    LIMIT
  }
}
