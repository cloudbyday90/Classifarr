/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TagInput from '@/components/common/TagInput.vue'

function mountInput(props = {}) {
  return mount(TagInput, {
    props: {
      modelValue: [],
      'onUpdate:modelValue': (e) => wrapper?.setProps({ modelValue: e }),
      ...props
    }
  })
}

let wrapper

describe('TagInput.vue', () => {
  beforeEach(() => {
    wrapper = null
  })

  describe('rendering', () => {
    it('shows placeholder when no tags', () => {
      wrapper = mountInput({ placeholder: 'Add tag...' })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Add tag...')
    })

    it('hides placeholder when tags exist', () => {
      wrapper = mountInput({ modelValue: ['vue'] })
      expect(wrapper.find('input').attributes('placeholder')).toBe('')
    })

    it('renders existing tags', () => {
      wrapper = mountInput({ modelValue: ['vue', 'react'] })
      const tags = wrapper.findAll('span.inline-flex')
      expect(tags.length).toBe(2)
      expect(tags[0].text()).toContain('vue')
      expect(tags[1].text()).toContain('react')
    })

    it('shows label when provided', () => {
      wrapper = mountInput({ label: 'Keywords' })
      expect(wrapper.text()).toContain('Keywords')
    })

    it('hides label when not provided', () => {
      wrapper = mountInput()
      expect(wrapper.find('label').exists()).toBe(false)
    })

    it('uses default placeholder', () => {
      wrapper = mountInput()
      expect(wrapper.find('input').attributes('placeholder')).toBe('Type and press Enter...')
    })
  })

  describe('adding tags', () => {
    it('adds tag on Enter key', async () => {
      wrapper = mountInput()
      const input = wrapper.find('input')
      await input.setValue('test')
      await input.trigger('keydown.enter')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['test'])
    })

    it('adds tag on blur', async () => {
      wrapper = mountInput()
      const input = wrapper.find('input')
      await input.setValue('blur-tag')
      await input.trigger('blur')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['blur-tag'])
    })

    it('trims whitespace before adding', async () => {
      wrapper = mountInput()
      const input = wrapper.find('input')
      await input.setValue('  spaced  ')
      await input.trigger('keydown.enter')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['spaced'])
    })

    it('clears input after adding', async () => {
      wrapper = mountInput()
      const input = wrapper.find('input')
      await input.setValue('tag')
      await input.trigger('keydown.enter')
      expect(input.element.value).toBe('')
    })

    it('does not add empty tag', async () => {
      wrapper = mountInput()
      await wrapper.find('input').trigger('keydown.enter')
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })

    it('does not add whitespace-only tag', async () => {
      wrapper = mountInput()
      await wrapper.find('input').setValue('   ')
      await wrapper.find('input').trigger('keydown.enter')
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })

    it('does not add duplicate tag', async () => {
      wrapper = mountInput({ modelValue: ['vue'] })
      const input = wrapper.find('input')
      await input.setValue('vue')
      await input.trigger('keydown.enter')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })

    it('appends to existing tags', async () => {
      wrapper = mountInput({ modelValue: ['first'] })
      const input = wrapper.find('input')
      await input.setValue('second')
      await input.trigger('keydown.enter')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['first', 'second'])
    })
  })

  describe('removing tags', () => {
    it('removes tag when × button is clicked', async () => {
      wrapper = mountInput({ modelValue: ['keep', 'remove'] })
      const tagSpans = wrapper.findAll('span.inline-flex')
      const removeIndex = tagSpans.findIndex(s => s.text().includes('remove'))
      await tagSpans[removeIndex].find('button').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['keep'])
    })

    it('removes last tag on Backspace when input is empty', async () => {
      wrapper = mountInput({ modelValue: ['a', 'b'] })
      const input = wrapper.find('input')
      await input.trigger('keydown.backspace')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')[0][0]).toEqual(['a'])
    })

    it('does not remove tag on Backspace when input has text', async () => {
      wrapper = mountInput({ modelValue: ['tag'] })
      const input = wrapper.find('input')
      await input.setValue('typing')
      await input.trigger('keydown.backspace')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })

    it('does not remove tag on Backspace when no tags exist', async () => {
      wrapper = mountInput()
      await wrapper.find('input').trigger('keydown.backspace')
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })
  })

  describe('focus behavior', () => {
    it('focuses input when container is clicked', async () => {
      wrapper = mountInput()
      const input = wrapper.find('input')
      const focusSpy = vi.spyOn(input.element, 'focus')
      await wrapper.find('div.min-h-\\[42px\\]').trigger('click')
      expect(focusSpy).toHaveBeenCalled()
    })
  })
})
