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

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import { SERVICE_NAMES } from '@/constants/serviceConfig'

const UNHEALTHY_STATUSES = new Set(['disconnected', 'degraded', 'error', 'partial'])
const AUTO_REFRESH_INTERVAL_MS = 30000
const VISIBILITY_EVENT = 'visibilitychange'

export const useServiceStatusStore = defineStore('serviceStatus', () => {
  // State
  const serviceHealth = ref({})
  const lastFetch = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  const autoRefreshInterval = ref(null)
  let stopVisibilityListener = null
  // Track previous statuses per service key for transition-based toasts.
  // Initialised to undefined (not 'unknown') so first-poll unhealthy fires a toast.
  const _previousStatuses = ref({})

  const isDocumentVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible'

  const refreshWhenVisible = () => {
    if (!isDocumentVisible()) {
      return
    }

    fetchServiceStatus()
  }

  const startVisibilityListener = () => {
    if (typeof document === 'undefined' || stopVisibilityListener) {
      return
    }

    const handleVisibilityChange = () => {
      refreshWhenVisible()
    }

    document.addEventListener(VISIBILITY_EVENT, handleVisibilityChange)
    stopVisibilityListener = () => {
      document.removeEventListener(VISIBILITY_EVENT, handleVisibilityChange)
      stopVisibilityListener = null
    }
  }

  // Fetch service status from backend
  const fetchServiceStatus = async () => {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await api.getSystemHealth()
      
      // Map response to our internal structure
      serviceHealth.value = {
        database: {
          status: response.database,
          details: response.details?.database
        },
        mediaServer: {
          status: response.mediaServer,
          details: response.details?.mediaServer
        },
        radarr: {
          status: response.radarr,
          details: response.details?.radarr
        },
        sonarr: {
          status: response.sonarr,
          details: response.details?.sonarr
        },
        aiProvider: {
          status: response.ollama,
          details: response.details?.ollama
        },
        imageEmbeddings: {
          status: response.imageEmbeddings,
          details: response.details?.imageEmbeddings
        },
        tmdb: {
          status: response.tmdb,
          details: response.details?.tmdb
        },
        omdb: {
          status: response.omdb,
          details: response.details?.omdb
        },
        discordBot: {
          status: response.discordBot,
          details: response.details?.discordBot
        },
        tavily: {
          status: response.tavily,
          details: response.details?.tavily
        },
        queueWorker: {
          status: response.queueWorker,
          details: response.details?.queueWorker
        },
        webhook: {
          status: 'unknown', // Webhook doesn't have a health check endpoint yet
          details: null
        }
      }
      
      lastFetch.value = Date.now()

      // Toast on status transitions (generic loop over all mapped services).
      const toast = useToast()
      for (const [key, entry] of Object.entries(serviceHealth.value)) {
        const newStatus = entry?.status
        const prevStatus = _previousStatuses.value[key]
        if (!newStatus || newStatus === prevStatus) continue
        // First-poll: silent when already healthy; toast when already unhealthy
        if (prevStatus === undefined && !UNHEALTHY_STATUSES.has(newStatus)) {
          _previousStatuses.value[key] = newStatus
          continue
        }
        const label = SERVICE_NAMES[key] || key
        if (UNHEALTHY_STATUSES.has(newStatus)) {
          const msg = newStatus === 'degraded'
            ? `${label} is degraded — check system health for details.`
            : `${label} is ${newStatus}.`
          toast.warning(msg, `${label} Offline`)
        } else if (UNHEALTHY_STATUSES.has(prevStatus) && !UNHEALTHY_STATUSES.has(newStatus) && newStatus !== 'unknown') {
          toast.success(`${label} has recovered.`, `${label} Online`)
        }
        _previousStatuses.value[key] = newStatus
      }
    } catch (err) {
      console.error('Failed to fetch service status:', err)
      error.value = err.message || 'Failed to fetch service status'
    } finally {
      isLoading.value = false
    }
  }

  // Check if a service is healthy
  const isServiceHealthy = (serviceKey) => {
    const service = serviceHealth.value[serviceKey]
    if (!service) return false
    
    const status = service.status
    // Healthy statuses
    return ['healthy', 'connected', 'configured'].includes(status)
  }

  // Get service status
  const getServiceStatus = (serviceKey) => {
    const service = serviceHealth.value[serviceKey]
    return service?.status || 'unknown'
  }

  // Get service error
  const getServiceError = (serviceKey) => {
    const service = serviceHealth.value[serviceKey]
    return service?.details?.error || null
  }

  // Start auto-refresh (every 30 seconds)
  const startAutoRefresh = () => {
    // Only start if not already running
    if (autoRefreshInterval.value) {
      return
    }
    
    // Fetch immediately
    fetchServiceStatus()
    startVisibilityListener()
    
    // Then refresh every 30 seconds
    autoRefreshInterval.value = setInterval(() => {
      refreshWhenVisible()
    }, AUTO_REFRESH_INTERVAL_MS)
  }

  // Stop auto-refresh
  const stopAutoRefresh = () => {
    if (autoRefreshInterval.value) {
      clearInterval(autoRefreshInterval.value)
      autoRefreshInterval.value = null
    }

    if (typeof stopVisibilityListener === 'function') {
      stopVisibilityListener()
    }
  }

  // Computed: Overall system health
  const isSystemHealthy = computed(() => {
    return isServiceHealthy('database')
  })

  return {
    // State
    serviceHealth,
    lastFetch,
    isLoading,
    error,
    _previousStatuses,
    
    // Actions
    fetchServiceStatus,
    startAutoRefresh,
    stopAutoRefresh,
    
    // Getters
    isServiceHealthy,
    getServiceStatus,
    getServiceError,
    isSystemHealthy
  }
})
