/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SystemView from '../views/System.vue'
import api from '../api'

vi.mock('../api', () => ({
  default: {
    getSystemHealth: vi.fn(),
    getSystemStatus: vi.fn(),
    post: vi.fn()
  }
}))

vi.mock('@heroicons/vue/24/outline', () => ({
  ArrowPathIcon: { template: '<span />' }
}))

const baseHealth = {
  database: 'connected',
  mediaServer: 'connected',
  radarr: 'not configured',
  sonarr: 'not configured',
  ollama: 'connected',
  tmdb: 'connected',
  omdb: 'connected',
  discordBot: 'not configured',
  tavily: 'not configured',
  queueWorker: 'healthy',
  details: {
    database: { responseTime: 5, lastCheck: '2026-01-30T12:00:00Z' },
    mediaServer: { responseTime: 10, lastCheck: '2026-01-30T12:00:00Z', type: 'Plex' },
    queueWorker: { latency: 0, timestamp: '2026-01-30T12:00:00Z' }
  }
}

const baseStatus = {
  version: '1.0.0',
  uptime: 120,
  nodeVersion: 'v20.0.0',
  platform: 'linux',
  arch: 'x64',
  memoryUsage: { heapUsed: 1024 },
  pgvector: null
}

describe('System.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mountSystem = async (statusOverrides = {}) => {
    api.getSystemHealth.mockResolvedValue({ data: baseHealth })
    api.getSystemStatus.mockResolvedValue({ data: { ...baseStatus, ...statusOverrides } })

    const wrapper = mount(SystemView, {
      global: {
        stubs: {
          Card: { template: '<div><slot name="header" /><slot /></div>' },
          Badge: { template: '<span><slot /></span>' },
          Button: { template: '<button><slot /></button>' },
          Spinner: { template: '<div />' }
        },
        directives: {
          tooltip: {
            mounted() {},
            updated() {}
          }
        }
      }
    })

    await flushPromises()
    return wrapper
  }

  it('renders pgvector card as healthy when AVX2 matches CPU flags', async () => {
    const wrapper = await mountSystem({
      pgvector: {
        build: 'multi',
        selectedVariant: 'avx2',
        cpuAvx: 'true',
        cpuAvx2: 'true',
        lastChecked: '2026-01-30T12:00:00Z'
      }
    })

    const card = wrapper.find('[data-testid="service-card-pgvector"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('pgvector')
    expect(card.text()).toContain('Healthy')
    expect(card.text()).toContain('Variant: avx2')

    wrapper.unmount()
  })

  it('marks pgvector unhealthy when AVX2 variant lacks CPU support', async () => {
    const wrapper = await mountSystem({
      pgvector: {
        build: 'multi',
        selectedVariant: 'avx2',
        cpuAvx: 'true',
        cpuAvx2: 'false',
        lastChecked: '2026-01-30T12:00:00Z'
      }
    })

    const card = wrapper.find('[data-testid="service-card-pgvector"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('Unhealthy')
    expect(card.text()).toContain('AVX2')

    wrapper.unmount()
  })
})
