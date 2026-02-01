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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useServiceRequirements } from '@/composables/useServiceRequirements'
import { useServiceStatusStore } from '@/stores/serviceStatus'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

describe('useServiceRequirements composable', () => {
  let serviceStatusStore

  beforeEach(() => {
    setActivePinia(createPinia())
    serviceStatusStore = useServiceStatusStore()
    mockPush.mockClear()
  })

  describe('canUseFeature', () => {
    it('returns true when no services required', () => {
      const { canUseFeature } = useServiceRequirements([])
      expect(canUseFeature.value).toBe(true)
    })

    it('returns true when all required services are healthy', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'connected' },
        aiProvider: { status: 'configured' }
      }

      const { canUseFeature } = useServiceRequirements(['mediaServer', 'aiProvider'])
      expect(canUseFeature.value).toBe(true)
    })

    it('returns false when one required service is not configured', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'connected' },
        aiProvider: { status: 'not_configured' }
      }

      const { canUseFeature } = useServiceRequirements(['mediaServer', 'aiProvider'])
      expect(canUseFeature.value).toBe(false)
    })

    it('returns false when service is disconnected', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'disconnected' }
      }

      const { canUseFeature } = useServiceRequirements(['mediaServer'])
      expect(canUseFeature.value).toBe(false)
    })

    it('returns false when service has error status', () => {
      serviceStatusStore.serviceHealth = {
        aiProvider: { status: 'error' }
      }

      const { canUseFeature } = useServiceRequirements(['aiProvider'])
      expect(canUseFeature.value).toBe(false)
    })

    it('returns false when service is unhealthy', () => {
      serviceStatusStore.serviceHealth = {
        tmdb: { status: 'unhealthy' }
      }

      const { canUseFeature } = useServiceRequirements(['tmdb'])
      expect(canUseFeature.value).toBe(false)
    })
  })

  describe('allowDegraded option', () => {
    it('returns false for degraded services by default', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'degraded' }
      }

      const { canUseFeature } = useServiceRequirements(['mediaServer'])
      expect(canUseFeature.value).toBe(false)
    })

    it('returns true for degraded services when allowDegraded is true', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'degraded' }
      }

      const { canUseFeature } = useServiceRequirements(['mediaServer'], { allowDegraded: true })
      expect(canUseFeature.value).toBe(true)
    })

    it('returns true for partial services when allowDegraded is true', () => {
      serviceStatusStore.serviceHealth = {
        aiProvider: { status: 'partial' }
      }

      const { canUseFeature } = useServiceRequirements(['aiProvider'], { allowDegraded: true })
      expect(canUseFeature.value).toBe(true)
    })
  })

  describe('firstUnavailableService', () => {
    it('returns null when no services required', () => {
      const { firstUnavailableService } = useServiceRequirements([])
      expect(firstUnavailableService.value).toBeNull()
    })

    it('returns null when all services are available', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'connected' },
        aiProvider: { status: 'healthy' }
      }

      const { firstUnavailableService } = useServiceRequirements(['mediaServer', 'aiProvider'])
      expect(firstUnavailableService.value).toBeNull()
    })

    it('returns first unavailable service key', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'connected' },
        aiProvider: { status: 'not_configured' },
        tmdb: { status: 'error' }
      }

      const { firstUnavailableService } = useServiceRequirements(['mediaServer', 'aiProvider', 'tmdb'])
      expect(firstUnavailableService.value).toBe('aiProvider')
    })

    it('returns the only unavailable service', () => {
      serviceStatusStore.serviceHealth = {
        tmdb: { status: 'not_configured' }
      }

      const { firstUnavailableService } = useServiceRequirements(['tmdb'])
      expect(firstUnavailableService.value).toBe('tmdb')
    })
  })

  describe('lockdownTooltip', () => {
    it('returns null when feature can be used', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'connected' }
      }

      const { lockdownTooltip } = useServiceRequirements(['mediaServer'])
      expect(lockdownTooltip.value).toBeNull()
    })

    it('returns appropriate message for unavailable service', () => {
      serviceStatusStore.serviceHealth = {
        aiProvider: { status: 'not_configured' }
      }

      const { lockdownTooltip } = useServiceRequirements(['aiProvider'])
      expect(lockdownTooltip.value).toBe('Configure AI Provider to enable this feature')
    })

    it('returns message for TMDB service', () => {
      serviceStatusStore.serviceHealth = {
        tmdb: { status: 'error' }
      }

      const { lockdownTooltip } = useServiceRequirements(['tmdb'])
      expect(lockdownTooltip.value).toBe('Configure TMDB to enable this feature')
    })

    it('returns message for Media Server', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'disconnected' }
      }

      const { lockdownTooltip } = useServiceRequirements(['mediaServer'])
      expect(lockdownTooltip.value).toBe('Configure Media Server to enable this feature')
    })
  })

  describe('buttonVariant', () => {
    it('returns disabled when feature cannot be used', () => {
      serviceStatusStore.serviceHealth = {
        aiProvider: { status: 'not_configured' }
      }

      const { buttonVariant } = useServiceRequirements(['aiProvider'])
      expect(buttonVariant.value).toBe('disabled')
    })

    it('returns warning when service is degraded', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'degraded' }
      }

      const { buttonVariant } = useServiceRequirements(['mediaServer'], { allowDegraded: true })
      expect(buttonVariant.value).toBe('warning')
    })

    it('returns primary when all services are healthy', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'connected' },
        aiProvider: { status: 'healthy' }
      }

      const { buttonVariant } = useServiceRequirements(['mediaServer', 'aiProvider'])
      expect(buttonVariant.value).toBe('primary')
    })

    it('returns warning when at least one service is partial', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'connected' },
        aiProvider: { status: 'partial' }
      }

      const { buttonVariant } = useServiceRequirements(['mediaServer', 'aiProvider'], { allowDegraded: true })
      expect(buttonVariant.value).toBe('warning')
    })
  })

  describe('navigateToSettings', () => {
    it('navigates to TMDB settings', () => {
      const { navigateToSettings } = useServiceRequirements([])
      navigateToSettings('tmdb')
      expect(mockPush).toHaveBeenCalledWith('/settings?tab=tmdb')
    })

    it('navigates to AI settings', () => {
      const { navigateToSettings } = useServiceRequirements([])
      navigateToSettings('aiProvider')
      expect(mockPush).toHaveBeenCalledWith('/settings?tab=ai')
    })

    it('navigates to Media Server settings', () => {
      const { navigateToSettings } = useServiceRequirements([])
      navigateToSettings('mediaServer')
      expect(mockPush).toHaveBeenCalledWith('/settings?tab=mediaserver')
    })

    it('navigates to system health for queue worker', () => {
      const { navigateToSettings } = useServiceRequirements([])
      navigateToSettings('queueWorker')
      expect(mockPush).toHaveBeenCalledWith('/system/health')
    })

    it('does not navigate for unknown service', () => {
      const { navigateToSettings } = useServiceRequirements([])
      navigateToSettings('unknownService')
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('isServiceAvailable', () => {
    it('returns true for healthy service', () => {
      serviceStatusStore.serviceHealth = {
        tmdb: { status: 'healthy' }
      }

      const { isServiceAvailable } = useServiceRequirements([])
      expect(isServiceAvailable('tmdb')).toBe(true)
    })

    it('returns true for connected service', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'connected' }
      }

      const { isServiceAvailable } = useServiceRequirements([])
      expect(isServiceAvailable('mediaServer')).toBe(true)
    })

    it('returns true for configured service', () => {
      serviceStatusStore.serviceHealth = {
        webhook: { status: 'configured' }
      }

      const { isServiceAvailable } = useServiceRequirements([])
      expect(isServiceAvailable('webhook')).toBe(true)
    })

    it('returns false for not_configured service', () => {
      serviceStatusStore.serviceHealth = {
        discordBot: { status: 'not_configured' }
      }

      const { isServiceAvailable } = useServiceRequirements([])
      expect(isServiceAvailable('discordBot')).toBe(false)
    })
  })

  describe('Multiple services', () => {
    it('handles multiple services correctly', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'connected' },
        aiProvider: { status: 'healthy' },
        tmdb: { status: 'configured' }
      }

      const { canUseFeature } = useServiceRequirements(['mediaServer', 'aiProvider', 'tmdb'])
      expect(canUseFeature.value).toBe(true)
    })

    it('fails if any of multiple services is unavailable', () => {
      serviceStatusStore.serviceHealth = {
        mediaServer: { status: 'connected' },
        aiProvider: { status: 'not_configured' },
        tmdb: { status: 'configured' }
      }

      const { canUseFeature } = useServiceRequirements(['mediaServer', 'aiProvider', 'tmdb'])
      expect(canUseFeature.value).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('handles undefined requiredServices', () => {
      const { canUseFeature } = useServiceRequirements(undefined)
      expect(canUseFeature.value).toBe(true)
    })

    it('handles null requiredServices', () => {
      const { canUseFeature } = useServiceRequirements(null)
      expect(canUseFeature.value).toBe(true)
    })

    it('handles missing service in store', () => {
      serviceStatusStore.serviceHealth = {}

      const { canUseFeature } = useServiceRequirements(['missingService'])
      expect(canUseFeature.value).toBe(false)
    })
  })
})
