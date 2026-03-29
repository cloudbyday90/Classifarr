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
import { mount, flushPromises } from '@vue/test-utils'
import Queue from '../../views/settings/Queue.vue'
import api from '../../api'

// Mock the API
vi.mock('../../api', () => ({
  default: {
    getQueueStats: vi.fn(),
    getQueueSettings: vi.fn(),
    get: vi.fn(),
    clearAndResync: vi.fn(),
    updateQueueSettings: vi.fn(),
    clearCompletedTasks: vi.fn(),
    clearFailedTasks: vi.fn(),
    retryAllFailedTasks: vi.fn(),
    cancelAllPendingTasks: vi.fn(),
    reprocessCompleted: vi.fn(),
  }
}))

describe('Queue.vue - CARSA Dialog Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    api.getQueueStats.mockResolvedValue({
      pending: 5,
      processing: 2,
      completed: 100,
      failed: 3,
      workerRunning: true
    })
    
    api.getQueueSettings.mockResolvedValue({
      data: {
        workerEnabled: true,
        concurrentWorkers: 1,
        maxRetryAttempts: 5,
        retryStrategy: 'exponential',
        autoDeleteCompleted: '7d',
        autoDeleteFailed: 'never',
        activityRefreshInterval: 30
      }
    })
    
    api.get.mockResolvedValue({ data: null })
    api.updateQueueSettings.mockResolvedValue({ data: { ok: true } })
    api.clearCompletedTasks.mockResolvedValue({ data: { count: 100 } })
    api.clearFailedTasks.mockResolvedValue({ data: { count: 3 } })
    api.retryAllFailedTasks.mockResolvedValue({ data: { count: 3 } })
    api.cancelAllPendingTasks.mockResolvedValue({ data: { count: 5 } })
    api.reprocessCompleted.mockResolvedValue({ data: { count: 12 } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('renders CARSA button', async () => {
    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()

    const carsaButton = wrapper.findAll('button').find(b => 
      b.text().includes('Clear & Re-sync All')
    )
    
    expect(carsaButton.exists()).toBe(true)
  })

  it('renders worker and retry configuration without manual review pause controls', async () => {
    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Worker Configuration')
    expect(wrapper.text()).toContain('Concurrent Workers')
    expect(wrapper.text()).not.toContain('Pause Classification For Manual Review')
    expect(wrapper.text()).not.toContain('Manual Review Pause Threshold')
  })

  it('updates retry strategy helper copy for linear and aggressive modes', async () => {
    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()

    const selects = wrapper.findAll('select')
    const retryStrategySelect = selects.find((node) => node.findAll('option').some((option) => option.element.value === 'exponential'))

    await retryStrategySelect.setValue('linear')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Fixed 60 second delay between retries')

    await retryStrategySelect.setValue('aggressive')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Delays: 10s → 20s → 30s → 45s → 60s')
  })

  it('opens dialog when CARSA button is clicked', async () => {
    const openMock = vi.fn()
    
    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: {
            template: '<div class="dialog"></div>',
            setup() {
              return {}
            }
          }
        }
      }
    })

    await flushPromises()

    // Set up the mock after mount
    wrapper.vm.carsaDialog = { open: openMock }

    const carsaButton = wrapper.findAll('button').find(b => 
      b.text().includes('Clear & Re-sync All')
    )
    
    await carsaButton.trigger('click')

    // The dialog's open method should have been called
    expect(openMock).toHaveBeenCalled()
  })

  it('calls handleCarsaConfirm when dialog confirms', async () => {
    api.clearAndResync.mockResolvedValueOnce({
      data: { itemsReset: 50 }
    })

    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: {
            template: '<div></div>',
            methods: {
              open: vi.fn()
            }
          }
        }
      }
    })

    await flushPromises()

    // Manually trigger the handleCarsaConfirm method
    await wrapper.vm.handleCarsaConfirm()
    await flushPromises()

    // Verify API was called
    expect(api.clearAndResync).toHaveBeenCalled()
  })

  it('manages action loading state correctly', async () => {
    let resolveApi
    const apiPromise = new Promise(resolve => {
      resolveApi = resolve
    })
    api.clearAndResync.mockReturnValueOnce(apiPromise)

    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()

    // Get initial state
    expect(wrapper.vm.actionLoading).toBe(false)

    // Trigger confirm manually
    const confirmPromise = wrapper.vm.handleCarsaConfirm()
    
    // Should be loading
    expect(wrapper.vm.actionLoading).toBe(true)

    // Resolve the API call
    resolveApi({ data: { itemsReset: 50 } })
    await confirmPromise
    await flushPromises()

    // Should not be loading anymore
    expect(wrapper.vm.actionLoading).toBe(false)
  })

  it('handles CARSA success correctly', async () => {
    api.clearAndResync.mockResolvedValueOnce({
      data: { itemsReset: 42 }
    })

    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()

    await wrapper.vm.handleCarsaConfirm()
    await flushPromises()

    // Verify success message
    expect(wrapper.vm.actionMessage).toContain('Queue cleared')
    expect(wrapper.vm.actionMessage).toContain('42 items')
    expect(wrapper.vm.actionSuccess).toBe(true)
  })

  it('handles CARSA error correctly', async () => {
    const errorMessage = 'Database error'
    api.clearAndResync.mockRejectedValueOnce(new Error(errorMessage))

    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()

    await wrapper.vm.handleCarsaConfirm()
    await flushPromises()

    // Verify error message
    expect(wrapper.vm.actionMessage).toContain('Failed to resync')
    expect(wrapper.vm.actionMessage).toContain(errorMessage)
    expect(wrapper.vm.actionSuccess).toBe(false)
    expect(wrapper.vm.actionLoading).toBe(false)
  })

  it('saves queue settings successfully and surfaces confirmation', async () => {
    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()
    await wrapper.vm.saveSettings()
    await flushPromises()

    expect(api.updateQueueSettings).toHaveBeenCalledWith(expect.objectContaining({
      workerEnabled: true,
      concurrentWorkers: 1,
      activityRefreshInterval: 30
    }))
    expect(wrapper.vm.saveSuccess).toBe(true)
    expect(wrapper.vm.saveMessage).toContain('successfully')
  })

  it('handles queue settings save failures', async () => {
    api.updateQueueSettings.mockRejectedValueOnce(new Error('save failed'))

    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()
    await wrapper.vm.saveSettings()
    await flushPromises()

    expect(wrapper.vm.saveSuccess).toBe(false)
    expect(wrapper.vm.saveMessage).toContain('Failed to save settings')
  })

  it('runs maintenance actions and refreshes stats', async () => {
    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()
    api.getQueueStats.mockClear()

    await wrapper.vm.clearCompleted()
    await wrapper.vm.clearFailed()
    await wrapper.vm.retryAllFailed()
    await wrapper.vm.cancelAllPending()
    await flushPromises()

    expect(api.clearCompletedTasks).toHaveBeenCalled()
    expect(api.clearFailedTasks).toHaveBeenCalled()
    expect(api.retryAllFailedTasks).toHaveBeenCalled()
    expect(api.cancelAllPendingTasks).toHaveBeenCalled()
    expect(api.getQueueStats).toHaveBeenCalledTimes(4)
  })

  it('aborts reprocess when confirmation is cancelled and reports failures when confirmed action errors', async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false)

    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()
    await wrapper.vm.reprocessCompleted()
    expect(api.reprocessCompleted).not.toHaveBeenCalled()

    vi.mocked(window.confirm).mockReturnValueOnce(true)
    api.reprocessCompleted.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.reprocessCompleted()
    await flushPromises()

    expect(api.reprocessCompleted).toHaveBeenCalled()
    expect(wrapper.vm.actionSuccess).toBe(false)
    expect(wrapper.vm.actionMessage).toContain('Failed to reprocess')
  })

  it('handles queue stats and settings load errors without crashing', async () => {
    api.getQueueStats.mockRejectedValueOnce(new Error('stats failed'))
    api.getQueueSettings.mockRejectedValueOnce(new Error('settings failed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()

    expect(consoleError).toHaveBeenCalledWith('Failed to load queue stats:', expect.any(Error))
    expect(consoleError).toHaveBeenCalledWith('Failed to load queue settings:', expect.any(Error))
    expect(wrapper.exists()).toBe(true)
    consoleError.mockRestore()
  })

  it('disables CARSA button when action is loading', async () => {
    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()

    const carsaButton = wrapper.findAll('button').find(b => 
      b.text().includes('Clear & Re-sync All')
    )

    // Initially not disabled (when actionLoading is false)
    expect(carsaButton.attributes('disabled')).toBeUndefined()

    // Set loading state
    wrapper.vm.actionLoading = true
    await wrapper.vm.$nextTick()

    // Should be disabled
    expect(carsaButton.attributes('disabled')).toBeDefined()
  })

  it('reloads stats after successful CARSA', async () => {
    api.clearAndResync.mockResolvedValueOnce({
      data: { itemsReset: 50 }
    })

    const wrapper = mount(Queue, {
      global: {
        stubs: {
          'router-link': true,
          ClearResyncDialog: true
        }
      }
    })

    await flushPromises()

    // Clear previous calls
    api.getQueueStats.mockClear()

    await wrapper.vm.handleCarsaConfirm()
    await flushPromises()

    // Stats should have been reloaded
    expect(api.getQueueStats).toHaveBeenCalled()
  })
})
