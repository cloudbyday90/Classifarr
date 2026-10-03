/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ManualRoutingBackground from '@/components/history/ManualRoutingBackground.vue'
const { getManualRoutingBackground, setManualRoutingBackground } = vi.hoisted(() => ({
  getManualRoutingBackground: vi.fn(), setManualRoutingBackground: vi.fn(),
}))
vi.mock('@/api', () => ({ default: { getManualRoutingBackground, setManualRoutingBackground } }))
beforeEach(() => {
  vi.resetAllMocks()
  getManualRoutingBackground.mockResolvedValue({ enabled: false, attempts: 0, lastResult: 'off' })
})
async function open(wrapper) {
  wrapper.find('details').element.open = true
  await wrapper.find('details').trigger('toggle'); await flushPromises()
}
it('mounting does nothing; opening fetches local status but never enables checks', async () => {
  const wrapper = mount(ManualRoutingBackground, { props: { classificationId: 12 } })
  expect(getManualRoutingBackground).not.toHaveBeenCalled()
  await open(wrapper)
  expect(getManualRoutingBackground).toHaveBeenCalledWith(12)
  expect(wrapper.text()).toContain('Off · 0 of 3')
  expect(setManualRoutingBackground).not.toHaveBeenCalled()
  wrapper.unmount()
})
it('explicit enable and disable controls announce their outcome', async () => {
  const wrapper = mount(ManualRoutingBackground, { props: { classificationId: 12 } })
  await open(wrapper)
  setManualRoutingBackground.mockResolvedValueOnce({ data: { enabled: true, attempts: 0 } })
  await wrapper.findAll('button')[0].trigger('click'); await flushPromises()
  expect(setManualRoutingBackground).toHaveBeenCalledWith(12, true)
  expect(wrapper.find('[role="status"]').text()).toContain('enabled for this item')
  setManualRoutingBackground.mockResolvedValueOnce({ data: { enabled: false, attempts: 0 } })
  await wrapper.findAll('button')[0].trigger('click'); await flushPromises()
  expect(setManualRoutingBackground).toHaveBeenLastCalledWith(12, false)
  expect(wrapper.find('[role="status"]').text()).toContain('already started check may finish')
  wrapper.unmount()
})
it('exhausted automatic budget cannot be re-enabled in the UI', async () => {
  getManualRoutingBackground.mockResolvedValue({ enabled: false, attempts: 3 })
  const wrapper = mount(ManualRoutingBackground, { props: { classificationId: 12 } })
  await open(wrapper)
  expect(wrapper.findAll('button')[0].attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('Automatic limit reached')
  wrapper.unmount()
})
it.each([[403, 'administrator'], [409, 'no longer eligible'], [429, 'Wait a minute'], [500, 'Refresh before']])('safe failed mutation feedback (%s)', async (status, message) => {
  const wrapper = mount(ManualRoutingBackground, { props: { classificationId: 12 } })
  await open(wrapper)
  setManualRoutingBackground.mockRejectedValue({ response: { status, data: { message: 'private secret' } } })
  await wrapper.findAll('button')[0].trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain(message)
  expect(wrapper.text()).not.toContain('private secret')
  expect(wrapper.text()).not.toContain('Enable checks for this item')
  wrapper.unmount()
})
it('failed status load does not assume disabled state or permit a blind write', async () => {
  getManualRoutingBackground.mockRejectedValue(new Error('secret'))
  const wrapper = mount(ManualRoutingBackground, { props: { classificationId: 12 } })
  await open(wrapper)
  expect(wrapper.text()).toContain('Refresh before')
  expect(wrapper.text()).not.toContain('Enable checks for this item')
  wrapper.unmount()
})
it('refresh explains the saved outcome and only shows a valid due time while enabled', async () => {
  getManualRoutingBackground.mockResolvedValue({ enabled: true, attempts: 1, lastResult: 'not_present', nextCheckAt: '2026-10-03T12:00:00Z' })
  const wrapper = mount(ManualRoutingBackground, { props: { classificationId: 12 } })
  await open(wrapper)
  expect(wrapper.text()).toContain('Not found yet')
  expect(wrapper.text()).toContain('Next eligible check:')
  getManualRoutingBackground.mockResolvedValue({ enabled: false, attempts: 2, lastResult: 'verified_present' })
  await wrapper.findAll('button')[1].trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Found in the saved destination')
  expect(wrapper.text()).not.toContain('Next eligible check:')
  expect(setManualRoutingBackground).not.toHaveBeenCalled()
  wrapper.unmount()
})

it.each(['provider_auth_required', 'provider_configuration_required', 'provider_paused'])(
  '%s clearly distinguishes a provider pause from item exhaustion', async reason => {
    getManualRoutingBackground.mockResolvedValue({ enabled: true, attempts: 0, lastResult: 'unavailable',
      nextCheckAt: '2026-10-03T12:00:00Z', provider: { reason, nextCheckAt: '2026-10-03T13:00:00Z' } })
    const wrapper = mount(ManualRoutingBackground, { props: { classificationId: 12 } })
    await open(wrapper)
    expect(wrapper.text()).toContain('Paused · 0 of 3')
    expect(wrapper.text()).not.toContain('Automatic limit reached')
    expect(wrapper.find('[role="status"]').text()).toContain(reason === 'provider_paused' ? 'allowance is preserved' : 'use Check routing')
    expect(wrapper.text().includes('Next eligible check:')).toBe(reason === 'provider_paused')
    expect(wrapper.text().includes('Manual recheck after:')).toBe(reason !== 'provider_paused')
    expect(setManualRoutingBackground).not.toHaveBeenCalled()
    wrapper.unmount()
  })
