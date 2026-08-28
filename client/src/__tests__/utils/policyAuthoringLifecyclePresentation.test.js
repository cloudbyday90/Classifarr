/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  adaptPolicyAuthoringLifecyclePresentation,
  buildPolicyAuthoringLifecycleLoadingPresentation,
  POLICY_AUTHORING_LIFECYCLE_PRESENTATION_VERSION,
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS,
} from '@/utils/policyAuthoringLifecyclePresentation'

const library = { id: 9, name: 'Family Movies', media_type: 'movie' }

function buildLifecycle(overrides = {}) {
  return {
    version: 'policy.authoring_proposal.v1',
    statusId: 'eligible_to_prepare_proposal',
    library: {
      id: 9,
      name: 'Family Movies',
      mediaType: 'movie',
    },
    action: {
      id: 'prepare_proposal',
      available: true,
    },
    policy: null,
    proposal: {
      available: true,
      reasonId: 'current_profile_candidate_available',
    },
    ...overrides,
  }
}

describe('policyAuthoringLifecyclePresentation', () => {
  it('projects an eligible lifecycle into the only selectable authoring state', () => {
    const result = adaptPolicyAuthoringLifecyclePresentation({
      lifecycle: buildLifecycle(),
      expectedLibrary: library,
    })

    expect(result.ok).toBe(true)
    expect(result.presentation).toEqual(expect.objectContaining({
      version: POLICY_AUTHORING_LIFECYCLE_PRESENTATION_VERSION,
      statusId: POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.ELIGIBLE_TO_PREPARE_PROPOSAL,
      canSelect: true,
      library: { id: 9, name: 'Family Movies', mediaType: 'movie' },
    }))
    expect(result.presentation).not.toHaveProperty('action')
    expect(result.presentation).not.toHaveProperty('proposal')
    expect(Object.isFrozen(result.presentation)).toBe(true)
  })

  it('presents existing native policy as non-selectable and retains only bounded policy identity', () => {
    const result = adaptPolicyAuthoringLifecyclePresentation({
      lifecycle: buildLifecycle({
        statusId: 'existing_native_policy',
        action: { id: 'inspect_policy', available: false },
        policy: { id: 4, name: 'Family Movies Policy' },
        proposal: { available: false, reasonId: 'existing_native_policy' },
      }),
      expectedLibrary: library,
    })

    expect(result.ok).toBe(true)
    expect(result.presentation).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_NATIVE_POLICY,
      canSelect: false,
      policy: { id: 4, name: 'Family Movies Policy' },
    }))
  })

  it('accepts the server-confirmed reconciliation action for an existing compatibility policy', () => {
    const result = adaptPolicyAuthoringLifecyclePresentation({
      lifecycle: buildLifecycle({
        statusId: 'existing_compatibility_policy',
        action: { id: 'review_reconciliation', available: true },
        policy: { id: 4, name: 'Family Movies Policy' },
        proposal: { available: false, reasonId: 'existing_compatibility_policy' },
      }),
      expectedLibrary: library,
    })

    expect(result.ok).toBe(true)
    expect(result.presentation).toEqual(expect.objectContaining({
      statusId: 'existing_compatibility_policy',
      canSelect: false,
      canReviewMaintenance: true,
    }))
  })

  it('keeps automatic profile recovery informational', () => {
    const result = adaptPolicyAuthoringLifecyclePresentation({
      lifecycle: buildLifecycle({
        statusId: 'profile_recovery_required',
        action: { id: 'refresh_profile', available: false },
        proposal: { available: false, reasonId: 'profile_not_current' },
      }),
      expectedLibrary: library,
    })

    expect(result.ok).toBe(true)
    expect(result.presentation.message).toContain('automatically recovering')
    expect(result.presentation.canSelect).toBe(false)
  })

  it.each([
    ['mismatched library id', lifecycle => { lifecycle.library.id = 10 }],
    ['unexpected action authority', lifecycle => { lifecycle.action.available = false }],
    ['unrecognized proposal reason', lifecycle => { lifecycle.proposal.reasonId = 'browser_decides' }],
    ['additional raw field', lifecycle => { lifecycle.providerPayload = { token: 'not-safe' } }],
  ])('fails closed for %s', (_label, mutate) => {
    const lifecycle = buildLifecycle()
    mutate(lifecycle)

    const result = adaptPolicyAuthoringLifecyclePresentation({
      lifecycle,
      expectedLibrary: library,
    })

    expect(result.ok).toBe(false)
    expect(result.presentation).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.UNAVAILABLE,
      canSelect: false,
      library: expect.objectContaining({ id: 9 }),
    }))
  })

  it('creates an immutable non-actionable loading state from the connected library catalog', () => {
    const presentation = buildPolicyAuthoringLifecycleLoadingPresentation(library)

    expect(presentation).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.LOADING,
      canSelect: false,
      library: { id: 9, name: 'Family Movies', mediaType: 'movie' },
    }))
    expect(Object.isFrozen(presentation)).toBe(true)
  })
})
