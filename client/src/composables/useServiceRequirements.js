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

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useServiceStatusStore } from '@/stores/serviceStatus'

// Service-to-settings URL mapping
const SERVICE_SETTINGS_MAP = {
  rag: '/settings?tab=rag',
  aiProvider: '/settings?tab=ai',
  mediaServer: '/settings?tab=mediaserver',
  radarr: '/settings?tab=radarr',
  sonarr: '/settings?tab=sonarr',
  tmdb: '/settings?tab=tmdb',
  omdb: '/settings?tab=omdb',
  discordBot: '/settings?tab=discord',
  webhook: '/settings?tab=webhooks',
  tavily: '/settings?tab=tavily',
  queueWorker: '/system/health'
}

// Human-readable service names
const SERVICE_NAMES = {
  rag: 'RAG/Embeddings',
  aiProvider: 'AI Provider',
  mediaServer: 'Media Server',
  radarr: 'Radarr',
  sonarr: 'Sonarr',
  tmdb: 'TMDB',
  omdb: 'OMDb',
  discordBot: 'Discord Bot',
  webhook: 'Webhook',
  tavily: 'Tavily',
  queueWorker: 'Queue Worker'
}

/**
 * Composable for checking service requirements and handling lockdown states
 * 
 * @param {Array<string>} requiredServices - Array of service keys required for a feature
 * @param {Object} options - Configuration options
 * @param {boolean} options.allowDegraded - Allow degraded services (default: false)
 * @param {boolean} options.allowConfigured - Allow services with 'configured' status (default: true)
 * @returns {Object} Service requirement helpers
 */
export function useServiceRequirements(requiredServices = [], options = {}) {
  const router = useRouter()
  const serviceStatusStore = useServiceStatusStore()
  
  const {
    allowDegraded = false,
    allowConfigured = true
  } = options

  // Check if a single service is available
  const isServiceAvailable = (serviceKey) => {
    const status = serviceStatusStore.getServiceStatus(serviceKey)
    
    // Healthy statuses that allow feature usage
    if (['healthy', 'connected', 'configured'].includes(status)) {
      return true
    }
    
    // Check degraded if allowed
    if (allowDegraded && ['degraded', 'partial'].includes(status)) {
      return true
    }
    
    return false
  }

  // Find first unavailable service
  const firstUnavailableService = computed(() => {
    if (!requiredServices || requiredServices.length === 0) {
      return null
    }
    
    for (const serviceKey of requiredServices) {
      if (!isServiceAvailable(serviceKey)) {
        return serviceKey
      }
    }
    
    return null
  })

  // Check if all required services are available
  const canUseFeature = computed(() => {
    // If no services required, feature is always available
    if (!requiredServices || requiredServices.length === 0) {
      return true
    }
    
    // Check all required services
    return requiredServices.every(serviceKey => isServiceAvailable(serviceKey))
  })

  // Get tooltip message for lockdown
  const lockdownTooltip = computed(() => {
    if (canUseFeature.value) {
      return null
    }
    
    const unavailable = firstUnavailableService.value
    if (!unavailable) {
      return null
    }
    
    const serviceName = SERVICE_NAMES[unavailable] || unavailable
    return `Configure ${serviceName} to enable this feature`
  })

  // Get button variant based on service status
  const buttonVariant = computed(() => {
    if (!canUseFeature.value) {
      return 'disabled'
    }
    
    // Check if any required service is degraded
    if (requiredServices.some(key => {
      const status = serviceStatusStore.getServiceStatus(key)
      return ['degraded', 'partial'].includes(status)
    })) {
      return 'warning'
    }
    
    return 'primary'
  })

  // Navigate to settings for a service
  const navigateToSettings = (serviceKey) => {
    const settingsPath = SERVICE_SETTINGS_MAP[serviceKey]
    if (settingsPath) {
      router.push(settingsPath)
    }
  }

  return {
    canUseFeature,
    lockdownTooltip,
    navigateToSettings,
    firstUnavailableService,
    buttonVariant,
    isServiceAvailable
  }
}
