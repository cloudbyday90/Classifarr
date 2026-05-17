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

import { mount, flushPromises } from '@vue/test-utils'
import Activity from '../Activity.vue'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock Subcomponents via module mocks (required for script setup)
vi.mock('@/components/common/Card.vue', () => ({ default: { template: '<div data-testid="card"><slot name="header"></slot><slot></slot></div>' } }))
vi.mock('@/components/common/Badge.vue', () => ({ default: { template: '<span data-testid="badge"><slot></slot></span>' } }))
vi.mock('@/components/common/Button.vue', () => ({
  default: {
    emits: ['click'],
    template: '<button data-testid="button" @click="$emit(\'click\', $event)"><slot></slot></button>'
  }
}))
vi.mock('@/components/common/Spinner.vue', () => ({ default: { template: '<div data-testid="spinner"></div>' } }))
vi.mock('@/components/activity/GlobalProgressBar.vue', () => ({ default: { template: '<div data-testid="global-progress-bar"></div>', props: ['task'] } }))
// Important: Mock ActivityItemProgress so we can find it by testid
vi.mock('@/components/activity/ActivityItemProgress.vue', () => ({ default: { template: '<div data-testid="activity-item-progress"></div>', props: ['task'] } }))

// Mock API and Socket
vi.mock('@/api', () => ({
  default: {
    getLiveStats: vi.fn().mockResolvedValue({ health: {}, today: {}, queue: {}, gapAnalysis: {}, enrichment: {} }),
    getLiveFeed: vi.fn().mockResolvedValue({ items: [] }),
    getQueuePending: vi.fn().mockResolvedValue([]),
    getAiGenerationStatus: vi.fn().mockResolvedValue({ isActive: false }),
    getClassificationProgress: vi.fn().mockResolvedValue([]),
    getQueueSettings: vi.fn().mockResolvedValue({ data: {} }),
    processEnrichmentRetries: vi.fn().mockResolvedValue({ data: { success: true } })
  }
}))

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: false // Force disconnected so component uses HTTP data
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}))

