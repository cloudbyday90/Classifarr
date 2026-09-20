/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ExhaustedRetryRecovery from '@/components/history/ExhaustedRetryRecovery.vue'

const { retryClassifications } = vi.hoisted(() => ({ retryClassifications: vi.fn() }))
vi.mock('@/api', () => ({ default: { retryClassifications } }))
const classification = { id: 71, status: 'failed', retry_recovery: { eligible: true, reasonCode: 'retry_exhausted' } }
const render = (row = classification) => mount(ExhaustedRetryRecovery, { props: { classification: row } })

describe('exhausted retry recovery', () => {
  beforeEach(() => vi.resetAllMocks())

  it.each([
    { id: 1 }, { ...classification, status: 'routed' },
    { ...classification, retry_recovery: null },
    { ...classification, retry_recovery: { eligible: true, reasonCode: 'unknown' } },
    { ...classification, retry_recovery: { eligible: 'true', reasonCode: 'retry_exhausted' } },
  ])('does not infer eligibility from incomplete or stale state', row => {
    expect(render(row).find('button').exists()).toBe(false)
    expect(retryClassifications).not.toHaveBeenCalled()
  })

  it('announces pending/success and prevents duplicate submissions', async () => {
    let resolve
    retryClassifications.mockReturnValue(new Promise(done => { resolve = done }))
    const wrapper = render()
    expect(wrapper.text()).toContain('Check that your AI provider and model are available')
    const button = wrapper.get('button')
    await button.trigger('click')
    await button.trigger('click')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[role="status"]').text()).toContain('Queuing')
    expect(retryClassifications).toHaveBeenCalledExactlyOnceWith([71])
    await wrapper.vm.retry()
    expect(retryClassifications).toHaveBeenCalledTimes(1)
    resolve({ data: { results: [{ classificationId: '71', queued: true }] } })
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Classification retry queued.')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    await wrapper.vm.retry()
    expect(retryClassifications).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['duplicate_pending_task', 'already queued or running'],
    ['status_ineligible', 'record has changed'],
    ['not_found', 'record has changed'],
    ['retry_failed', 'could not be confirmed'],
  ])('handles skipped/failed result %s without claiming success', async (reasonCode, text) => {
    retryClassifications.mockResolvedValue({ data: { success: true, results: [{ classificationId: 71, queued: false, reasonCode }] } })
    const wrapper = render()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain(text)
    expect(wrapper.text()).not.toContain('Classification retry queued.')
  })

  it.each([{}, { data: { queued: 1 } }, { data: { results: [{ classificationId: 72, queued: true }] } }])('rejects incomplete or mismatched success', async response => {
    retryClassifications.mockResolvedValue(response)
    const wrapper = render()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('could not be confirmed')
  })

  it.each([403, 500])('handles HTTP %s without displaying raw server errors', async status => {
    retryClassifications.mockRejectedValue({ response: { status }, message: 'PRIVATE_SENTINEL' })
    const wrapper = render()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(status === 403 ? 'need write access' : 'could not be confirmed')
    expect(wrapper.text()).not.toContain('PRIVATE_SENTINEL')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it.each(['resolve', 'reject'])('ignores a late %s after closing the record', async completion => {
    let finish
    retryClassifications.mockReturnValue(new Promise((resolve, reject) => { finish = completion === 'resolve' ? resolve : reject }))
    const wrapper = render()
    await wrapper.get('button').trigger('click')
    wrapper.unmount()
    finish({ data: { results: [{ classificationId: 71, queued: true }] } })
    await flushPromises()
    expect(wrapper.emitted('refresh')).toBeUndefined()
  })
})
