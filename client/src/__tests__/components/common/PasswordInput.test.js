/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'
import PasswordInput from '@/components/common/PasswordInput.vue'

const wrappers = []
function render(options = {}) {
  const wrapper = mount(PasswordInput, options)
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.restoreAllMocks()
})

describe('PasswordInput', () => {
  test('starts masked and exposes named, non-submitting reveal/hide commands', async () => {
    const wrapper = render({ props: { modelValue: 'dummy-only', label: 'Provider key' } })
    const input = wrapper.get('input')
    const button = wrapper.get('button')
    expect(input.attributes()).toMatchObject({ type: 'password', autocomplete: 'off', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'none', 'data-lpignore': 'true', 'data-1pass-no-save': 'true' })
    expect(button.attributes()).toMatchObject({ type: 'button', 'aria-label': 'Show Provider key', 'aria-controls': input.attributes('id') })
    expect(button.attributes('aria-pressed')).toBeUndefined()
    await button.trigger('click')
    expect(input.attributes('type')).toBe('text')
    expect(button.attributes('aria-label')).toBe('Hide Provider key')
    expect(button.text()).toBe('Hide')
    await button.trigger('click')
    expect(input.attributes('type')).toBe('password')
    expect(input.element.value).toBe('dummy-only')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test('preserves symbols and spaces and merges native/model listeners exactly once', async () => {
    const onInput = vi.fn(), onUpdate = vi.fn()
    const wrapper = render({ attrs: { onInput, 'onUpdate:modelValue': onUpdate, required: true, name: 'credential' } })
    expect(onInput).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
    await wrapper.get('input').setValue('  dummy<&"é🔑  ')
    expect(onInput).toHaveBeenCalledTimes(1)
    expect(onInput.mock.calls[0][0]).toBeInstanceOf(Event)
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('  dummy<&"é🔑  ')
    await wrapper.get('input').setValue('')
    expect(onUpdate).toHaveBeenLastCalledWith('')
    expect(wrapper.get('input').element.validity.valueMissing).toBe(true)
    expect(wrapper.get('input').attributes('name')).toBe('credential')
    expect(wrapper.get('input').attributes('maxlength')).toBeUndefined()
  })

  test('keeps masking and spelling protections even when conflicting attrs are passed', async () => {
    const wrapper = render({ props: { modelValue: 'dummy', autocomplete: 'current-password' }, attrs: { type: 'text', value: 'other', spellcheck: true, autocorrect: 'on', autocapitalize: 'sentences' } })
    const input = wrapper.get('input')
    expect(input.attributes()).toMatchObject({ type: 'password', autocomplete: 'current-password', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'none' })
    expect(input.element.value).toBe('dummy')
    await wrapper.get('button').trigger('click')
    expect(input.attributes('spellcheck')).toBe('false')
  })

  test('links escaped hints/errors, deduplicates IDs and restores external descriptions', async () => {
    const wrapper = render({ props: { hint: '<b>Help</b>', error: '<img src=x>' }, attrs: { 'aria-describedby': 'external external', 'aria-invalid': 'grammar' } })
    const input = wrapper.get('input')
    const hintId = wrapper.get('.text-xs').attributes('id')
    const errorId = wrapper.get('.text-red-400').attributes('id')
    expect(input.attributes('aria-describedby')).toBe(`external ${hintId} ${errorId}`)
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('b, img').exists()).toBe(false)
    await wrapper.setProps({ id: 'renamed', error: '', 'aria-describedby': 'changed' })
    expect(wrapper.get('.text-xs').attributes('id')).toBe(hintId)
    expect(input.attributes('aria-describedby')).toBe(`changed ${hintId}`)
    expect(input.attributes('aria-invalid')).toBe('grammar')
    expect(wrapper.get('button').attributes('aria-controls')).toBe('renamed')
    await wrapper.setProps({ hint: '', 'aria-describedby': undefined, 'aria-invalid': undefined })
    expect(input.attributes('aria-describedby')).toBeUndefined()
    expect(input.attributes('aria-invalid')).toBeUndefined()
  })

  test('keeps hint-only fields valid and restores caller descriptions after clearing help', async () => {
    const wrapper = render({ props: { hint: 'Help' }, attrs: { 'aria-describedby': 'external external' } })
    expect(wrapper.get('input').attributes('aria-invalid')).toBeUndefined()
    await wrapper.setProps({ hint: '' })
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('external external')
  })

  test('uses changing external accessible names for visibility commands', async () => {
    const wrapper = render({ attrs: { 'aria-label': 'External key' } })
    expect(wrapper.get('button').attributes('aria-label')).toBe('Show External key')
    await wrapper.setProps({ 'aria-label': undefined, 'aria-labelledby': ' first second ' })
    const actionId = wrapper.get('button span').attributes('id')
    expect(wrapper.get('button').attributes('aria-labelledby')).toBe(`${actionId} first second`)
    expect(wrapper.get('button').attributes('aria-label')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button span').text()).toBe('Hide')
    await wrapper.setProps({ 'aria-labelledby': undefined })
    expect(wrapper.get('button').attributes('aria-labelledby')).toBeUndefined()
    expect(wrapper.get('button').attributes('aria-label')).toBe('Hide password')
  })

  test('generates distinct stable IDs for multiple password fields in one app', async () => {
    const wrapper = mount({ components: { PasswordInput }, data: () => ({ hint: 'Help' }), template: '<div><PasswordInput label="First" :hint="hint" error="Review" /><PasswordInput label="Second" :hint="hint" error="Review" /></div>' })
    wrappers.push(wrapper)
    const ids = wrapper.findAll('[id]').map(node => node.attributes('id'))
    expect(new Set(ids).size).toBe(ids.length)
    await wrapper.setData({ hint: 'Changed help' })
    expect(wrapper.findAll('[id]').map(node => node.attributes('id'))).toEqual(ids)
  })

  test('conceals on disabling and ignores synthetic reveal and input events', async () => {
    const wrapper = render({ props: { modelValue: 'dummy' } })
    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ disabled: true })
    wrapper.get('button').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    wrapper.get('input').element.dispatchEvent(new Event('input', { bubbles: true }))
    expect(wrapper.get('input').attributes('type')).toBe('password')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.setProps({ disabled: false })
    expect(wrapper.get('input').attributes('type')).toBe('password')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
  })

  test('allows readonly inspection without emitting synthetic edits', async () => {
    const wrapper = render({ props: { modelValue: 'dummy' }, attrs: { readonly: true } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    wrapper.get('input').element.dispatchEvent(new Event('input', { bubbles: true }))
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.setProps({ readonly: false })
    await wrapper.get('input').setValue('editable-dummy')
    expect(wrapper.emitted('update:modelValue')).toEqual([['editable-dummy']])
  })

  test('conceals synchronously on submit without cancelling or altering the value', async () => {
    const wrapper = mount({ components: { PasswordInput }, template: '<form><PasswordInput model-value="dummy" /></form>' })
    wrappers.push(wrapper)
    await wrapper.get('button').trigger('click')
    const form = wrapper.get('form').element
    const observed = vi.fn(() => expect(wrapper.get('input').element.type).toBe('password'))
    form.addEventListener('submit', observed)
    const event = new Event('submit', { bubbles: true, cancelable: true })
    expect(form.dispatchEvent(event)).toBe(true)
    expect(event.defaultPrevented).toBe(false)
    expect(observed).toHaveBeenCalledTimes(1)
    expect(wrapper.get('input').element.value).toBe('dummy')
    expect(wrapper.findComponent(PasswordInput).emitted('update:modelValue')).toBeUndefined()
    await wrapper.vm.$nextTick()
    expect(wrapper.get('button').attributes('aria-label')).toBe('Show password')
  })

  test('rebinds external forms on updates and removes owned listeners on unmount', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const wrapper = mount({ components: { PasswordInput }, data: () => ({ formId: 'first-form' }), template: '<div><form id="first-form" /><form id="second-form" /><PasswordInput :form="formId" /></div>' }, { attachTo: host })
    try {
      const [first, second] = wrapper.findAll('form').map(node => node.element)
      const firstRemove = vi.spyOn(first, 'removeEventListener')
      const secondAdd = vi.spyOn(second, 'addEventListener')
      const secondRemove = vi.spyOn(second, 'removeEventListener')
      await wrapper.setData({ formId: 'second-form' })
      expect(firstRemove).toHaveBeenCalledWith('submit', expect.any(Function), true)
      const listener = secondAdd.mock.calls.find(([type]) => type === 'submit')[1]
      await wrapper.get('button').trigger('click')
      first.dispatchEvent(new Event('submit'))
      expect(wrapper.get('input').element.type).toBe('text')
      second.dispatchEvent(new Event('submit'))
      expect(wrapper.get('input').element.type).toBe('password')
      wrapper.unmount()
      expect(secondRemove).toHaveBeenCalledWith('submit', listener, true)
    } finally {
      if (wrapper.exists()) wrapper.unmount()
      host.remove()
    }
  })
})
