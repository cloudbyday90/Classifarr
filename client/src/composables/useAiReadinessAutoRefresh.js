/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

export const AI_READINESS_AUTO_REFRESH_INTERVAL_MS = 2 * 60 * 1000
const AUTO_REFRESH_DEDUPLICATION_MS = 2 * 1000

function isVisibleDocument() {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

function normalizeRefreshInterval(value) {
  const interval = Number(value)
  return Number.isSafeInteger(interval) && interval >= 1_000
    ? interval
    : AI_READINESS_AUTO_REFRESH_INTERVAL_MS
}

/**
 * Owns the bounded, read-only refresh lifecycle for the authoritative AI
 * readiness projection. It deliberately has no model-test, save, discovery,
 * or routing authority.
 *
 * @param {{
 *   refresh: () => Promise<unknown>,
 *   autoRefreshEnabled?: import('vue').Ref<boolean>,
 *   refreshIntervalMs?: number,
 * }} options
 */
export function useAiReadinessAutoRefresh({
  refresh,
  autoRefreshEnabled = ref(true),
  refreshIntervalMs = AI_READINESS_AUTO_REFRESH_INTERVAL_MS,
} = {}) {
  if (typeof refresh !== 'function') {
    throw new TypeError('AI readiness auto refresh requires a refresh function.')
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

  const refreshReadiness = async ({ automatic = false } = {}) => {
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
        markReadinessUpdated()
        return true
      }
      return false
    } catch {
      return false
    } finally {
      activeRefreshCount.value -= 1
    }
  }

  const markReadinessUpdated = () => {
    lastUpdatedAt.value = new Date().toISOString()
  }

  const startAutomaticRefresh = () => {
    stopAutomaticRefresh()
    if (!autoRefreshEnabled.value) return

    intervalId = setInterval(() => {
      void refreshReadiness({ automatic: true })
    }, intervalMs)
  }

  const handleVisibilityChange = () => {
    if (canRefreshAutomatically()) {
      void refreshReadiness({ automatic: true })
    }
  }

  const handleWindowFocus = () => {
    if (canRefreshAutomatically()) {
      void refreshReadiness({ automatic: true })
    }
  }

  const stopAutoRefreshWatch = watch(autoRefreshEnabled, () => {
    startAutomaticRefresh()
  })

  onMounted(() => {
    void refreshReadiness()
    startAutomaticRefresh()

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    stopAutomaticRefresh()
    stopAutoRefreshWatch()
    window.removeEventListener('focus', handleWindowFocus)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    isRefreshing,
    lastUpdatedAt,
    markReadinessUpdated,
    refreshReadiness,
  }
}
