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
import { useServiceLockdownDialog } from '@/composables/useServiceLockdownToast'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

describe('useServiceLockdownDialog', () => {
  let confirmSpy

  beforeEach(() => {
    mockPush.mockClear()
    confirmSpy = vi.spyOn(window, 'confirm')
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  describe('showLockdownNotification', () => {
    it('displays correct message for known service', () => {
      confirmSpy.mockReturnValue(false)
      const { showLockdownNotification } = useServiceLockdownDialog()

      showLockdownNotification('aiProvider')

      expect(confirmSpy).toHaveBeenCalledWith(
        'AI Provider is required to use this feature.\n\nWould you like to configure it now?'
      )
    })

    it('uses service key as fallback for unknown service', () => {
      confirmSpy.mockReturnValue(false)
      const { showLockdownNotification } = useServiceLockdownDialog()

      showLockdownNotification('unknownService')

      expect(confirmSpy).toHaveBeenCalledWith(
        'unknownService is required to use this feature.\n\nWould you like to configure it now?'
      )
    })

    it('navigates to settings when user confirms for known service', () => {
      confirmSpy.mockReturnValue(true)
      const { showLockdownNotification } = useServiceLockdownDialog()

      const result = showLockdownNotification('mediaServer')

      expect(mockPush).toHaveBeenCalledWith('/settings?tab=mediaserver')
      expect(result).toBe(true)
    })

    it('does not navigate when user cancels', () => {
      confirmSpy.mockReturnValue(false)
      const { showLockdownNotification } = useServiceLockdownDialog()

      const result = showLockdownNotification('mediaServer')

      expect(mockPush).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('does not navigate for unknown service even if confirmed', () => {
      confirmSpy.mockReturnValue(true)
      const { showLockdownNotification } = useServiceLockdownDialog()

      const result = showLockdownNotification('unknownService')

      expect(mockPush).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('handles all known services correctly', () => {
      confirmSpy.mockReturnValue(true)
      const { showLockdownNotification } = useServiceLockdownDialog()

      const services = [
        { key: 'aiProvider', url: '/settings?tab=ai', name: 'AI Provider' },
        { key: 'imageEmbeddings', url: '/settings?tab=rag', name: 'Image Embeddings' },
        { key: 'mediaServer', url: '/settings?tab=mediaserver', name: 'Media Server' },
        { key: 'radarr', url: '/settings?tab=radarr', name: 'Radarr' },
        { key: 'sonarr', url: '/settings?tab=sonarr', name: 'Sonarr' },
        { key: 'tmdb', url: '/settings?tab=tmdb', name: 'TMDB' },
        { key: 'omdb', url: '/settings?tab=omdb', name: 'OMDb' },
        { key: 'discordBot', url: '/settings?tab=discord', name: 'Discord Bot' },
        { key: 'webhook', url: '/settings?tab=webhooks', name: 'Webhook' },
        { key: 'tavily', url: '/settings?tab=tavily', name: 'Tavily' },
        { key: 'queueWorker', url: '/system/health', name: 'Queue Worker' }
      ]

      services.forEach(service => {
        mockPush.mockClear()
        confirmSpy.mockClear()
        confirmSpy.mockReturnValue(true)

        showLockdownNotification(service.key)

        expect(confirmSpy).toHaveBeenCalledWith(
          `${service.name} is required to use this feature.\n\nWould you like to configure it now?`
        )
        expect(mockPush).toHaveBeenCalledWith(service.url)
      })
    })

    it('returns true only when user confirms and service has settings URL', () => {
      const { showLockdownNotification } = useServiceLockdownDialog()

      // Confirm with known service
      confirmSpy.mockReturnValue(true)
      expect(showLockdownNotification('aiProvider')).toBe(true)

      // Cancel with known service
      confirmSpy.mockReturnValue(false)
      expect(showLockdownNotification('aiProvider')).toBe(false)

      // Confirm with unknown service (no URL)
      confirmSpy.mockReturnValue(true)
      expect(showLockdownNotification('unknown')).toBe(false)
    })
  })
})
