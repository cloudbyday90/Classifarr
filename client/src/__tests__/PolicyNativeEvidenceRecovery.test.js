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
    busyLabel: 'Refreshing library profile...',
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
    expect(wrapper.find('button').attributes('aria-describedby'))
      .toBe('policy-native-evidence-recovery-message')
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

  it('can remain visible without becoming a second live announcement', () => {
    const wrapper = mount(PolicyNativeEvidenceRecovery, {
      props: {
        recovery: buildRecovery(),
        announce: false,
      },
    })

    expect(wrapper.text()).toContain('A current library profile is needed')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('uses workflow-specific busy copy and emits only the bounded reload action', async () => {
    const wrapper = mount(PolicyNativeEvidenceRecovery, {
      props: {
        recovery: buildRecovery({
          statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.WORKFLOW_UNAVAILABLE,
          heading: 'Library evidence is unavailable',
          message: 'Check the evidence again before creating this policy.',
          actionId: POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.RELOAD_WORKFLOW,
          actionLabel: 'Try evidence check again',
          busyLabel: 'Checking library evidence...',
        }),
      },
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('reload-workflow')).toHaveLength(1)
    expect(wrapper.emitted('refresh-profile')).toBeUndefined()

    await wrapper.setProps({ refreshing: true })
    expect(wrapper.text()).toContain('Checking library evidence...')
    expect(wrapper.text()).not.toContain('Refreshing library profile...')
  })
})
