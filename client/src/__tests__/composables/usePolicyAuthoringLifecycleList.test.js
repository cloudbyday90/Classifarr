/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { usePolicyAuthoringLifecycleList } from '@/composables/usePolicyAuthoringLifecycleList'

function buildLifecycle(libraryId, name = `Library ${libraryId}`) {
  return {
    version: 'policy.authoring_proposal.v1',
    statusId: 'eligible_to_prepare_proposal',
    library: { id: libraryId, name, mediaType: 'movie' },
    action: { id: 'prepare_proposal', available: true },
    policy: null,
    proposal: { available: true, reasonId: 'current_profile_candidate_available' },
  }
}

describe('usePolicyAuthoringLifecycleList', () => {
  it('loads each connected library through the lifecycle endpoint and preserves input order', async () => {
    const loadLifecycleRequest = vi.fn()
      .mockResolvedValueOnce(buildLifecycle(7, 'Movies'))
      .mockResolvedValueOnce(buildLifecycle(8, 'Series'))
    const lifecycle = usePolicyAuthoringLifecycleList({ loadLifecycleRequest })

    await expect(lifecycle.load([
      { id: 7, name: 'Movies', media_type: 'movie' },
      { id: 8, name: 'Series', media_type: 'movie' },
    ])).resolves.toBe(true)

    expect(loadLifecycleRequest).toHaveBeenNthCalledWith(1, 7)
    expect(loadLifecycleRequest).toHaveBeenNthCalledWith(2, 8)
    expect(lifecycle.entries.value.map(entry => entry.library.name)).toEqual(['Movies', 'Series'])
    expect(lifecycle.entries.value.every(entry => entry.canSelect)).toBe(true)
    expect(lifecycle.loading.value).toBe(false)
  })

  it('fails closed per library when an endpoint response is malformed', async () => {
    const lifecycle = usePolicyAuthoringLifecycleList({
      loadLifecycleRequest: vi.fn().mockResolvedValue({ statusId: 'eligible_to_prepare_proposal' }),
    })

    await expect(lifecycle.load([{ id: 7, name: 'Movies' }])).resolves.toBe(false)

    expect(lifecycle.entries.value).toEqual([expect.objectContaining({
      statusId: 'unavailable',
      canSelect: false,
    })])
    expect(lifecycle.hasUnavailableEntries.value).toBe(true)
  })

  it('does not let a superseded list request replace the newest library states', async () => {
    let resolveFirstRequest
    const firstRequest = new Promise(resolve => {
      resolveFirstRequest = resolve
    })
    const loadLifecycleRequest = vi.fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(buildLifecycle(8, 'Series'))
    const lifecycle = usePolicyAuthoringLifecycleList({ loadLifecycleRequest })

    const firstLoad = lifecycle.load([{ id: 7, name: 'Movies' }])
    await expect(lifecycle.load([{ id: 8, name: 'Series' }])).resolves.toBe(true)
    resolveFirstRequest(buildLifecycle(7, 'Movies'))

    await expect(firstLoad).resolves.toBe(false)
    expect(lifecycle.entries.value).toEqual([expect.objectContaining({
      library: expect.objectContaining({ id: 8, name: 'Series' }),
    })])
  })

  it('uses bounded workers instead of starting every lifecycle request at once', async () => {
    const deferred = []
    const loadLifecycleRequest = vi.fn(libraryId => new Promise(resolve => {
      deferred.push(() => resolve(buildLifecycle(libraryId, `Library ${libraryId}`)))
    }))
    const lifecycle = usePolicyAuthoringLifecycleList({
      loadLifecycleRequest,
      concurrency: 2,
    })

    const loadPromise = lifecycle.load([
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' },
      { id: 3, name: 'Three' },
    ])

    expect(loadLifecycleRequest).toHaveBeenCalledTimes(2)
    deferred.shift()()
    await vi.waitFor(() => expect(loadLifecycleRequest).toHaveBeenCalledTimes(3))
    deferred.shift()()
    deferred.shift()()

    await expect(loadPromise).resolves.toBe(true)
  })
})
