/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RAGStats from '@/views/statistics/RAGStats.vue'
import api from '@/api'

vi.mock('@/api', () => ({ default: { getRagDetailed: vi.fn() } }))

let wrapper
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  api.getRagDetailed.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
})

describe('RAG statistics GET response contract', () => {
  it('renders an unwrapped body through the real SWR fetch path', async () => {
    api.getRagDetailed.mockResolvedValue({
      stats: { totalEmbeddings: 1234, pendingCount: 7, totalFailedCount: 9, failedCount: 2 },
      providerMetrics: { avgLatency: 321, totalRequests: 8, successfulRequests: 6, failedRequests: 2 },
      embeddingAvailability: { status: 'cooldown' },
      circuitBreaker: { state: 'OPEN', failureCount: 4, config: { failureThreshold: 5 }, stateHistory: [] },
      backfillHistory: [{ id: 1, type: 'Synthetic backfill', status: 'completed', processed: 12, total: 12 }]
    })
    wrapper = mount(RAGStats)
    await flushPromises()
    expect(api.getRagDetailed).toHaveBeenCalledWith({ hours: 24 })
    expect(wrapper.text()).not.toContain('Error Loading Statistics')
    expect(wrapper.text()).toContain('1,234')
    expect(wrapper.text()).toContain('321ms')
    expect(wrapper.text()).toContain('Cooling Down')
    expect(wrapper.text()).toContain('OPEN')
    expect(wrapper.text()).toContain('Synthetic backfill')
    expect(wrapper.findAll('p').some(p => p.text() === '9')).toBe(true)
  })

  it('keeps optional-field and older failed-count fallbacks', async () => {
    api.getRagDetailed.mockResolvedValue({ stats: { failedCount: 3 } })
    wrapper = mount(RAGStats)
    await flushPromises()
    expect(wrapper.text()).toContain('Total Embeddings')
    expect(wrapper.text()).toContain('No backfill history')
    expect(wrapper.text()).not.toContain('Error Loading Statistics')
    expect(wrapper.findAll('p').some(p => p.text() === '3')).toBe(true)
  })

  it.each([undefined, null, {}, { stats: [] }, { stats: 'invalid' }, { data: { stats: {} } }])(
    'shows a response failure instead of a zero-data dashboard for %j', async body => {
      api.getRagDetailed.mockResolvedValue(body)
      wrapper = mount(RAGStats)
      await flushPromises()
      expect(wrapper.text()).toContain('Invalid response structure from server')
      expect(wrapper.text()).not.toContain('Total Embeddings')
    }
  )

  it('allows a failed fetch to recover through Retry', async () => {
    api.getRagDetailed.mockResolvedValueOnce({ error: 'Statistics temporarily unavailable' })
      .mockResolvedValueOnce({ stats: { totalEmbeddings: 42 } })
    wrapper = mount(RAGStats)
    await flushPromises()
    expect(wrapper.text()).toContain('Statistics temporarily unavailable')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Total Embeddings')
    expect(wrapper.text()).not.toContain('Error Loading Statistics')
    expect(api.getRagDetailed).toHaveBeenCalledTimes(2)
  })
})
