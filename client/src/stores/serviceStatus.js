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

export const useServiceStatusStore = defineStore('serviceStatus', () => {
  // State
  const serviceHealth = ref({})
  const lastFetch = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  const autoRefreshInterval = ref(null)

  // Fetch service status from backend
  const fetchServiceStatus = async () => {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await api.getSystemHealth()
      
      // Map response to our internal structure
      serviceHealth.value = {
        database: {
          status: response.data.database,
          details: response.data.details?.database
        },
        mediaServer: {
          status: response.data.mediaServer,
          details: response.data.details?.mediaServer
        },
        radarr: {
          status: response.data.radarr,
          details: response.data.details?.radarr
        },
        sonarr: {
          status: response.data.sonarr,
          details: response.data.details?.sonarr
        },
        aiProvider: {
          status: response.data.ollama,
          details: response.data.details?.ollama
        },
        tmdb: {
          status: response.data.tmdb,
          details: response.data.details?.tmdb
        },
        omdb: {
          status: response.data.omdb,
          details: response.data.details?.omdb
        },
        discordBot: {
          status: response.data.discordBot,
          details: response.data.details?.discordBot
        },
        tavily: {
          status: response.data.tavily,
          details: response.data.details?.tavily
        },
        queueWorker: {
          status: response.data.queueWorker,
          details: response.data.details?.queueWorker
        },
        // RAG is part of the database/system
        rag: {
          status: response.data.database === 'connected' ? 'configured' : response.data.database,
          details: response.data.details?.database
        },
        webhook: {
          status: 'unknown', // Webhook doesn't have a health check endpoint yet
          details: null
        }
      }
      
      lastFetch.value = Date.now()
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
    
    // Then refresh every 30 seconds
    autoRefreshInterval.value = setInterval(() => {
      fetchServiceStatus()
    }, 30000) // 30 seconds
  }

  // Stop auto-refresh
  const stopAutoRefresh = () => {
    if (autoRefreshInterval.value) {
      clearInterval(autoRefreshInterval.value)
      autoRefreshInterval.value = null
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
