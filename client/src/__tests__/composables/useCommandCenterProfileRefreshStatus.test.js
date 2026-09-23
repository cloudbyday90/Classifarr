/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useCommandCenterProfileRefreshStatus } from '@/composables/useCommandCenterProfileRefreshStatus'

const response = {
  version: 'library.profile_refresh_status.v1', asOf: '2026-09-23T12:00:00.000Z',
  windowTruncated: false,
  libraries: [{ libraryId: 7, name: 'Movies', isActive: true, statusId: 'waiting',
    sourceRevision: '2', acknowledgedRevision: '1', profileRevision: '1', retryAt: null }],
}

function mountComposable(options) {
  let result
  const wrapper = mount(defineComponent({
    setup() {
      result = useCommandCenterProfileRefreshStatus(options)
      return () => null
    },
  }))
  return { result, wrapper }
}

describe('useCommandCenterProfileRefreshStatus', () => {
  it('loads a no-store snapshot without writing browser storage', async () => {
    const loadStatus = vi.fn().mockResolvedValue(response)
    const { result, wrapper } = mountComposable({ loadStatus, refreshIntervalMs: 0 })
    await nextTick()
    await flushPromises()
    expect(loadStatus).toHaveBeenCalledOnce()
    expect(result.status.value.summary.waiting).toBe(1)
    expect(localStorage.getItem('classifarr:cache:command-center:profile-refresh')).toBeNull()
    wrapper.unmount()
  })

  it('refreshes only on a visible return and hides status on authorization denial', async () => {
    let visibility = 'hidden'
    const listeners = new Map()
    const documentRef = {
      get visibilityState() { return visibility },
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name),
    }
    const loadStatus = vi.fn().mockResolvedValueOnce(response)
      .mockRejectedValueOnce({ response: { status: 403 } })
    const { result, wrapper } = mountComposable({ loadStatus, documentRef, refreshIntervalMs: 0 })
    await flushPromises()
    expect(loadStatus).not.toHaveBeenCalled()

    visibility = 'visible'
    listeners.get('visibilitychange')()
    await flushPromises()
    expect(result.status.value.summary.waiting).toBe(1)
    await result.refresh()
    expect(result.isAvailable.value).toBe(false)
    expect(result.status.value).toBeNull()
    expect(result.errorMessage.value).toBe('')
    wrapper.unmount()
    expect(listeners.size).toBe(0)
  })
})
