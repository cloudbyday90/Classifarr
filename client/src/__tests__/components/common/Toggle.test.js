/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Toggle from '@/components/common/Toggle.vue'

describe('Toggle.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders as a switch role', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false } })
      expect(wrapper.find('button').attributes('role')).toBe('switch')
    })

    it('sets aria-checked to true when modelValue is true', () => {
      const wrapper = mount(Toggle, { props: { modelValue: true } })
      expect(wrapper.find('button').attributes('aria-checked')).toBe('true')
    })

    it('sets aria-checked to false when modelValue is false', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false } })
      expect(wrapper.find('button').attributes('aria-checked')).toBe('false')
    })

    it('shows label when provided', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false, label: 'Enable' } })
      expect(wrapper.text()).toContain('Enable')
    })

    it('hides label when not provided', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false } })
      expect(wrapper.find('label').exists()).toBe(false)
    })

    it('applies primary background when enabled (true)', () => {
      const wrapper = mount(Toggle, { props: { modelValue: true } })
      expect(wrapper.find('button').classes()).toContain('bg-primary')
    })

    it('applies gray background when disabled (false)', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false } })
      expect(wrapper.find('button').classes()).toContain('bg-gray-600')
    })

    it('translates knob right when enabled', () => {
      const wrapper = mount(Toggle, { props: { modelValue: true } })
      const knob = wrapper.find('span.inline-block')
      expect(knob.classes()).toContain('translate-x-6')
    })

    it('translates knob left when disabled', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false } })
      const knob = wrapper.find('span.inline-block')
      expect(knob.classes()).toContain('translate-x-1')
    })
  })

  describe('interaction', () => {
    it('emits update:modelValue with true when clicked from false', async () => {
      const wrapper = mount(Toggle, { props: { modelValue: false } })
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([true])
    })

    it('emits update:modelValue with false when clicked from true', async () => {
      const wrapper = mount(Toggle, { props: { modelValue: true } })
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })
  })

  describe('disabled state', () => {
    it('disables button when disabled prop is true', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false, disabled: true } })
      expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    })

    it('does not disable button when disabled prop is false', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false, disabled: false } })
      expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    })

    it('applies disabled opacity class', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false, disabled: true } })
      expect(wrapper.find('button').classes()).toContain('disabled:opacity-50')
    })

    it('applies muted label styling when disabled', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false, disabled: true, label: 'Test' } })
      const label = wrapper.find('label')
      expect(label.classes()).toContain('text-gray-500')
    })

    it('applies normal label styling when enabled', () => {
      const wrapper = mount(Toggle, { props: { modelValue: false, disabled: false, label: 'Test' } })
      const label = wrapper.find('label')
      expect(label.classes()).toContain('text-gray-200')
    })
  })

  describe('defaults', () => {
    it('defaults modelValue to false', () => {
      const wrapper = mount(Toggle)
      expect(wrapper.find('button').attributes('aria-checked')).toBe('false')
    })

    it('defaults disabled to false', () => {
      const wrapper = mount(Toggle)
      expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    })
  })
})
