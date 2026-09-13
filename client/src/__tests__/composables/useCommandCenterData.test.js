/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useCommandCenterData } from '@/composables/useCommandCenterData'

const swr = vi.hoisted(() => ({ calls: [] }))
vi.mock('@/composables/useSWR', () => ({
  useSWR: (key, fetcher, options) => {
    const state = { data: ref(null), error: ref(null), isStale: ref(false), cacheTimestamp: ref(null), refresh: vi.fn() }
    swr.calls.push({ key, fetcher, options, state })
    return state
  },
}))
vi.mock('@/api', () => ({ default: { getLiveStats: vi.fn().mockResolvedValue({ libraryEvaluation: { status: 'available' } }) } }))

describe('Command Center evaluation SWR wiring', () => {
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
    expect(result.libraryEvaluation.value).toBeNull()
    live.state.error.value = null
    live.state.data.value = { queue: {} }
    expect(result.libraryEvaluation.value).toBeUndefined()
  })
})
