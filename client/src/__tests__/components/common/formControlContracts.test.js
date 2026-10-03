/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import Input from '@/components/common/Input.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'
import Select from '@/components/common/Select.vue'
import Slider from '@/components/common/Slider.vue'
import Toggle from '@/components/common/Toggle.vue'

const controls = [
  { name: 'Input', component: Input, selector: 'input', event: 'input', props: {} },
  { name: 'PasswordInput', component: PasswordInput, selector: 'input', event: 'input', props: {} },
  { name: 'Select', component: Select, selector: 'select', event: 'change', props: { options: [{ label: 'One', value: 1 }] } },
  { name: 'Slider', component: Slider, selector: 'input', event: 'input', props: {} },
  { name: 'Toggle', component: Toggle, selector: 'button', event: 'click', props: {} },
]

describe.each(controls)('$name native control contract', ({ component, selector, event, props }) => {
  test('associates its label and forwards native attributes without moving layout styles', async () => {
    const onFocus = vi.fn()
    const wrapper = mount(component, {
      props: { ...props, label: 'Setting' },
      attrs: { id: 'setting', name: 'setting-name', 'aria-describedby': 'help', class: 'col-span-2', style: { marginTop: '8px' }, onFocus },
    })
    const control = wrapper.get(selector)
    expect(wrapper.get('label').attributes('for')).toBe('setting')
    expect(control.attributes()).toMatchObject({ id: 'setting', name: 'setting-name', 'aria-describedby': 'help' })
    expect(wrapper.attributes('id')).toBeUndefined()
    expect(wrapper.attributes('name')).toBeUndefined()
    expect(wrapper.classes()).toContain('col-span-2')
    expect(wrapper.attributes('style')).toContain('margin-top: 8px')
    expect(control.classes()).not.toContain('col-span-2')
    expect(control.attributes('style')).toBeUndefined()
    await control.trigger('focus')
    expect(onFocus).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  test('reads changed and removed attributes on each render', async () => {
    const wrapper = mount(component, { props: { ...props, label: 'Setting' }, attrs: { id: 'before', 'aria-label': 'Old name' } })
    await wrapper.setProps({ id: 'after', 'aria-label': 'New name' })
    expect(wrapper.get(selector).attributes('id')).toBe('after')
    expect(wrapper.get(selector).attributes('aria-label')).toBe('New name')
    expect(wrapper.get('label').attributes('for')).toBe('after')
    await wrapper.setProps({ id: undefined, 'aria-label': undefined })
    expect(wrapper.get(selector).attributes('id')).not.toBe('after')
    expect(wrapper.get(selector).attributes('aria-label')).toBeUndefined()
    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get(selector).attributes('id'))
    wrapper.unmount()
  })

  test('supports an external accessible name without a visible internal label', () => {
    const wrapper = mount(component, { props, attrs: { 'aria-labelledby': 'external-title' } })
    expect(wrapper.find('label').exists()).toBe(false)
    expect(wrapper.get(selector).attributes('aria-labelledby')).toBe('external-title')
    expect(wrapper.attributes('aria-labelledby')).toBeUndefined()
    wrapper.unmount()
  })

  test('does not emit model changes from a disabled control, even for dispatched events', () => {
    const wrapper = mount(component, { props: { ...props, disabled: true } })
    wrapper.get(selector).element.dispatchEvent(new Event(event, { bubbles: true }))
    expect(wrapper.get(selector).attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
})

test('generated IDs are distinct within one app and remain stable on updates', async () => {
  const wrapper = mount({ components: { Input, Select, Toggle, Slider }, data: () => ({ error: '' }), template: `
    <div><Input label="Name" :error="error" /><Select label="Choice" :options="[]" />
    <Toggle label="Enabled" /><Slider label="Threshold" /><Input label="Second name" /></div>`,
  })
  const fields = wrapper.findAll('input, select, button')
  const ids = fields.map(control => control.attributes('id'))
  expect(new Set(ids).size).toBe(5)
  expect(ids.every(Boolean)).toBe(true)
  for (const label of wrapper.findAll('label')) expect(ids).toContain(label.attributes('for'))
  await wrapper.setData({ error: 'Review the value' })
  expect(fields.map(control => control.attributes('id'))).toEqual(ids)
  wrapper.unmount()
})

test('Input links escaped errors without discarding caller descriptions or invalid state', async () => {
  const wrapper = mount(Input, { props: { error: '<img src=x onerror=alert(1)>' }, attrs: { 'aria-describedby': 'help help', 'aria-invalid': 'grammar' } })
  const error = wrapper.get('span.text-error')
  expect(wrapper.get('input').attributes('aria-describedby')).toBe(`help ${error.attributes('id')}`)
  expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
  expect(error.text()).toContain('<img')
  expect(wrapper.find('img').exists()).toBe(false)
  await wrapper.setProps({ error: '' })
  expect(wrapper.get('input').attributes('aria-describedby')).toBe('help help')
  expect(wrapper.get('input').attributes('aria-invalid')).toBe('grammar')
  expect(wrapper.find('span.text-error').exists()).toBe(false)
  wrapper.unmount()
})

test('Input keeps string emissions, empty editing, constraints and parent number/trim modifiers', async () => {
  const wrapper = mount({ components: { Input }, data: () => ({ count: 2, name: '' }), template: `
    <div><Input v-model.number="count" type="number" min="1" max="9" required />
    <Input v-model.trim="name" /></div>`,
  })
  const fields = wrapper.findAll('input')
  expect(fields[0].attributes()).toMatchObject({ min: '1', max: '9', required: '' })
  await fields[0].setValue('7')
  expect(wrapper.vm.count).toBe(7)
  // Vue applies the parent's modifier before delivering/recording the event.
  expect(wrapper.findComponent(Input).emitted('update:modelValue')).toEqual([[7]])
  await fields[0].setValue('')
  expect(wrapper.vm.count).toBe('')
  await fields[1].setValue('  title  ')
  expect(wrapper.vm.name).toBe('title')
  expect(wrapper.html()).not.toContain('modelmodifiers')
  wrapper.unmount()
})

test('Select preserves numeric initial values, string emissions and disabled placeholder', async () => {
  const wrapper = mount(Select, { props: { modelValue: 1, placeholder: 'Choose', options: [{ value: 1, label: 'One' }, { value: 2, label: 'Two' }] } })
  expect(wrapper.get('select').element.value).toBe('1')
  expect(wrapper.get('option[value=""]').attributes('disabled')).toBeDefined()
  await wrapper.get('select').setValue('2')
  expect(wrapper.emitted('update:modelValue')).toEqual([['2']])
  wrapper.unmount()
})

test('Slider emits finite fractional numbers, not strings', async () => {
  const wrapper = mount(Slider, { props: { modelValue: 1, min: 0, max: 2, step: 0.25, unit: '%' } })
  await wrapper.get('input').setValue('1.25')
  expect(wrapper.emitted('update:modelValue')).toEqual([[1.25]])
  await wrapper.setProps({ modelValue: 1.25 })
  expect(wrapper.text()).toContain('1.25%')
  wrapper.unmount()
})

test('Input merges the caller native listener with its model handler without duplication', async () => {
  const onInput = vi.fn()
  const onUpdate = vi.fn()
  const wrapper = mount(Input, { attrs: { onInput, 'onUpdate:modelValue': onUpdate } })
  try {
    expect(onInput).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
    await wrapper.get('input').setValue('text')
    expect(onInput).toHaveBeenCalledTimes(1)
    expect(onInput.mock.calls[0][0]).toBeInstanceOf(Event)
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('text')
  } finally {
    wrapper.unmount()
  }
})
