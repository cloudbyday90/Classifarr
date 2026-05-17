/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SystemView from '../views/System.vue'
import api from '../api'

vi.mock('../api', () => ({
  default: {
    getAIConfig: vi.fn(),
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
  rag: 'degraded',
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
    rag: {
      lastCheck: '2026-01-30T12:00:00Z',
      lastSuccessfulCheck: '2026-01-30T11:55:00Z',
      pgvector: true,
      embeddingsTable: true,
      prewarm: true,
      indexes: { text: true, image: false, imageRequired: true, missing: ['image'] },
      embeddingCount: 42,
      staleCount: 3,
      provider: 'local',
      model: 'nomic'
    },
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
    api.getAIConfig.mockResolvedValue({})
    api.getSystemHealth.mockResolvedValue(baseHealth)
    api.getSystemStatus.mockResolvedValue({ ...baseStatus, ...statusOverrides })

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

  it('renders rag card with degraded readiness details', async () => {
    const wrapper = await mountSystem()

    const card = wrapper.find('[data-testid="service-card-rag"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('RAG')
    expect(card.text()).toContain('Degraded')
    expect(card.text()).toContain('Embeddings: 42')
    expect(card.text()).toContain('Missing indexes: image')

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
