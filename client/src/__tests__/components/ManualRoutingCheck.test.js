/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ManualRoutingCheck from '@/components/history/ManualRoutingCheck.vue'
const { checkManualRouting } = vi.hoisted(() => ({ checkManualRouting: vi.fn() }))
vi.mock('@/api', () => ({ default: { checkManualRouting } }))
const props = { classificationId: 12, details: { manual_routing_intent: { version: 1 } } }
beforeEach(() => vi.clearAllMocks())

it('never checks on mount; legacy records cannot fabricate an intent', () => {
  const wrapper = mount(ManualRoutingCheck, { props: { ...props, details: {} } })
  expect(wrapper.find('button').exists()).toBe(false)
  expect(wrapper.text()).toContain('No saved destination')
  expect(checkManualRouting).not.toHaveBeenCalled()
  wrapper.unmount()
})
it('announces progress and saved observation, with no duplicate clicks or automatic refresh', async () => {
  let finish
  checkManualRouting.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const wrapper = mount(ManualRoutingCheck, { props })
  await wrapper.find('button').trigger('click')
  expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  expect(wrapper.find('[role="status"]').text()).toContain('Checking')
  await wrapper.find('button').trigger('click')
  expect(checkManualRouting).toHaveBeenCalledTimes(1)
  finish({ data: { reason: 'verified_present', message: 'Found. This does not prove which request added it.', checkedAt: '2026-10-03T12:00:00Z' } })
  await flushPromises()
  expect(wrapper.find('[role="status"]').text()).toContain('does not prove')
  expect(wrapper.text()).toContain('Last checked:')
  expect(checkManualRouting).toHaveBeenCalledWith(12)
  wrapper.unmount()
})
it.each([[403, 'administrator'], [429, 'limit'], [500, 'Try again later']])('safe feedback for HTTP %s', async (status, text) => {
  checkManualRouting.mockRejectedValue({ response: { status, data: { error: 'private key' } } })
  const wrapper = mount(ManualRoutingCheck, { props })
  await wrapper.find('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain(text); expect(wrapper.text()).not.toContain('private key')
  wrapper.unmount()
})
it('shows persisted observations after reload without treating them as routing success', () => {
  const wrapper = mount(ManualRoutingCheck, { props: { ...props, details: { ...props.details,
    manual_routing_observation: { reason: 'verified_present', checkedAt: '2026-10-03T12:00:00Z' } } } })
  expect(wrapper.text()).toContain('does not prove which request added it')
  expect(wrapper.text()).toContain('Last checked:')
  expect(checkManualRouting).not.toHaveBeenCalled()
  wrapper.unmount()
})