describe('Activity.vue', () => {
  let wrapper
  let socketHandlers
  let consoleErrorSpy
  let consoleDebugSpy

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    socketHandlers = {}
    mockSocket.on.mockImplementation((event, handler) => {
      socketHandlers[event] = handler
    })
    global.alert = vi.fn()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    wrapper?.unmount?.()
    consoleErrorSpy.mockRestore()
    consoleDebugSpy.mockRestore()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders Active Classifications', async () => {
    // Setup initial data
    const mockTasks = [
      { taskId: 1, title: 'Movie A', method: 'ai_analysis', percent: 50 },
      { taskId: 2, title: 'Sync Library', method: 'source_library', percent: 10 },
      { taskId: 3, title: 'Show B', method: 'manual_correction', percent: 80 }
    ]
    
    // We mock the API to return our test data
    const api = (await import('@/api')).default
    api.getClassificationProgress.mockResolvedValue(mockTasks)

    wrapper = mount(Activity, {
      global: {
        stubs: {
          TransitionGroup: false
        }
      }
    })

    // Wait for all promises (API calls) to resolve
    await flushPromises()
    
    const otherTasks = wrapper.findAll('[data-testid="activity-item-progress"]')
    
    // Expectation: 2 items in "Other" (Sync Library + Show B) if NOT filtered by frontend
    // Since backend filtering is implemented, the frontend just displays what it gets.
    // This test confirms frontend logic is "dumb pipe".
    expect(otherTasks.length).toBe(2)
  })

  it('renders live stats, retry queue, and pending queue data from refreshData', async () => {
    const api = (await import('@/api')).default
    api.getQueueSettings.mockResolvedValueOnce({ data: { activityRefreshInterval: '45' } })
    api.getLiveStats.mockResolvedValueOnce({
      today: { allClassified: 12, allAvgConfidence: 84 },
      queue: { pending: 9 },
      health: { ai: true, worker: false },
      gapAnalysis: {
        processedItems: 40,
        totalItems: 100,
        unprocessedItems: 60,
        progressPercent: 40,
        batchSize: 25,
        batchIntervalMinutes: 10,
        estimatedMinutes: 24
      },
      enrichment: {
        totalItems: 50,
        enriched: 25,
        completedItems: 25,
        processingItems: 2,
        pendingItems: 3,
        coreEnriched: 20,
        progress: 50,
        coreProgress: 40,
        omdbEnriched: 20,
        tavilyEnriched: 5,
        pending: 3,
        actionablePending: 4,
        deferred: 1,
        deferredItems: 1,
        retryQueue: { total: { pending: 2, actionablePending: 1, deferred: 1 } }
      }
    })
    api.getLiveFeed.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          title: 'Movie A',
          confidence: 82,
          mediaType: 'movie',
          library: 'Films',
          method: 'policy_supported_by_related_evidence',
          timestamp: new Date().toISOString()
        }
      ]
    })
    api.getQueuePending.mockResolvedValueOnce([
      { id: 100, status: 'pending', payload: { title: 'Queued Movie' } },
      { id: 101, status: 'running', payload: { title: 'Ignore Me' } }
    ])
    api.getAiGenerationStatus.mockResolvedValueOnce({
      isActive: true,
      model: 'llama3.2',
      tokenCount: 321,
      elapsedSeconds: 7,
      itemTitle: 'Movie A'
    })
    api.getClassificationProgress.mockResolvedValueOnce([])

    wrapper = mount(Activity, {
      global: {
        stubs: {
          TransitionGroup: false
        }
      }
    })

    await flushPromises()

    socketHandlers.connect()

    expect(wrapper.text()).toContain('45s refresh')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('84%')
    expect(wrapper.text()).toContain('Partial')
    expect(wrapper.text()).toContain('Classification Progress')
    expect(wrapper.text()).toContain('1 items queued for Tavily retry')
    expect(wrapper.text()).toContain('Deferred: 1')
    expect(wrapper.text()).toContain('Processed')
    expect(wrapper.text()).not.toContain('Processed / Deferred')
    expect(wrapper.text()).toContain('Processing')
    expect(wrapper.text()).toContain('Pending')
    expect(wrapper.text()).toContain('Failed')
    expect(wrapper.text()).toContain('AI Generation in Progress')
    expect(wrapper.text()).toContain('Queued Movie')
    expect(wrapper.text()).toContain('Related')
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:activity')
  })

  it('processes enrichment retries and refreshes live data', async () => {
    const api = (await import('@/api')).default
    api.getLiveStats.mockResolvedValueOnce({
      today: {},
      queue: {},
      health: {},
      enrichment: { totalItems: 10, enriched: 5, completedItems: 5, processingItems: 1, pendingItems: 3, failedItems: 0, coreEnriched: 5, progress: 50, coreProgress: 50, retryQueue: { total: { pending: 3, actionablePending: 3, deferred: 0 } } }
    })
    api.getLiveFeed.mockResolvedValueOnce({ items: [] })
    api.getQueuePending.mockResolvedValueOnce([])
    api.getAiGenerationStatus.mockResolvedValueOnce({ isActive: false })
    api.getClassificationProgress.mockResolvedValueOnce([])
    api.processEnrichmentRetries.mockResolvedValueOnce({ data: { success: true } })

    wrapper = mount(Activity, {
      global: {
        stubs: {
          TransitionGroup: false
        }
      }
    })
    await flushPromises()

    api.getLiveStats.mockResolvedValueOnce({
      today: { classified: 1, avgConfidence: 75 },
      queue: { pending: 0 },
      health: { ai: true, worker: true },
      enrichment: { totalItems: 10, enriched: 10, completedItems: 10, processingItems: 0, pendingItems: 0, failedItems: 0, coreEnriched: 10, progress: 100, coreProgress: 100, retryQueue: { total: { pending: 0, actionablePending: 0, deferred: 0 } } }
    })
    api.getLiveFeed.mockResolvedValueOnce({ items: [] })
    api.getQueuePending.mockResolvedValueOnce([])
    api.getAiGenerationStatus.mockResolvedValueOnce({ isActive: false })
    api.getClassificationProgress.mockResolvedValueOnce([])

    const retryButton = wrapper.findAll('button').find((button) => button.text().includes('Process Retries'))
    await retryButton.trigger('click')
    await flushPromises()

    expect(api.processEnrichmentRetries).toHaveBeenCalledWith({ limit: 50, enrichmentType: 'tavily' })
    expect(api.getLiveStats).toHaveBeenCalledTimes(2)
  })

  it('alerts when processing enrichment retries fails', async () => {
    const api = (await import('@/api')).default
    api.getLiveStats.mockResolvedValueOnce({
      today: {},
      queue: {},
      health: {},
      enrichment: { totalItems: 10, enriched: 5, completedItems: 5, processingItems: 1, pendingItems: 3, failedItems: 0, coreEnriched: 5, progress: 50, coreProgress: 50, retryQueue: { total: { pending: 3, actionablePending: 3, deferred: 0 } } }
    })
    api.getLiveFeed.mockResolvedValueOnce({ items: [] })
    api.getQueuePending.mockResolvedValueOnce([])
    api.getAiGenerationStatus.mockResolvedValueOnce({ isActive: false })
    api.getClassificationProgress.mockResolvedValueOnce([])
    api.processEnrichmentRetries.mockRejectedValueOnce(new Error('quota exceeded'))

    wrapper = mount(Activity, {
      global: {
        stubs: {
          TransitionGroup: false
        }
      }
    })
    await flushPromises()

    const retryButton = wrapper.findAll('button').find((button) => button.text().includes('Process Retries'))
    await retryButton.trigger('click')
    await flushPromises()

    expect(global.alert).toHaveBeenCalledWith('Failed to process enrichment retries. Check if Tavily is configured and has quota.')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to process enrichment retries:', expect.any(Error))
  })

  it('handles websocket progress updates and ignores ghost tasks', async () => {
    wrapper = mount(Activity, {
      global: {
        stubs: {
          TransitionGroup: false
        }
      }
    })
    await flushPromises()

    socketHandlers['classification:progress']({
      taskId: 'ghost-1',
      title: 'Unknown',
      method: 'ai_analysis'
    })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Unknown')
    expect(consoleDebugSpy).toHaveBeenCalledWith('Ignoring ghost task with empty title:', 'ghost-1')

    socketHandlers['classification:progress']({
      taskId: 'ghost-2',
      title: 'Library Sync',
      method: 'source_library',
      source_library_id: 44
    })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Library Sync')
    expect(consoleDebugSpy).toHaveBeenCalledWith('Ignoring source_library task:', 'ghost-2')

    socketHandlers['classification:progress']({
      taskId: 'task-1',
      title: 'Movie One',
      method: 'ai_analysis',
      percent: 20
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Processing Now')

    socketHandlers['classification:progress']({
      taskId: 'task-1',
      title: 'Movie One',
      method: 'ai_analysis',
      percent: 75
    })
    await flushPromises()

    expect(wrapper.findAll('[data-testid="global-progress-bar"]')).toHaveLength(1)
  })

  it('removes completed tasks on websocket completion and disconnects on unmount', async () => {
    const api = (await import('@/api')).default

    wrapper = mount(Activity, {
      global: {
        stubs: {
          TransitionGroup: false
        }
      }
    })
    await flushPromises()

    socketHandlers['classification:progress']({
      taskId: 'task-2',
      title: 'Movie Two',
      method: 'manual_correction',
      percent: 50
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Processing Now')

    api.getLiveStats.mockResolvedValueOnce({ today: {}, queue: {}, health: {}, enrichment: null })
    api.getLiveFeed.mockResolvedValueOnce({ items: [] })
    api.getQueuePending.mockResolvedValueOnce([])
    api.getAiGenerationStatus.mockResolvedValueOnce({ isActive: false })
    api.getClassificationProgress.mockResolvedValueOnce([])

    socketHandlers['classification:complete']({ taskId: 'task-2' })
    await flushPromises()

    expect(api.getLiveStats).toHaveBeenCalledTimes(2)

    wrapper.unmount()
    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1)
  })

  it('refreshes on the configured polling interval', async () => {
    const api = (await import('@/api')).default
    api.getQueueSettings.mockResolvedValueOnce({ data: { activityRefreshInterval: '10' } })

    wrapper = mount(Activity, {
      global: {
        stubs: {
          TransitionGroup: false
        }
      }
    })
    await flushPromises()

    api.getLiveStats.mockResolvedValueOnce({ today: {}, queue: {}, health: {}, enrichment: null })
    api.getLiveFeed.mockResolvedValueOnce({ items: [] })
    api.getQueuePending.mockResolvedValueOnce([])
    api.getAiGenerationStatus.mockResolvedValueOnce({ isActive: false })
    api.getClassificationProgress.mockResolvedValueOnce([])

    await vi.advanceTimersByTimeAsync(10000)
    await flushPromises()

    expect(api.getLiveStats).toHaveBeenCalledTimes(2)
  })
})
