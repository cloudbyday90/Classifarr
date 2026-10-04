/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DiscordDeliveryVerification from '../../components/settings/DiscordDeliveryVerification.vue'
import { verifyDiscordDelivery } from '../../api/settingsNotificationsApi'

vi.mock('../../api/settingsNotificationsApi', () => ({ verifyDiscordDelivery: vi.fn() }))
let wrapper
const messageId = '333333333333333333'
beforeEach(() => { vi.resetAllMocks(); wrapper = mount(DiscordDeliveryVerification, { props: { classificationId: '91' } }) })
afterEach(() => wrapper.unmount())
async function submit(value = messageId) {
  await wrapper.get('input').setValue(value)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

it('uses associated labels and does no work until a valid explicit submission', async () => {
  const id = wrapper.get('input').attributes('id')
  expect(wrapper.get('label').attributes('for')).toBe(id)
  expect(wrapper.get('input').attributes('aria-describedby')).toContain(`${id}-help`)
  expect(verifyDiscordDelivery).not.toHaveBeenCalled()
  await submit('https://discord.com/channels/1/2/3')
  expect(wrapper.get('[role="status"]').text()).toContain('not a link')
  expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
  expect(verifyDiscordDelivery).not.toHaveBeenCalled()
})
it('confirms once, keeps the action present and emits the saved message ID', async () => {
  verifyDiscordDelivery.mockResolvedValue({ data: { code: 'confirmed', messageId } })
  await submit()
  expect(verifyDiscordDelivery).toHaveBeenCalledWith('91', messageId, expect.any(AbortSignal))
  expect(wrapper.get('[role="status"]').text()).toContain('Delivery confirmed')
  expect(wrapper.emitted('confirmed')).toEqual([[messageId]])
  expect(wrapper.get('button').attributes('aria-disabled')).toBe('true')
  expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  await wrapper.get('form').trigger('submit')
  expect(verifyDiscordDelivery).toHaveBeenCalledTimes(1)
})
it.each(['proof_mismatch', 'bot_changed', 'configuration_changed', 'access_denied', 'message_unavailable',
  'not_eligible', 'receipt_missing', 'verification_paused', 'timed_out', 'cancelled'])('shows safe feedback for %s', async code => {
  verifyDiscordDelivery.mockRejectedValue({ response: { data: { code, error: '<private detail>' } } })
  await submit()
  expect(wrapper.get('[role="status"]').text().length).toBeGreaterThan(10)
  expect(wrapper.text()).not.toContain('private detail')
  expect(wrapper.get('input').element.value).toBe(messageId)
  expect(wrapper.get('button').attributes('aria-disabled')).toBe('false')
  expect(verifyDiscordDelivery).toHaveBeenCalledTimes(1)
})
it('shows the authoritative saved message if passive confirmation won the race', async () => {
  verifyDiscordDelivery.mockResolvedValue({ data: { code: 'confirmed', messageId: '444444444444444444' } })
  await submit()
  expect(wrapper.get('input').element.value).toBe('444444444444444444')
  expect(wrapper.emitted('confirmed')).toEqual([['444444444444444444']])
})
it.each([null, { code: 'confirmed' }, { code: 'confirmed', messageId: Number(messageId) },
  { code: { toString: null } }, { code: 'unknown' }, { code: '<script>' },
  { code: 'constructor' }, { code: '__proto__' }])('hides malformed feedback %j', async data => {
  verifyDiscordDelivery.mockResolvedValue({ data })
  await submit()
  expect(wrapper.get('[role="status"]').text()).toContain('Could not verify delivery')
})
it.each([['rate_limited', 131], ['cooldown', 60], ['busy', null], ['rate_limited', '<private>']])('handles cooldown %s %s without timers or retries', async (code, retryAfterSeconds) => {
  verifyDiscordDelivery.mockRejectedValue({ response: { data: { code, retryAfterSeconds } } })
  await submit()
  expect(wrapper.text()).toContain(Number.isSafeInteger(retryAfterSeconds) ? `Wait at least ${retryAfterSeconds}` : 'busy or paused')
  expect(wrapper.text()).not.toContain('private')
  expect(verifyDiscordDelivery).toHaveBeenCalledTimes(1)
})
it('duplicate submissions are ignored while active; unmount aborts and ignores late results', async () => {
  const deferred = Promise.withResolvers()
  verifyDiscordDelivery.mockReturnValue(deferred.promise)
  await submit()
  await wrapper.get('form').trigger('submit')
  expect(verifyDiscordDelivery).toHaveBeenCalledTimes(1)
  const signal = verifyDiscordDelivery.mock.calls[0][2]
  expect(signal.aborted).toBe(false)
  wrapper.unmount()
  expect(signal.aborted).toBe(true)
  deferred.resolve({ data: { code: 'confirmed' } })
  await flushPromises()
})
