/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import Badge from '@/components/common/Badge.vue'

test.each([
  ['default', 'text-gray-300'],
  ['success', 'text-success'],
  ['warning', 'text-warning'],
  ['error', 'text-error'],
  ['info', 'text-primary'],
  ['unrecognized-variant', 'text-gray-300'],
])('preserves the %s badge appearance and slot', (variant, expectedClass) => {
  const wrapper = mount(Badge, { props: { variant }, slots: { default: 'Status' } })
  expect(wrapper.classes()).toContain(expectedClass)
  expect(wrapper.text()).toBe('Status')
  wrapper.unmount()
})

test('keeps the default and reacts to variant changes', async () => {
  const wrapper = mount(Badge)
  expect(wrapper.classes()).toContain('text-gray-300')
  await wrapper.setProps({ variant: 'success' })
  expect(wrapper.classes()).toContain('text-success')
  expect(wrapper.classes()).not.toContain('text-gray-300')
  wrapper.unmount()
})
