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
const readinessResponse = {
  version: 'library.upgrade_readiness.v1', asOf: '2026-09-23T12:00:00.000Z',
  libraryCount: 1, activeLibraryCount: 1, mediaTypes: { movie: 1, tv: 0, other: 0 },
  profile: { current: 0, queued: 0, processing: 0, retryWait: 0, cooldown: 0,
    waiting: 1, paused: 0, unverified: 0, noInventory: 0, missing: 0 },
  upgradeEnrollmentRecorded: true,
  sourceIdentity: { completeCaptureLibraryCount: 0, unresolvedItemCount: 0,
    conflictingProviderItemCount: 0, invalidProviderItemCount: 0, invalidMediaTypeItemCount: 0,
    scope: 'active_complete_full_captures_last_30_days' },
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
    const loadReadiness = vi.fn().mockResolvedValue(readinessResponse)
    const { result, wrapper } = mountComposable({ loadStatus, loadReadiness, refreshIntervalMs: 0 })
    await nextTick()
    await flushPromises()
    expect(loadStatus).toHaveBeenCalledOnce()
    expect(result.status.value.summary.waiting).toBe(1)
    expect(result.readiness.value.libraryCount).toBe(1)
    await result.refresh()
    expect(loadReadiness).toHaveBeenCalledOnce()
    expect(localStorage.getItem('classifarr:cache:command-center:profile-refresh')).toBeNull()
    wrapper.unmount()
  })

  it('keeps the bounded profile view when the aggregate cannot be read', async () => {
    const { result, wrapper } = mountComposable({
      loadStatus: vi.fn().mockResolvedValue(response),
      loadReadiness: vi.fn().mockRejectedValue(new Error('unavailable')),
      refreshIntervalMs: 0,
    })
    await flushPromises()
    expect(result.status.value.summary.waiting).toBe(1)
    expect(result.readiness.value).toBeNull()
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
    const { result, wrapper } = mountComposable({ loadStatus, loadReadiness: null, documentRef, refreshIntervalMs: 0 })
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
