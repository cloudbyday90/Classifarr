/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AdvancedTab from '../views/rag/AdvancedTab.vue'
import api from '../api'

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    getData: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    getAIConfig: vi.fn(),
    updateAIConfig: vi.fn(),
    getRagAdvancedConfig: vi.fn(),
    getRagPromotionReadiness: vi.fn(),
    updateRagAdvancedConfig: vi.fn(),
    clearRagEmbeddings: vi.fn(),
    resetRagConfig: vi.fn()
  }
}))

const baseAdvanced = {
  max_retries: 3,
  retry_delay: 1000,
  request_timeout: 30000,
  cache_enabled: false,
  cache_ttl: 24,
  verbose_logging: false,
  log_embedding_content: false
}

const baseRetry = {
  request_timeout: 30000,
  warmup_timeout: 120000,
  max_retries: 3,
  retry_delay: 1000,
  retry_backoff_multiplier: 2,
  jitter_factor: 0.3
}

const issue275Settings = {
  rag_retrieval_loop_enabled: true,
  rag_loop_rollout_mode: 'shadow',
  rag_loop_low_confidence_threshold: 60,
  rag_retry_strategy: 'auto',
  rag_loop_candidate_limit: 30,
  policy_recheck_below_prompt_threshold_enabled: true,
  policy_recheck_max_attempts: 1,
  policy_recheck_min_confidence_gain: 6,
  rag_loop_shadow_min_samples: 200,
  rag_loop_shadow_max_error_rate_delta: 0.01,
  rag_loop_shadow_max_p95_latency_delta_ms: 250
}

const promotionReadiness = {
  ready: false,
  metrics: {
    shadow_sample_count: 40,
    correction_delta: 0.04,
    error_rate_delta: 0.01,
    p95_latency_delta_ms: 180
  },
  gates: {
    min_samples: 200,
    max_error_rate_delta: 0.02,
    max_p95_latency_delta_ms: 250
  },
  checked_at: '2026-02-11T15:00:00.000Z'
}

describe('AdvancedTab Issue 275 UI controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.put.mockResolvedValue({ data: { success: true } })
    api.updateAIConfig.mockResolvedValue({ data: { success: true } })
    api.updateRagAdvancedConfig.mockResolvedValue({ data: { success: true } })
  })

  function mockSuccessfulGets() {
    api.getAIConfig.mockResolvedValue({ data: issue275Settings })
    api.getRagAdvancedConfig.mockResolvedValue({ data: baseAdvanced })
    api.getRagPromotionReadiness.mockResolvedValue({ data: promotionReadiness })
    api.getData.mockImplementation((url) => {
      if (url === '/settings/embedding/retry') return Promise.resolve(baseRetry)
      return Promise.reject(new Error(`Unexpected GET ${url}`))
    })
  }

  it('renders second-pass controls and promotion metrics summary', async () => {
    mockSuccessfulGets()

    const wrapper = mount(AdvancedTab)
    await flushPromises()

    expect(wrapper.text()).toContain('Second-pass Retrieval Loop')
    expect(wrapper.text()).toContain('Shadow Promotion Metrics (Read-only)')
    expect(wrapper.text()).toContain('Shadow Samples')
    expect(wrapper.text()).toContain('40')
  })

  it('shows compatibility message when Issue 275 keys are unavailable', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    api.getAIConfig.mockResolvedValue({ data: {} })
    api.getRagAdvancedConfig.mockResolvedValue({ data: baseAdvanced })
    api.getRagPromotionReadiness.mockRejectedValue(new Error('404'))
    api.getData.mockImplementation((url) => {
      if (url === '/settings/embedding/retry') return Promise.resolve(baseRetry)
      return Promise.reject(new Error(`Unexpected GET ${url}`))
    })

    const wrapper = mount(AdvancedTab)
    await flushPromises()

    expect(wrapper.text()).toContain('Second-pass controls are unavailable')
    expect(consoleWarnSpy).toHaveBeenCalledWith('Promotion metrics endpoint unavailable:', '404')
    consoleWarnSpy.mockRestore()
  })

  it('saves second-pass settings through /settings/ai when available', async () => {
    mockSuccessfulGets()

    const wrapper = mount(AdvancedTab)
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((btn) => btn.text().includes('Save Advanced Settings'))
    expect(saveButton).toBeDefined()
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateRagAdvancedConfig).toHaveBeenCalledWith(expect.objectContaining({
      max_retries: 3,
      retry_delay: 1000,
      request_timeout: 30000
    }))
    expect(api.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      rag_retrieval_loop_enabled: true,
      rag_loop_rollout_mode: 'shadow',
      rag_loop_low_confidence_threshold: 60,
      rag_retry_strategy: 'auto'
    }))
  })
})
