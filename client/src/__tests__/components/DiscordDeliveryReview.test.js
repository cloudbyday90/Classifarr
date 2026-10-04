/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DiscordDeliveryReview from '../../components/settings/DiscordDeliveryReview.vue'
import { getDiscordDeliveries, verifyDiscordDelivery } from '../../api/settingsNotificationsApi'

vi.mock('../../api/settingsNotificationsApi', () => ({ getDiscordDeliveries: vi.fn(), verifyDiscordDelivery: vi.fn() }))
let wrapper
const item = (id, state) => ({ classificationId: String(id), title: `Film ${id}`, state,
  channelId: '222222222222222222', kind: 'pending', createdAt: '2026-10-04T10:00:00Z', updatedAt: '2026-10-04T10:00:00Z' })
const click = async text => {
  await wrapper.findAll('button').find(button => button.text() === text).trigger('click')
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  wrapper = mount(DiscordDeliveryReview)
})
afterEach(() => wrapper.unmount())

describe('Discord delivery review', () => {
  it('distinguishes deferred from uncertain and does not offer verification or pretend a replay is scheduled', async () => {
    getDiscordDeliveries.mockResolvedValue({ items: [item(9, 'deferred')], nextBefore: null })
    await click('Load delivery records')
    expect(wrapper.findAll('dl')[0].text()).toContain('Deferred1')
    expect(wrapper.findAll('dl')[0].text()).toContain('Unconfirmed0')
    expect(wrapper.text()).toContain('Not sent; no retry is scheduled.')
    expect(wrapper.findAll('form')).toHaveLength(0)
  })
  it('shows verification only for explicitly eligible receipts', async () => {
    getDiscordDeliveries.mockResolvedValue({ items: [
      { ...item(4, 'uncertain'), canVerify: true }, item(3, 'uncertain'),
      { ...item(2, 'rejected'), canVerify: false }, item(1, 'delivered'),
    ], nextBefore: null })
    await click('Load delivery records')
    expect(wrapper.findAll('form')).toHaveLength(1)
    verifyDiscordDelivery.mockResolvedValue({ data: { code: 'confirmed', messageId: '333333333333333333' } })
    await wrapper.get('input').setValue('333333333333333333')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.findAll('dl')[0].text()).toContain('Delivered2')
    expect(wrapper.findAll('dl')[0].text()).toContain('Unconfirmed1')
    expect(wrapper.findAll('form')).toHaveLength(1)
    expect(getDiscordDeliveries).toHaveBeenCalledTimes(1)
  })
  it('does no work until requested and explains limited receipt coverage', async () => {
    expect(getDiscordDeliveries).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Older messages without receipts')
    getDiscordDeliveries.mockResolvedValue({ items: [], nextBefore: null })
    await click('Load delivery records')
    expect(wrapper.text()).toContain('No delivery records on this page.')
    expect(wrapper.get('[role="status"]').text()).toBe('0 delivery records loaded.')
    expect(wrapper.findAll('button').at(-1).attributes('disabled')).toBeDefined()
  })

  it('counts the displayed sample and treats sending/unknown as unconfirmed', async () => {
    const items = [item(5, 'delivered'), item(4, 'sending'), item(3, 'uncertain'), item(2, 'rejected'), item(1, 'future')]
    items[0].messageId = '333333333333333333'
    items[1].title = '<img src=x onerror=alert(1)>'
    items[2].title = ''
    items[2].createdAt = 'invalid'
    getDiscordDeliveries.mockResolvedValue({ items, nextBefore: null })
    await click('Load delivery records')
    const counts = wrapper.findAll('dl').at(0)
    expect(counts.text()).toContain('Delivered1')
    expect(counts.text()).toContain('Unconfirmed3')
    expect(counts.text()).toContain('Rejected1')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('Untitled classification')
    expect(wrapper.text()).toContain('Unavailable')
    expect(wrapper.text()).toContain('333333333333333333')
    expect(wrapper.text()).toContain('do not resend')
  })

  it('pages with exact cursors, refreshes current page and returns to newest', async () => {
    getDiscordDeliveries.mockResolvedValue({ items: [item(99, 'delivered')], nextBefore: '99' })
    await click('Load delivery records')
    getDiscordDeliveries.mockResolvedValue({ items: [item(98, 'uncertain')], nextBefore: null })
    await click('Older classifications')
    expect(getDiscordDeliveries).toHaveBeenLastCalledWith('99', expect.any(AbortSignal))
    await click('Refresh records')
    expect(getDiscordDeliveries).toHaveBeenLastCalledWith('99', expect.any(AbortSignal))
    await click('Newest classifications')
    expect(getDiscordDeliveries).toHaveBeenLastCalledWith(null, expect.any(AbortSignal))
  })

  it('preserves records on failure, hides private errors and has no automatic retry', async () => {
    getDiscordDeliveries.mockRejectedValue(new Error('private-body'))
    await click('Load delivery records')
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load')
    expect(wrapper.text()).not.toContain('private-body')
    expect(getDiscordDeliveries).toHaveBeenCalledTimes(1)
    getDiscordDeliveries.mockResolvedValue({ items: [item(1, 'sending')], nextBefore: null })
    await click('Load delivery records')
    getDiscordDeliveries.mockRejectedValue(new Error('private-body'))
    await click('Refresh records')
    expect(wrapper.get('[role="alert"]').text()).toContain('Showing the last loaded records')
    expect(wrapper.text()).toContain('Film 1')
    expect(wrapper.get('[role="status"]').text()).toBe('')
  })

  it.each([null, {}, { items: null, nextBefore: null }, { items: [], nextBefore: 'bad' },
    { items: [null], nextBefore: null }, { items: [item(0, 'sending')], nextBefore: null },
    { items: [{ ...item(1, 'sending'), title: {} }], nextBefore: null },
    { items: Array.from({ length: 26 }, (_, i) => item(i + 1, 'sending')), nextBefore: null },
  ])('rejects malformed data instead of presenting it as an empty success: %j', async result => {
    getDiscordDeliveries.mockResolvedValue(result)
    await click('Load delivery records')
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load')
    expect(wrapper.text()).not.toContain('No delivery records on this page.')
  })

  it.each(['resolve', 'reject'])('cancels on unmount and ignores a late %s', async outcome => {
    const deferred = Promise.withResolvers()
    getDiscordDeliveries.mockReturnValue(deferred.promise)
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('button').trigger('click')
    expect(getDiscordDeliveries).toHaveBeenCalledTimes(1)
    const signal = getDiscordDeliveries.mock.calls[0][1]
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    if (outcome === 'resolve') deferred.resolve({ items: [], nextBefore: null })
    else deferred.reject(new Error('cancelled'))
    await flushPromises()
  })
})
