/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useCommandCenterPurposeHealth } from '@/composables/useCommandCenterPurposeHealth'

const healthResponse = {
  version: 'policy_purpose_health.v1',
  statusId: 'ready',
  summary: {
    reviewedLibraryCount: 1,
    declaredPurposeLibraryCount: 1,
    missingPurposeLibraryCount: 0,
    competingDestinationLibraryCount: 0,
    profileDerivedPurposeLibraryCount: 0,
    unverifiedPurposeLibraryCount: 0,
    needsAttentionLibraryCount: 0,
    reviewWindowTruncated: false,
  },
  rawPurposeRulesExposed: false,
  libraryIdentityExposed: false,
  policyIdentityExposed: false,
  observedOutcomeDataExposed: false,
  semanticSelectionAffected: false,
  routingAffected: false,
}

function mountComposable(options) {
  let result
  const wrapper = mount(defineComponent({
    setup() {
      result = useCommandCenterPurposeHealth(options)
      return () => null
    },
  }))
  return { result, wrapper }
}

describe('useCommandCenterPurposeHealth', () => {
  it('loads the fixed aggregate without writing it to browser storage', async () => {
    const loadPurposeHealth = vi.fn().mockResolvedValue(healthResponse)
    const { result, wrapper } = mountComposable({ loadPurposeHealth, refreshIntervalMs: 0 })

    await nextTick()
    await flushPromises()

    expect(loadPurposeHealth).toHaveBeenCalledOnce()
    expect(result.health.value).toEqual(healthResponse)
    expect(localStorage.getItem('classifarr:cache:command-center:purpose-health')).toBeNull()
    wrapper.unmount()
  })

  it('hides the administrator-only card after a bounded authorization denial', async () => {
    const loadPurposeHealth = vi.fn().mockRejectedValue({ response: { status: 403 } })
    const { result, wrapper } = mountComposable({ loadPurposeHealth, refreshIntervalMs: 0 })

    await nextTick()
    await flushPromises()

    expect(result.isAvailable.value).toBe(false)
    expect(result.health.value).toBeNull()
    expect(result.errorMessage.value).toBe('')
    wrapper.unmount()
  })
})
