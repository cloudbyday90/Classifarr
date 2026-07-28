/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePolicyNativeReadinessSummary } from '@/composables/usePolicyNativeReadinessSummary'

function buildReadinessSummary(policyId = 7) {
  return {
    version: 'policy.native_readiness_summary.v1',
    statusId: 'native_policy_readiness_available',
    policyId,
    nativeIntent: {
      authoritative: true,
      intentVersion: 2,
      purposeRuleCount: 1,
      validationStateId: 'valid',
    },
    readiness: {
      stateId: 'ready',
      label: 'Ready',
      ready: true,
      nextAction: {
        actionId: 'continue_automation',
        label: 'Continue automation',
      },
      reasonCodes: ['ready_for_automation'],
    },
    profileRecovery: {
      stateId: 'not_required',
      label: 'Profile current',
      message: 'No automatic profile recovery is needed.',
    },
    authority: {
      displayProjection: true,
      automationDecision: false,
      policyPersistence: false,
      routingExecution: false,
    },
    sideEffects: {
      profileRefreshOutboxRead: false,
      profileRefreshCircuitRead: false,
      liveMediaServerLookupPerformed: false,
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      policyStorageMutated: false,
      routingExecuted: false,
    },
    rawPayloadExposed: false,
  }
}

describe('usePolicyNativeReadinessSummary', () => {
  it('loads only the bounded, display-only native policy readiness summary', async () => {
    const loadSummaryRequest = vi.fn().mockResolvedValue(buildReadinessSummary())
    const readiness = usePolicyNativeReadinessSummary({ loadSummaryRequest })

    await expect(readiness.loadSummary(7)).resolves.toBe(true)

    expect(loadSummaryRequest).toHaveBeenCalledWith(7)
    expect(readiness.readinessSummary.value).toEqual(buildReadinessSummary())
    expect(readiness.loading.value).toBe(false)
    expect(readiness.error.value).toBe('')
  })

  it('does not issue a request when a persisted policy ID is unavailable', async () => {
    const loadSummaryRequest = vi.fn()
    const readiness = usePolicyNativeReadinessSummary({ loadSummaryRequest })

    await expect(readiness.loadSummary('invalid')).resolves.toBe(false)

    expect(loadSummaryRequest).not.toHaveBeenCalled()
    expect(readiness.readinessSummary.value).toBeNull()
  })

  it('fails closed when a response grants writes or belongs to another policy', async () => {
    const loadSummaryRequest = vi.fn().mockResolvedValue({
      ...buildReadinessSummary(8),
      authority: {
        displayProjection: true,
        automationDecision: false,
        policyPersistence: true,
        routingExecution: false,
      },
    })
    const readiness = usePolicyNativeReadinessSummary({ loadSummaryRequest })

    await expect(readiness.loadSummary(7)).resolves.toBe(false)

    expect(readiness.readinessSummary.value).toBeNull()
    expect(readiness.error.value).toContain('could not load the current policy readiness')
  })

  it('fails closed when readiness state and ready flag disagree', async () => {
    const loadSummaryRequest = vi.fn().mockResolvedValue({
      ...buildReadinessSummary(),
      readiness: {
        ...buildReadinessSummary().readiness,
        ready: false,
      },
    })
    const readiness = usePolicyNativeReadinessSummary({ loadSummaryRequest })

    await expect(readiness.loadSummary(7)).resolves.toBe(false)

    expect(readiness.readinessSummary.value).toBeNull()
    expect(readiness.error.value).toContain('could not load the current policy readiness')
  })

  it('fails closed when automatic profile recovery is not bounded', async () => {
    const loadSummaryRequest = vi.fn().mockResolvedValue({
      ...buildReadinessSummary(),
      profileRecovery: {
        stateId: 'manual_refresh',
        label: 'Refresh now',
        message: 'Untrusted action.',
      },
    })
    const readiness = usePolicyNativeReadinessSummary({ loadSummaryRequest })

    await expect(readiness.loadSummary(7)).resolves.toBe(false)

    expect(readiness.readinessSummary.value).toBeNull()
    expect(readiness.error.value).toContain('could not load the current policy readiness')
  })

  it('accepts the bounded automatic-circuit recovery state without granting browser control', async () => {
    const loadSummaryRequest = vi.fn().mockResolvedValue({
      ...buildReadinessSummary(),
      profileRecovery: {
        stateId: 'awaiting_automatic_probe',
        label: 'Recovery awaiting automatic probe',
        message: 'Classifarr is waiting before its next automatic profile recovery check. No action is needed.',
      },
      sideEffects: {
        ...buildReadinessSummary().sideEffects,
        profileRefreshCircuitRead: true,
      },
    })
    const readiness = usePolicyNativeReadinessSummary({ loadSummaryRequest })

    await expect(readiness.loadSummary(7)).resolves.toBe(true)
    expect(readiness.readinessSummary.value.profileRecovery.stateId).toBe('awaiting_automatic_probe')
    expect(readiness.readinessSummary.value.readiness.nextAction.actionId)
      .toBe('continue_automation')
  })

  it('watches policy changes through the same bounded request path', async () => {
    const policyId = ref(null)
    const loadSummaryRequest = vi.fn().mockResolvedValue(buildReadinessSummary(8))
    const readiness = usePolicyNativeReadinessSummary({ loadSummaryRequest })
    const stopWatching = readiness.watchSummary(policyId)

    policyId.value = 8
    await vi.waitFor(() => expect(loadSummaryRequest).toHaveBeenCalledWith(8))

    expect(readiness.readinessSummary.value.policyId).toBe(8)
    stopWatching()
  })
})
