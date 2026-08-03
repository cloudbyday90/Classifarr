/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  getLibraries: vi.fn(),
  getPolicyAuthoringLifecycle: vi.fn(),
  getPolicyOperatorWorkflow: vi.fn(),
  preparePolicyAuthoringProposal: vi.fn(),
  admitPolicyAuthoringProposal: vi.fn(),
  route: null,
  router: null,
}))

vi.mock('@/api/libraryCatalogApi', () => ({ getLibraries: state.getLibraries }))
vi.mock('@/api/policiesApi', () => ({
  getPolicyAuthoringLifecycle: state.getPolicyAuthoringLifecycle,
  getPolicyOperatorWorkflow: state.getPolicyOperatorWorkflow,
  preparePolicyAuthoringProposal: state.preparePolicyAuthoringProposal,
  admitPolicyAuthoringProposal: state.admitPolicyAuthoringProposal,
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

function buildPreparedProposal(libraryId = 7, libraryName = 'Movies') {
  return {
    version: 'policy.authoring_proposal.v1',
    statusId: 'proposal_prepared',
    lifecycle: buildLifecycle({ libraryId, libraryName }),
    proposal: {
      reference: 'proposal_reference_123456789012345678',
      revision: 'a'.repeat(64),
      expiresAt: '2026-08-03T12:00:00.000Z',
      adjustment: {
        purposeGenres: [
          { value: 'Animation', sourceId: 'current_library_profile' },
          { value: 'Family', sourceId: 'current_library_profile' },
        ],
        helpfulStudios: [
          { value: 'Studio Example', sourceId: 'current_library_profile' },
          { value: 'Studio Second', sourceId: 'current_library_profile' },
        ],
      },
      summary: {
        title: `${libraryName} Policy`,
        purpose: [{ signalType: 'genres', operator: 'any_of', values: ['Animation', 'Family'] }],
        helpfulHints: [],
        hardLimitCount: 0,
        avoidCount: 0,
      },
    },
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
    state.getPolicyOperatorWorkflow.mockRejectedValue(new Error('workflow display is optional'))
    state.preparePolicyAuthoringProposal.mockResolvedValue({ data: buildPreparedProposal() })
    state.admitPolicyAuthoringProposal.mockResolvedValue({
      data: {
        version: 'policy.authoring_proposal.v1',
        statusId: 'proposal_admission_created',
        policy: { id: 12, libraryId: 7, name: 'Movies Policy' },
        recovery: { lifecycleReloadRequired: false },
      },
    })
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
    expect(state.preparePolicyAuthoringProposal).not.toHaveBeenCalled()
  })

  it('prepares and admits the selected server proposal without reopening a rule picker', async () => {
    const wrapper = await mountView()
    mountedView = wrapper

    await wrapper.find('#policy-authoring-lifecycle-action-7').trigger('click')
    await flushPromises()

    expect(state.preparePolicyAuthoringProposal).toHaveBeenCalledWith(7)
    expect(wrapper.text()).toContain('Proposed, not saved')
    expect(wrapper.findAll('input, select, textarea')).toHaveLength(0)

    await wrapper.findAll('button').find(button => button.text() === 'Create policy').trigger('click')
    await flushPromises()

    expect(state.admitPolicyAuthoringProposal).toHaveBeenCalledWith(
      7,
      'proposal_reference_123456789012345678',
      'a'.repeat(64),
      expect.objectContaining({ idempotencyKey: expect.any(String), adjustmentCommands: [] })
    )
    expect(wrapper.text()).toContain('Policy created: Movies Policy')
  })

  it('forwards a collapsed proposal adjustment as the sole typed narrowing command', async () => {
    const wrapper = await mountView()
    mountedView = wrapper

    await wrapper.find('#policy-authoring-lifecycle-action-7').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Adjust this policy').trigger('click')
    await wrapper.get('input[value="Family"]').setValue(false)

    await wrapper.findAll('button').find(button => button.text() === 'Create policy').trigger('click')
    await flushPromises()

    expect(state.admitPolicyAuthoringProposal).toHaveBeenCalledWith(
      7,
      'proposal_reference_123456789012345678',
      'a'.repeat(64),
      expect.objectContaining({
        adjustmentCommands: [{ commandId: 'set_purpose_genres', values: ['Animation'] }],
      })
    )
  })

  it('forwards helpful-studio narrowing without turning a helpful preference into purpose', async () => {
    const wrapper = await mountView()
    mountedView = wrapper

    await wrapper.find('#policy-authoring-lifecycle-action-7').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Adjust this policy').trigger('click')
    await wrapper.get('input[value="Studio Second"]').setValue(false)

    await wrapper.findAll('button').find(button => button.text() === 'Create policy').trigger('click')
    await flushPromises()

    expect(state.admitPolicyAuthoringProposal).toHaveBeenCalledWith(
      7,
      'proposal_reference_123456789012345678',
      'a'.repeat(64),
      expect.objectContaining({
        adjustmentCommands: [{ commandId: 'set_helpful_studios', values: ['Studio Example'] }],
      })
    )
  })

  it('discards a concurrent admission attempt and renders the lifecycle-confirmed existing policy', async () => {
    let moviesPolicyExists = false
    state.getPolicyAuthoringLifecycle.mockImplementation(libraryId => Promise.resolve(
      libraryId === 7
        ? buildLifecycle({
          libraryId: 7,
          libraryName: 'Movies',
          statusId: moviesPolicyExists ? 'existing_native_policy' : 'eligible_to_prepare_proposal',
        })
        : buildLifecycle({
          libraryId: 8,
          libraryName: 'Series',
          statusId: 'existing_native_policy',
        })
    ))
    state.admitPolicyAuthoringProposal.mockRejectedValue({
      response: {
        status: 409,
        data: {
          version: 'policy.authoring_proposal.v1',
          statusId: 'existing_policy',
          policy: null,
          recovery: { lifecycleReloadRequired: true },
        },
      },
    })
    const wrapper = await mountView()
    mountedView = wrapper

    await wrapper.find('#policy-authoring-lifecycle-action-7').trigger('click')
    await flushPromises()
    moviesPolicyExists = true

    await wrapper.findAll('button').find(button => button.text() === 'Create policy').trigger('click')
    await flushPromises()

    expect(state.getPolicyAuthoringLifecycle).toHaveBeenCalledTimes(4)
    expect(state.preparePolicyAuthoringProposal).toHaveBeenCalledTimes(1)
    expect(state.admitPolicyAuthoringProposal).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Classifarr checked the current policy state.')
    expect(wrapper.text()).toContain('Current policy: Movies Policy')
    expect(wrapper.findAll('button').map(button => button.text())).not.toContain('Create policy')
    expect(wrapper.findAll('input, select, textarea')).toHaveLength(0)
  })
})
