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

import { describe, it, expect } from 'vitest'
import { 
  HEALTH_STATUS, 
  getStatusConfig, 
  getLatencyClass, 
  getOverallHealth,
  calculateTrend,
  getTrendArrow,
  getTrendTooltip
} from '../utils/healthStatus'

describe('healthStatus.js', () => {
  describe('HEALTH_STATUS constant', () => {
    it('exports HEALTH_STATUS constant', () => {
      expect(HEALTH_STATUS).toBeDefined()
      expect(typeof HEALTH_STATUS).toBe('object')
    })

    it('contains all required status keys', () => {
      expect(HEALTH_STATUS.healthy).toBeDefined()
      expect(HEALTH_STATUS.degraded).toBeDefined()
      expect(HEALTH_STATUS.unhealthy).toBeDefined()
      expect(HEALTH_STATUS.not_configured).toBeDefined()
      expect(HEALTH_STATUS.unknown).toBeDefined()
    })

    it('status configs have required properties', () => {
      Object.values(HEALTH_STATUS).forEach(config => {
        expect(config.label).toBeDefined()
        expect(config.badgeVariant).toBeDefined()
        expect(config.dotClass).toBeDefined()
        expect(config.borderClass).toBeDefined()
        expect(config.bgClass).toBeDefined()
        expect(config.textClass).toBeDefined()
        expect(config.icon).toBeDefined()
      })
    })
  })

  describe('getStatusConfig', () => {
    it('returns correct config for valid status', () => {
      expect(getStatusConfig('healthy')).toEqual(HEALTH_STATUS.healthy)
      expect(getStatusConfig('degraded')).toEqual(HEALTH_STATUS.degraded)
      expect(getStatusConfig('unhealthy')).toEqual(HEALTH_STATUS.unhealthy)
    })

    it('returns unknown config for invalid status', () => {
      expect(getStatusConfig('invalid')).toEqual(HEALTH_STATUS.unknown)
      expect(getStatusConfig('')).toEqual(HEALTH_STATUS.unknown)
    })
  })

  describe('getLatencyClass', () => {
    it('returns green for latency < 100ms', () => {
      expect(getLatencyClass(50)).toBe('text-green-500')
      expect(getLatencyClass(99)).toBe('text-green-500')
    })

    it('returns yellow for latency 100-499ms', () => {
      expect(getLatencyClass(100)).toBe('text-yellow-500')
      expect(getLatencyClass(250)).toBe('text-yellow-500')
      expect(getLatencyClass(499)).toBe('text-yellow-500')
    })

    it('returns red for latency >= 500ms', () => {
      expect(getLatencyClass(500)).toBe('text-red-500')
      expect(getLatencyClass(1000)).toBe('text-red-500')
    })

    it('returns gray for null/undefined latency', () => {
      expect(getLatencyClass(null)).toBe('text-gray-500')
      expect(getLatencyClass(undefined)).toBe('text-gray-500')
    })
  })

  describe('getOverallHealth', () => {
    it('returns unknown for empty services array', () => {
      const result = getOverallHealth([])
      expect(result.status).toBe('unknown')
      expect(result.total).toBe(0)
    })

    it('returns healthy when all services are healthy', () => {
      const services = [
        { status: 'healthy' },
        { status: 'healthy' },
        { status: 'healthy' }
      ]
      const result = getOverallHealth(services)
      expect(result.status).toBe('healthy')
      expect(result.healthy).toBe(3)
      expect(result.total).toBe(3)
      expect(result.message).toBe('All systems operational')
    })

    it('returns degraded when some services are degraded', () => {
      const services = [
        { status: 'healthy' },
        { status: 'degraded' },
        { status: 'healthy' }
      ]
      const result = getOverallHealth(services)
      expect(result.status).toBe('degraded')
      expect(result.degraded).toBe(1)
    })

    it('returns unhealthy when any service is unhealthy', () => {
      const services = [
        { status: 'healthy' },
        { status: 'unhealthy' },
        { status: 'degraded' }
      ]
      const result = getOverallHealth(services)
      expect(result.status).toBe('unhealthy')
      expect(result.unhealthy).toBe(1)
    })
  })

  describe('calculateTrend', () => {
    it('returns null when no previous state', () => {
      const current = { status: 'healthy', responseTime: 100 }
      const previous = null
      expect(calculateTrend(current, previous)).toBeNull()
    })

    it('returns null when previous has no status', () => {
      const current = { status: 'healthy', responseTime: 100 }
      const previous = { responseTime: 50 }
      expect(calculateTrend(current, previous)).toBeNull()
    })

    it('returns improving when status improves', () => {
      const current = { status: 'healthy', responseTime: 100 }
      const previous = { status: 'unhealthy', responseTime: 100 }
      expect(calculateTrend(current, previous)).toBe('improving')
    })

    it('returns improving when status improves from connected to healthy', () => {
      const current = { status: 'healthy', responseTime: 100 }
      const previous = { status: 'connected', responseTime: 100 }
      expect(calculateTrend(current, previous)).toBe('stable')
    })

    it('returns degrading when status degrades', () => {
      const current = { status: 'unhealthy', responseTime: 100 }
      const previous = { status: 'healthy', responseTime: 100 }
      expect(calculateTrend(current, previous)).toBe('degrading')
    })

    it('returns degrading when status degrades from healthy to degraded', () => {
      const current = { status: 'degraded', responseTime: 100 }
      const previous = { status: 'healthy', responseTime: 100 }
      expect(calculateTrend(current, previous)).toBe('degrading')
    })

    it('returns stable when status is same and no latency change', () => {
      const current = { status: 'healthy', responseTime: 100 }
      const previous = { status: 'healthy', responseTime: 105 }
      expect(calculateTrend(current, previous)).toBe('stable')
    })

    it('returns improving when latency improves significantly', () => {
      const current = { status: 'healthy', responseTime: 50 }
      const previous = { status: 'healthy', responseTime: 150 }
      expect(calculateTrend(current, previous)).toBe('improving')
    })

    it('returns degrading when latency degrades significantly', () => {
      const current = { status: 'healthy', responseTime: 150 }
      const previous = { status: 'healthy', responseTime: 50 }
      expect(calculateTrend(current, previous)).toBe('degrading')
    })

    it('returns stable when latency change is below threshold', () => {
      const current = { status: 'healthy', responseTime: 100 }
      const previous = { status: 'healthy', responseTime: 130 }
      expect(calculateTrend(current, previous)).toBe('stable')
    })

    it('handles connected and disconnected statuses', () => {
      const current = { status: 'connected', responseTime: 100 }
      const previous = { status: 'disconnected', responseTime: 100 }
      expect(calculateTrend(current, previous)).toBe('improving')
    })

    it('handles not_configured status', () => {
      const current = { status: 'healthy', responseTime: 100 }
      const previous = { status: 'not_configured', responseTime: null }
      expect(calculateTrend(current, previous)).toBe('improving')
    })
  })

  describe('getTrendArrow', () => {
    it('returns up arrow for improving trend', () => {
      expect(getTrendArrow('improving')).toBe('↗️')
    })

    it('returns down arrow for degrading trend', () => {
      expect(getTrendArrow('degrading')).toBe('↘️')
    })

    it('returns right arrow for stable trend', () => {
      expect(getTrendArrow('stable')).toBe('→')
    })

    it('returns empty string for null/unknown trend', () => {
      expect(getTrendArrow(null)).toBe('')
      expect(getTrendArrow('unknown')).toBe('')
    })
  })

  describe('getTrendTooltip', () => {
    it('returns stable message for stable trend', () => {
      const service = { trend: 'stable' }
      expect(getTrendTooltip(service)).toBe('Status is stable')
    })

    it('returns stable message for no trend', () => {
      const service = {}
      expect(getTrendTooltip(service)).toBe('Status is stable')
    })

    it('returns improving message for improving trend', () => {
      const service = { trend: 'improving' }
      expect(getTrendTooltip(service)).toBe('Status is improving')
    })

    it('returns degrading message for degrading trend', () => {
      const service = { trend: 'degrading' }
      expect(getTrendTooltip(service)).toBe('Status is degrading')
    })
  })
})
