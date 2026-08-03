/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  getLibraries: vi.fn(),
  getPolicyAuthoringLifecycle: vi.fn(),
  route: null,
  router: null,
}))

vi.mock('@/api/libraryCatalogApi', () => ({ getLibraries: state.getLibraries }))
vi.mock('@/api/policiesApi', () => ({
  getPolicyAuthoringLifecycle: state.getPolicyAuthoringLifecycle,
}))
vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  const route = reactive({ query: {} })
  const router = {
    push: vi.fn(async location => {
      route.query = location.query || {}
    }),
  }
  state.route = route
  state.router = router

  return {
    useRoute: () => route,
    useRouter: () => router,
  }
})

import PolicyList from '@/views/PolicyList.vue'

function buildLifecycle({
  libraryId = 7,
  libraryName = 'Movies',
  statusId = 'eligible_to_prepare_proposal',
} = {}) {
  const isEligible = statusId === 'eligible_to_prepare_proposal'
  const isRecovery = statusId === 'profile_recovery_required'
  const isExisting = statusId === 'existing_native_policy'

  return {
    version: 'policy.authoring_proposal.v1',
    statusId,
    library: { id: libraryId, name: libraryName, mediaType: 'movie' },
    action: isEligible
      ? { id: 'prepare_proposal', available: true }
      : isRecovery
        ? { id: 'refresh_profile', available: false }
        : { id: 'inspect_policy', available: false },
    policy: isExisting ? { id: 3, name: `${libraryName} Policy` } : null,
    proposal: isEligible
      ? { available: true, reasonId: 'current_profile_candidate_available' }
      : isRecovery
        ? { available: false, reasonId: 'profile_not_current' }
        : isExisting
          ? { available: false, reasonId: 'existing_native_policy' }
          : { available: false, reasonId: 'profile_does_not_support_a_safe_proposal' },
  }
}

async function mountView() {
  const wrapper = mount(PolicyList, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('PolicyList.vue', () => {
  let mountedView

  afterEach(() => {
    mountedView?.unmount()
    mountedView = null
    document.body.innerHTML = ''
  })

  beforeEach(() => {
    vi.clearAllMocks()
    state.route.query = {}
    state.getLibraries.mockResolvedValue([
      { id: 7, name: 'Movies', media_type: 'movie' },
      { id: 8, name: 'Series', media_type: 'movie' },
    ])
    state.getPolicyAuthoringLifecycle.mockImplementation(libraryId => Promise.resolve(
      libraryId === 7
        ? buildLifecycle({ libraryId: 7, libraryName: 'Movies' })
        : buildLifecycle({
          libraryId: 8,
          libraryName: 'Series',
          statusId: 'existing_native_policy',
        })
    ))
  })

  it('lists server-confirmed lifecycle outcomes without loading local policy cards or a create modal', async () => {
    const wrapper = await mountView()
    mountedView = wrapper

    expect(state.getLibraries).toHaveBeenCalledOnce()
    expect(state.getPolicyAuthoringLifecycle).toHaveBeenCalledWith(7)
    expect(state.getPolicyAuthoringLifecycle).toHaveBeenCalledWith(8)
    expect(wrapper.text()).toContain('Library Policy Setup')
    expect(wrapper.text()).toContain('Ready to review')
    expect(wrapper.text()).toContain('Policy already exists')
    expect(wrapper.findAll('button').map(button => button.text())).toEqual([
      'Review destination proposal',
    ])
    expect(wrapper.text()).not.toContain('Native intent status')
  })

  it('uses a durable selected-library route for the eligible proposal hand-off and restores focus on return', async () => {
    const wrapper = await mountView()
    mountedView = wrapper
    const reviewButton = wrapper.find('#policy-authoring-lifecycle-action-7')

    await reviewButton.trigger('click')
    await flushPromises()

    expect(state.router.push).toHaveBeenCalledWith({
      name: 'Policies',
      query: { library: '7' },
    })
    expect(wrapper.find('#policy-authoring-selection-7').exists()).toBe(true)
    expect(wrapper.text()).toContain('No policy has been created.')
    expect(document.activeElement).toBe(wrapper.find('#policy-authoring-selection-7').element)

    await wrapper.findAll('button').find(button => button.text() === 'Back to library policy setup').trigger('click')
    await flushPromises()

    expect(state.route.query).toEqual({})
    expect(document.activeElement).toBe(wrapper.find('#policy-authoring-lifecycle-action-7').element)
  })

  it('keeps a direct route to an existing policy non-creating', async () => {
    state.route.query = { library: '8' }
    const wrapper = await mountView()
    mountedView = wrapper

    expect(wrapper.find('#policy-authoring-selection-8').exists()).toBe(true)
    expect(wrapper.text()).toContain('Classifarr will not create another policy from this route.')
    expect(wrapper.find('#policy-authoring-lifecycle-action-8').exists()).toBe(false)
  })
})
