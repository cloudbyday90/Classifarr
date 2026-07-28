/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyNativeProfileRecoveryStatus from '@/components/policies/PolicyNativeProfileRecoveryStatus.vue'

describe('PolicyNativeProfileRecoveryStatus.vue', () => {
  it('presents queued recovery as a read-only polite status message', () => {
    const wrapper = mount(PolicyNativeProfileRecoveryStatus, {
      props: {
        recovery: {
          stateId: 'queued',
          label: 'Recovery queued',
          message: 'Classifarr has queued an automatic library-profile refresh. No action is needed.',
        },
      },
    })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-live')).toBe('polite')
    expect(wrapper.attributes('aria-atomic')).toBe('true')
    expect(wrapper.text()).toContain('Profile recovery')
    expect(wrapper.text()).toContain('Recovery queued')
    expect(wrapper.text()).toContain('No action is needed.')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('marks a current profile with the success tone', () => {
    const wrapper = mount(PolicyNativeProfileRecoveryStatus, {
      props: {
        recovery: {
          stateId: 'not_required',
          label: 'Profile current',
          message: 'No automatic profile recovery is needed.',
        },
      },
    })

    expect(wrapper.classes()).toContain('border-green-800/70')
  })

  it('presents an automatic circuit cooldown without a retry or reset control', () => {
    const wrapper = mount(PolicyNativeProfileRecoveryStatus, {
      props: {
        recovery: {
          stateId: 'awaiting_automatic_probe',
          label: 'Recovery awaiting automatic probe',
          message: 'Classifarr is waiting before its next automatic profile recovery check. No action is needed.',
        },
      },
    })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-atomic')).toBe('true')
    expect(wrapper.classes()).toContain('border-amber-800/70')
    expect(wrapper.text()).toContain('Recovery awaiting automatic probe')
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).not.toMatch(/failure|outbox|retry|reset|\d{4}-\d{2}-\d{2}/i)
  })
})
