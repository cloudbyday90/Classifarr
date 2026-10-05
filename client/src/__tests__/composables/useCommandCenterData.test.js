/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useCommandCenterData } from '@/composables/useCommandCenterData'
import api from '@/api'

const swr = vi.hoisted(() => ({ calls: [] }))
vi.mock('@/composables/useSWR', () => ({
  useSWR: (key, fetcher, options) => {
    const state = { data: ref(null), error: ref(null), isOffline: ref(false), isStale: ref(false), cacheTimestamp: ref(null), refresh: vi.fn() }
    swr.calls.push({ key, fetcher, options, state })
    return state
  },
}))
vi.mock('@/api', () => ({ default: { getLibraries: vi.fn(), getLiveStats: vi.fn().mockResolvedValue({ libraryEvaluation: { status: 'available' } }) } }))

describe('Command Center evaluation SWR wiring', () => {
  it('reuses memory-only library polling and clears stale diagnoses on failure, offline and role loss', async () => {
    swr.calls.length = 0
    const result = useCommandCenterData({ router: { push: vi.fn() } })
    expect(swr.calls).toHaveLength(11)
    const libraries = swr.calls.find(call => call.key === 'command-center:libraries')
    expect(libraries.options).toMatchObject({ persist: false, pollOnlyWhenVisible: true })
    expect(result.libraryRecovery.value.state).toBe('loading')
    api.getLibraries.mockResolvedValue([{ id: 5, media_type: 'movie', ingestion_status: { state: 'legacy_owner_unknown', recoveryMode: 'review' } }])
    libraries.state.data.value = await libraries.fetcher()
    expect(result.libraryRecovery.value.attention).toBe(1)
    libraries.state.isStale.value = true
    expect(result.libraryRecovery.value.attention).toBe(1)
    libraries.state.error.value = { status: 403 }
    expect(result.libraryRecovery.value).toMatchObject({ state: 'unavailable', items: [] })
    libraries.state.error.value = null
    libraries.state.isOffline.value = true
    expect(result.libraryRecovery.value.state).toBe('unavailable')
    libraries.state.isOffline.value = false
    api.getLibraries.mockResolvedValue({ data: [] })
    await expect(libraries.fetcher()).rejects.toThrow('Invalid library status snapshot')
    let resolveRefresh
    libraries.state.refresh.mockImplementation(() => new Promise(resolve => { resolveRefresh = resolve }))
    const pending = result.refreshLibraryRecovery()
    expect(result.libraryStatusRefreshing.value).toBe(true)
    await result.refreshLibraryRecovery()
    expect(libraries.state.refresh).toHaveBeenCalledTimes(1)
    resolveRefresh()
    await pending
    expect(result.libraryStatusRefreshing.value).toBe(false)
    libraries.state.data.value = []
    expect(result.libraryRecovery.value).toMatchObject({ state: 'ready', items: [] })
  })
  it('reuses the existing memory-only live-stats request and reacts to role loss and failures', async () => {
    swr.calls.length = 0
    const result = useCommandCenterData({ router: { push: vi.fn() } })
    expect(swr.calls).toHaveLength(11)
    const live = swr.calls.find(call => call.key === 'command-center:live-stats')
    expect(live.options).toMatchObject({ persist: false, pollOnlyWhenVisible: true })
    expect(live.options.pollInterval()).toBeGreaterThan(0)
    live.state.data.value = await live.fetcher()
    expect(result.libraryEvaluation.value.status).toBe('available')
    live.state.error.value = { message: 'Offline' }
    expect(result.resourceStatusUnavailable.value).toBe(true)
    expect(result.libraryEvaluation.value).toBeNull()
    live.state.error.value = null
    expect(result.resourceStatusUnavailable.value).toBe(false)
    live.state.isStale.value = true
    expect(result.resourceStatusUnavailable.value).toBe(false)
    live.state.isStale.value = false
    live.state.isOffline.value = true
    expect(result.resourceStatusUnavailable.value).toBe(true)
    live.state.isOffline.value = false
    live.state.data.value = { queue: {} }
    expect(result.libraryEvaluation.value).toBeUndefined()
  })
  it('does not report unavailable pending decisions as zero or persist them', () => {
    swr.calls.length = 0
    const result = useCommandCenterData({ router: { push: vi.fn() } })
    const pending = swr.calls.find(call => call.key === 'command-center:pending-classifications')
    expect(pending.options.persist).toBe(false)
    expect(result.pendingDecisionCount.value).toBeNull()
    pending.state.data.value = { items: [{ id: 1 }] }
    expect(result.pendingDecisionCount.value).toBe(1)
    pending.state.error.value = { message: 'denied' }
    expect(result.pendingDecisionCount.value).toBeNull()
  })
})
