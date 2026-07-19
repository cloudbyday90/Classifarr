/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyNativeEvidenceRecovery from '@/components/policies/PolicyNativeEvidenceRecovery.vue'
import {
  POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS,
  POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS,
} from '@/utils/policyNativeEvidenceRecovery'

function buildRecovery(overrides = {}) {
  return {
    statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.PROFILE_UNAVAILABLE,
    heading: 'A current library profile is needed',
    message: 'Refresh the library profile before creating this policy.',
    actionId: POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.REFRESH_PROFILE,
    actionLabel: 'Refresh library profile',
    requiresAction: true,
    tone: 'warning',
    ...overrides,
  }
}

describe('PolicyNativeEvidenceRecovery.vue', () => {
  it('announces recovery and emits one explicit refresh action', async () => {
    const wrapper = mount(PolicyNativeEvidenceRecovery, {
      props: { recovery: buildRecovery() },
    })

    expect(wrapper.find('[role="status"]').text()).toContain('A current library profile is needed')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('refresh-profile')).toHaveLength(1)
    expect(wrapper.emitted('reload-workflow')).toBeUndefined()
  })

  it('uses an assertive bounded announcement for a failed refresh', () => {
    const wrapper = mount(PolicyNativeEvidenceRecovery, {
      props: {
        recovery: buildRecovery({
          statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.REFRESH_FAILED,
          heading: 'Library profile refresh did not complete',
        }),
      },
    })

    expect(wrapper.find('[role="alert"]').text()).toContain('refresh did not complete')
  })

  it('blocks duplicate recovery actions while the refresh is in progress', () => {
    const wrapper = mount(PolicyNativeEvidenceRecovery, {
      props: {
        recovery: buildRecovery(),
        refreshing: true,
      },
    })

    expect(wrapper.text()).toContain('Refreshing library profile...')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
