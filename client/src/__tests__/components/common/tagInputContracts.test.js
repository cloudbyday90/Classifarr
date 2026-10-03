/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import TagInput from '@/components/common/TagInput.vue'

let wrapper, host
afterEach(() => {
  wrapper?.unmount()
  host?.remove()
})

function editor(props = {}, attrs = {}, disabledFieldset = false) {
  host = document.createElement('fieldset')
  host.disabled = disabledFieldset
  document.body.append(host)
  wrapper = mount(TagInput, {
    attachTo: host,
    props: {
      label: 'Keywords', modelValue: ['first', 'last'],
      'onUpdate:modelValue': value => wrapper.setProps({ modelValue: value }),
      ...props,
    },
    attrs,
  })
  return wrapper.find('input')
}

describe('TagInput contracts', () => {
  it('preserves exact strings, immutable arrays and case-sensitive deduplication', async () => {
    const initial = Object.freeze(['First'])
    const input = editor({ modelValue: initial })
    await input.setValue('  first,<img src=x onerror=alert(1)>  ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(initial).toEqual(['First'])
    expect(wrapper.emitted('update:modelValue')).toEqual([[['First', 'first,<img src=x onerror=alert(1)>']]])
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toBe('Tag added. 2 total.')
    await input.setValue('First')
    await wrapper.get('[aria-label="Add tag to Keywords"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    expect(input.element.value).toBe('')
    expect(wrapper.get('[role="status"]').text()).toBe('That tag is already added.')
  })

  it('merges caller descriptions and listeners on the native entry exactly once', async () => {
    const onInput = vi.fn(), onKeydown = vi.fn()
    const input = editor({ error: 'Review tags', hint: 'One at a time' }, {
      'aria-describedby': 'external-help', onInput, onKeydown,
    })
    const ids = input.attributes('aria-describedby').split(' ')
    expect(ids[0]).toBe('external-help')
    expect(ids.slice(1).map(id => document.getElementById(id).textContent)).toEqual(['One at a time', 'Review tags'])
    expect(input.attributes('aria-invalid')).toBe('true')
    await input.setValue('next')
    await input.trigger('keydown', { key: 'Enter' })
    expect(onInput).toHaveBeenCalledTimes(1)
    expect(onKeydown).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    await wrapper.setProps({ hint: '', error: '' })
    expect(input.attributes('aria-describedby')).toBe('external-help')
    expect(input.attributes('aria-invalid')).toBeUndefined()
    expect(ids.slice(1).every(id => !document.getElementById(id))).toBe(true)
  })

  it.each(['disabled', 'readonly', 'fieldset'])('blocks every mutation path when %s', async mode => {
    const input = editor(mode === 'fieldset' ? {} : { [mode]: true }, {}, mode === 'fieldset')
    // Dispatch directly: disabled native controls normally suppress user events.
    input.element.value = 'unexpected'
    for (const event of [new Event('input', { bubbles: true }), new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }), new FocusEvent('focusout', { bubbles: true })]) {
      input.element.dispatchEvent(event)
    }
    for (const button of wrapper.findAll('button')) button.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.props('modelValue')).toEqual(['first', 'last'])
    expect(wrapper.findAll('button').every(button => button.attributes('type') === 'button')).toBe(true)
  })

  it.each([
    { repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true },
    { isComposing: true }, { keyCode: 229 },
  ])('ignores unsafe add/remove key events %j', async options => {
    const input = editor()
    await input.trigger('keydown', { key: 'Backspace', ...options })
    await input.setValue('draft')
    await input.trigger('keydown', { key: 'Enter', ...options })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(input.element.value).toBe('draft')
  })

  it('leaves text Backspace native and cancels Enter even for an empty draft', async () => {
    const input = editor()
    await input.setValue('draft')
    const backspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })
    input.element.dispatchEvent(backspace)
    expect(backspace.defaultPrevented).toBe(false)
    await input.setValue('')
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    input.element.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('waits for composition to finish before accepting a tag', async () => {
    const input = editor()
    await input.trigger('compositionstart')
    await input.setValue('日本')
    await input.trigger('keydown', { key: 'Enter' })
    await wrapper.get('[aria-label="Remove last from Keywords"]').trigger('click')
    await wrapper.get('[aria-label="Add tag to Keywords"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await input.trigger('compositionend')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toEqual([[['first', 'last', '日本']]])
  })

  it('commits final composition text once when focus has left the editor', async () => {
    const input = editor()
    input.element.focus()
    await input.trigger('compositionstart')
    await input.setValue('日本')
    input.element.blur()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    input.element.value = '日本語'
    await input.trigger('compositionend')
    await input.trigger('focusout')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['first', 'last', '日本語']]])
  })

  it('does not carry a pending composition commit through locking', async () => {
    const input = editor()
    await input.trigger('compositionstart')
    await input.setValue('draft')
    await input.trigger('focusout')
    await wrapper.setProps({ readonly: true })
    await input.trigger('compositionend')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.setProps({ readonly: false })
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toEqual([[['first', 'last', 'draft']]])
  })

  it('does not resurrect a committed draft when final input follows compositionend', async () => {
    const input = editor()
    input.element.focus()
    input.element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    input.element.value = '日本語'
    input.element.dispatchEvent(new Event('input', { bubbles: true }))
    input.element.blur()
    input.element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    input.element.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toEqual([[['first', 'last', '日本語']]])
    expect(input.element.value).toBe('')
  })

  it('keeps the draft when focus returns to an internal button before composition ends', async () => {
    const input = editor()
    input.element.focus()
    await input.trigger('compositionstart')
    await input.setValue('日本語')
    input.element.blur()
    wrapper.get('[aria-label="Add tag to Keywords"]').element.focus()
    await input.trigger('compositionend')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(input.element.value).toBe('日本語')
  })

  it('keeps drafts during internal focus moves and restores focus before removal', async () => {
    const input = editor()
    input.element.focus()
    await input.setValue('draft')
    const remove = wrapper.get('[aria-label="Remove first from Keywords"]')
    remove.element.focus()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await remove.trigger('click')
    expect(document.activeElement).toBe(input.element)
    expect(input.element.value).toBe('draft')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['last']]])
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')[1]).toEqual([['last', 'draft']])
  })

  it('reads parent replacements and preserves single-last removal for legacy duplicates', async () => {
    const input = editor()
    await input.setValue('draft')
    await wrapper.setProps({ modelValue: ['replacement', 'replacement'] })
    await input.setValue('')
    await input.trigger('keydown', { key: 'Backspace' })
    expect(wrapper.emitted('update:modelValue')).toEqual([[['replacement']]])
  })
})
