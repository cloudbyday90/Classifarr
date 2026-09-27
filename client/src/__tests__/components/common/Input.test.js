/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import Input from '@/components/common/Input.vue'

it('connects visible labels to distinct input IDs while preserving editing', async () => {
  const wrapper = mount({ components: { Input }, template: '<div><Input label="Priority" type="number" /><Input label="Name" /></div>' })
  const inputs = wrapper.findAll('input'), labels = wrapper.findAll('label')
  expect(inputs[0].attributes('id')).not.toBe(inputs[1].attributes('id'))
  for (let index = 0; index < inputs.length; index++) expect(labels[index].attributes('for')).toBe(inputs[index].attributes('id'))
  await inputs[0].setValue('42')
  expect(wrapper.findComponent(Input).emitted('update:modelValue')).toEqual([['42']])
  wrapper.unmount()
})
