/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { defineComponent, ref } from 'vue'
import { describe, expect, it, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  AI_READINESS_AUTO_REFRESH_INTERVAL_MS,
  useAiReadinessAutoRefresh,
} from '@/composables/useAiReadinessAutoRefresh'

function mountAutoRefresh(refresh) {
  return mount(defineComponent({
    setup() {
      const autoRefreshEnabled = ref(true)
      return {
        autoRefreshEnabled,
        ...useAiReadinessAutoRefresh({ refresh, autoRefreshEnabled }),
      }
    },
    template: '<div />',
  }))
}

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  })
})

describe('useAiReadinessAutoRefresh', () => {
  it('refreshes on mount and on the bounded visible-page interval', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'))
    const refresh = vi.fn().mockResolvedValue({ status: 'ready' })
    const wrapper = mountAutoRefresh(refresh)

    await flushPromises()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.lastUpdatedAt).toBe('2026-08-30T12:00:00.000Z')

    await vi.advanceTimersByTimeAsync(AI_READINESS_AUTO_REFRESH_INTERVAL_MS)
    expect(refresh).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('does not refresh automatically while paused or hidden, but permits an explicit refresh', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'))
    const refresh = vi.fn().mockResolvedValue({ status: 'ready' })
    const wrapper = mountAutoRefresh(refresh)

    await flushPromises()
    wrapper.vm.autoRefreshEnabled = false
    await flushPromises()
    await vi.advanceTimersByTimeAsync(AI_READINESS_AUTO_REFRESH_INTERVAL_MS)
    expect(refresh).toHaveBeenCalledTimes(1)

    const refreshed = await wrapper.vm.refreshReadiness()
    expect(refreshed).toBe(true)
    expect(refresh).toHaveBeenCalledTimes(2)

    wrapper.vm.autoRefreshEnabled = true
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    await vi.advanceTimersByTimeAsync(AI_READINESS_AUTO_REFRESH_INTERVAL_MS)
    expect(refresh).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('allows a post-save refresh to supersede a still-pending initial read', async () => {
    let resolveInitialRefresh
    const refresh = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveInitialRefresh = resolve
      }))
      .mockResolvedValueOnce({ status: 'newer' })
    const wrapper = mountAutoRefresh(refresh)

    await flushPromises()
    const postSaveRefresh = wrapper.vm.refreshReadiness()
    await flushPromises()

    expect(refresh).toHaveBeenCalledTimes(2)
    await expect(postSaveRefresh).resolves.toBe(true)

    resolveInitialRefresh({ status: 'older' })
    await flushPromises()
    expect(wrapper.vm.lastUpdatedAt).not.toBeNull()

    wrapper.unmount()
  })
})
