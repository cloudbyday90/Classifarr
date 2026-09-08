/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

export const DEFAULT_VISIBLE_PAGE_REFRESH_INTERVAL_MS = 2 * 60 * 1000
const AUTO_REFRESH_DEDUPLICATION_MS = 2 * 1000

function isVisibleDocument() {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

function normalizeRefreshInterval(value) {
  const interval = Number(value)
  return Number.isSafeInteger(interval) && interval >= 1_000
    ? interval
    : DEFAULT_VISIBLE_PAGE_REFRESH_INTERVAL_MS
}

/**
 * Owns a bounded, visible-page-only read refresh. Consumers provide the
 * read-only operation; this lifecycle never grants write or workflow authority.
 *
 * @param {{
 *   refresh: () => Promise<unknown>,
 *   autoRefreshEnabled?: import('vue').Ref<boolean>,
 *   refreshIntervalMs?: number,
 *   refreshOnMounted?: boolean,
 *   refreshOnWindowFocus?: boolean,
 * }} options
 */
export function useBoundedVisiblePageRefresh({
  refresh,
  autoRefreshEnabled = ref(true),
  refreshIntervalMs = DEFAULT_VISIBLE_PAGE_REFRESH_INTERVAL_MS,
  refreshOnMounted = true,
  refreshOnWindowFocus = true,
} = {}) {
  if (typeof refresh !== 'function') {
    throw new TypeError('Visible-page refresh requires a refresh function.')
  }

  const activeRefreshCount = ref(0)
  const isRefreshing = computed(() => activeRefreshCount.value > 0)
  const lastUpdatedAt = ref(null)
  const intervalMs = normalizeRefreshInterval(refreshIntervalMs)
  let intervalId = null
  let lastAutomaticRefreshAt = Number.NEGATIVE_INFINITY

  const stopAutomaticRefresh = () => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  const canRefreshAutomatically = () => (
    autoRefreshEnabled.value === true && isVisibleDocument()
  )

  const markUpdated = () => {
    lastUpdatedAt.value = new Date().toISOString()
  }

  const refreshNow = async ({ automatic = false } = {}) => {
    if ((automatic && isRefreshing.value) || (automatic && !canRefreshAutomatically())) {
      return false
    }

    if (automatic && Date.now() - lastAutomaticRefreshAt < AUTO_REFRESH_DEDUPLICATION_MS) {
      return false
    }

    if (automatic) {
      lastAutomaticRefreshAt = Date.now()
    }

    activeRefreshCount.value += 1
    try {
      const result = await refresh()
      if (result !== null && result !== false) {
        markUpdated()
        return true
      }
      return false
    } catch {
      return false
    } finally {
      activeRefreshCount.value -= 1
    }
  }

  const startAutomaticRefresh = () => {
    stopAutomaticRefresh()
    if (!autoRefreshEnabled.value) return

    intervalId = setInterval(() => {
      void refreshNow({ automatic: true })
    }, intervalMs)
  }

  const refreshWhenVisible = () => {
    if (canRefreshAutomatically()) {
      void refreshNow({ automatic: true })
    }
  }

  const stopAutoRefreshWatch = watch(autoRefreshEnabled, startAutomaticRefresh)

  onMounted(() => {
    if (refreshOnMounted === true) {
      void refreshNow()
    }
    startAutomaticRefresh()

    if (refreshOnWindowFocus === true) {
      window.addEventListener('focus', refreshWhenVisible)
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
  })

  onUnmounted(() => {
    stopAutomaticRefresh()
    stopAutoRefreshWatch()
    if (refreshOnWindowFocus === true) {
      window.removeEventListener('focus', refreshWhenVisible)
    }
    document.removeEventListener('visibilitychange', refreshWhenVisible)
  })

  return {
    isRefreshing,
    lastUpdatedAt,
    markUpdated,
    refreshNow,
  }
}
