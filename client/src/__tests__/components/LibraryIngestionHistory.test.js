/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LibraryIngestionHistory from '@/components/library/LibraryIngestionHistory.vue'

const historyRead = vi.hoisted(() => vi.fn())
vi.mock('@/api/libraryIngestionApi', () => ({ getLibraryIngestionHistory: historyRead }))
const receipt = { auditId: 42, requestId: '8ad60d36-4bfc-4330-9dd1-eaa35ce5a9f0',
  libraryId: 1, confirmedAt: '2026-09-30T12:00:00.000Z', replay: 'scheduled' }
const result = { receipts: [receipt], limit: 20, hasMore: false }
async function toggle(wrapper, open) {
  wrapper.get('details').element.open = open
  await wrapper.get('details').trigger('toggle'); await flushPromises()
}
beforeEach(() => {
  historyRead.mockReset().mockResolvedValue(structuredClone(result))
  localStorage.clear(); sessionStorage.clear()
})

it('identifies system recovery separately from personal confirmations without claiming completion', async () => {
  historyRead.mockResolvedValueOnce({ ...result, receipts: [{ ...receipt, automatic: true }] })
  const wrapper = mount(LibraryIngestionHistory, { props: { libraryId: 1 } })
  await toggle(wrapper, true)
  expect(wrapper.text()).toContain('Started automatically after blocking pre-upgrade writers.')
  expect(wrapper.text()).toContain('not a finished import')
  wrapper.unmount()
})

it('reads only on demand and rediscovers recorded requests on a new mount without saved approval', async () => {
  let wrapper = mount(LibraryIngestionHistory, { props: { libraryId: 1 } })
  await flushPromises(); expect(historyRead).not.toHaveBeenCalled()
  await toggle(wrapper, true)
  expect(historyRead).toHaveBeenCalledWith(1)
  expect(wrapper.get('[role=status]').text()).toContain('Recorded recoveries: 1')
  expect(wrapper.text()).toContain('Full import requested')
  expect(wrapper.text()).toContain(receipt.requestId)
  expect(wrapper.text()).toContain('not a finished import')
  expect(wrapper.find('input').exists()).toBe(false)
  expect(wrapper.findAll('button').map(button => button.text())).toEqual(['Refresh history'])
  wrapper.unmount()
  wrapper = mount(LibraryIngestionHistory, { props: { libraryId: 1 } })
  await toggle(wrapper, true)
  expect(wrapper.text()).toContain(receipt.requestId)
  expect(historyRead).toHaveBeenCalledTimes(2)
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0)
  wrapper.unmount()
})

it('labels maintenance-only history and truncation without presenting current state or automatic actions', async () => {
  historyRead.mockResolvedValueOnce({ ...result, hasMore: true, receipts: [{ ...receipt, replay: 'waiting_for_enable' }] })
  const wrapper = mount(LibraryIngestionHistory, { props: { libraryId: 1 } })
  await toggle(wrapper, true)
  expect(wrapper.text()).toContain('Library was left disabled')
  expect(wrapper.text()).toContain('newest 20 retained receipts')
  expect(wrapper.find('input').exists()).toBe(false)
  wrapper.unmount()
})

it('does not infer failure from empty or unavailable history and clears previously displayed receipts', async () => {
  const wrapper = mount(LibraryIngestionHistory, { props: { libraryId: 1 } })
  await toggle(wrapper, true)
  historyRead.mockResolvedValueOnce({ receipts: [], limit: 20, hasMore: false })
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('No retained recovery receipts found')
  expect(wrapper.text()).toContain('missing receipts do not prove a request failed')
  await wrapper.get('button').trigger('click'); await flushPromises()
  historyRead.mockRejectedValueOnce({ response: { status: 403 } })
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role=alert]').text()).toContain('active administrator session')
  expect(wrapper.text()).not.toContain(receipt.requestId)
  wrapper.unmount()
})

it.each(['success', 'failure'])('ignores obsolete %s after a closed disclosure is reopened', async outcome => {
  const old = Promise.withResolvers(), current = Promise.withResolvers()
  historyRead.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
  const wrapper = mount(LibraryIngestionHistory, { props: { libraryId: 1 } })
  await toggle(wrapper, true)
  expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  await wrapper.get('button').trigger('click')
  expect(historyRead).toHaveBeenCalledTimes(1)
  await toggle(wrapper, false); await toggle(wrapper, true)
  if (outcome === 'success') old.resolve(result)
  else old.reject(new Error('old failure'))
  await flushPromises()
  expect(wrapper.text()).not.toContain(receipt.requestId)
  expect(wrapper.find('[role=alert]').exists()).toBe(false)
  expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  current.resolve({ ...result, receipts: [{ ...receipt, auditId: 43 }] }); await flushPromises()
  expect(wrapper.text()).toContain('Receipt #43')
  wrapper.unmount()
})

it('invalidates history on A to B to A navigation and after unmount', async () => {
  const old = Promise.withResolvers()
  historyRead.mockReturnValueOnce(old.promise)
  const wrapper = mount(LibraryIngestionHistory, { props: { libraryId: 1 } })
  await toggle(wrapper, true)
  await wrapper.setProps({ libraryId: 2 }); await wrapper.setProps({ libraryId: 1 })
  old.resolve(result); await flushPromises()
  expect(wrapper.get('details').element.open).toBe(false)
  expect(wrapper.text()).not.toContain(receipt.requestId)
  const pending = Promise.withResolvers()
  historyRead.mockReturnValueOnce(pending.promise)
  await toggle(wrapper, true)
  wrapper.unmount(); pending.resolve(result); await flushPromises()
  expect(historyRead).toHaveBeenCalledTimes(2)
})
