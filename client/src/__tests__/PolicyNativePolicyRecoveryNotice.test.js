/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyNativePolicyRecoveryNotice from '@/components/policies/PolicyNativePolicyRecoveryNotice.vue'

describe('PolicyNativePolicyRecoveryNotice.vue', () => {
  it('communicates server-owned recovery without exposing a repair control', () => {
    const wrapper = mount(PolicyNativePolicyRecoveryNotice)

    expect(wrapper.find('section').attributes('aria-labelledby')).toBe('policy-native-recovery-title')
    expect(wrapper.find('#policy-native-recovery-title').text()).toBe('Native policy recovery in progress')
    expect(wrapper.find('[role="status"]').attributes('aria-atomic')).toBe('true')
    expect(wrapper.text()).toContain('server-owned reconciliation')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
