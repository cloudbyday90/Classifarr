/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import {
  useCommandCenterSemanticEvaluationReadiness,
} from '@/composables/useCommandCenterSemanticEvaluationReadiness'

const readinessResponse = {
  version: 'policy.held_out_semantic_study_readiness.v4',
  statusId: 'normal_lifecycle_receipt_required',
  normalLifecycleReceiptCount: 0,
  completePolicyEvidenceCount: 0,
  currentCompleteAuditAvailable: false,
  measuredBlockerId: 'normal_lifecycle_receipt_required',
  reAuditPreconditionSatisfied: false,
  rawConfigurationExposed: false,
  libraryIdentityExposed: false,
  mediaIdentityExposed: false,
  semanticCohortReady: false,
  independentLabelsAvailable: false,
  semanticSelectionAffected: false,
  routingAffected: false,
}

function mountComposable(options) {
  let result
  const wrapper = mount(defineComponent({
    setup() {
      result = useCommandCenterSemanticEvaluationReadiness(options)
      return () => null
    },
  }))
  return { result, wrapper }
}

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  })
})

describe('useCommandCenterSemanticEvaluationReadiness', () => {
  it('reads the aggregate without copying it into browser storage', async () => {
    const loadReadiness = vi.fn().mockResolvedValue(readinessResponse)
    const { result, wrapper } = mountComposable({ loadReadiness, refreshIntervalMs: 0 })

    await nextTick()
    await flushPromises()

    expect(loadReadiness).toHaveBeenCalledOnce()
    expect(result.readiness.value).toEqual(readinessResponse)
    expect(localStorage.getItem('classifarr:cache:command-center:semantic-evaluation-readiness')).toBeNull()
    wrapper.unmount()
  })

  it('silently removes the administrator-only status after an authorization denial', async () => {
    const loadReadiness = vi.fn().mockRejectedValue({ response: { status: 403 } })
    const { result, wrapper } = mountComposable({ loadReadiness, refreshIntervalMs: 0 })

    await nextTick()
    await flushPromises()

    expect(result.isAvailable.value).toBe(false)
    expect(result.readiness.value).toBeNull()
    expect(result.errorMessage.value).toBe('')
    wrapper.unmount()
  })

  it('refreshes only while visible and catches up when the Command Center returns', async () => {
    vi.useFakeTimers()
    const loadReadiness = vi.fn().mockResolvedValue(readinessResponse)
    const { wrapper } = mountComposable({ loadReadiness, refreshIntervalMs: 1_000 })

    await flushPromises()
    expect(loadReadiness).toHaveBeenCalledOnce()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(loadReadiness).toHaveBeenCalledOnce()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(loadReadiness).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })
})
