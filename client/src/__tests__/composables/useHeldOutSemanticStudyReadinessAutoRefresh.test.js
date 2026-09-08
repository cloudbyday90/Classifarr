/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { defineComponent, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  HELD_OUT_SEMANTIC_STUDY_READINESS_AUTO_REFRESH_INTERVAL_MS,
  useHeldOutSemanticStudyReadinessAutoRefresh,
} from '@/composables/useHeldOutSemanticStudyReadinessAutoRefresh'

function mountAutoRefresh(refresh) {
  return mount(defineComponent({
    setup() {
      const autoRefreshEnabled = ref(true)
      return {
        autoRefreshEnabled,
        ...useHeldOutSemanticStudyReadinessAutoRefresh({ refresh, autoRefreshEnabled }),
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

describe('useHeldOutSemanticStudyReadinessAutoRefresh', () => {
  it('leaves initial loading to the reconciliation view and then refreshes on its bounded interval', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-08T16:00:00.000Z'))
    const refresh = vi.fn().mockResolvedValue({ statusId: 'normal_lifecycle_receipt_required' })
    const wrapper = mountAutoRefresh(refresh)

    await flushPromises()
    expect(refresh).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(HELD_OUT_SEMANTIC_STUDY_READINESS_AUTO_REFRESH_INTERVAL_MS)
    expect(refresh).toHaveBeenCalledOnce()
    expect(wrapper.vm.lastUpdatedAt).toBe('2026-09-08T16:05:00.000Z')

    wrapper.unmount()
  })

  it('does not read while hidden and refreshes when the visible page regains focus', async () => {
    vi.useFakeTimers()
    const refresh = vi.fn().mockResolvedValue({ statusId: 'normal_lifecycle_receipt_required' })
    const wrapper = mountAutoRefresh(refresh)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    await vi.advanceTimersByTimeAsync(HELD_OUT_SEMANTIC_STUDY_READINESS_AUTO_REFRESH_INTERVAL_MS)
    expect(refresh).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(refresh).toHaveBeenCalledOnce()

    wrapper.unmount()
  })
})
