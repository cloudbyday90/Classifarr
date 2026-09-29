/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import RetryReadinessOverview from '@/components/command-center/RetryReadinessOverview.vue'
const Summary = defineComponent({ props: { scope: { type: String, required: true }, initialPaused: Boolean }, emits: ['pause-change'], template: '<div />' })
it('mounts just the selected provider and carries pause across remounts', async () => {
  const wrapper = mount(RetryReadinessOverview, { global: { stubs: { RetryReadinessSummary: Summary } } })
  const first = wrapper.findComponent(Summary)
  expect(first.props('scope')).toBe('web_search')
  first.vm.$emit('pause-change', true); await wrapper.vm.$nextTick()
  await wrapper.get('select').setValue('omdb')
  expect(wrapper.findAllComponents(Summary)).toHaveLength(1)
  expect(wrapper.findComponent(Summary).vm).not.toBe(first.vm)
  expect(wrapper.findComponent(Summary).props()).toEqual({ scope: 'omdb', initialPaused: true })
  expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('select').attributes('id'))
  wrapper.unmount()
})
