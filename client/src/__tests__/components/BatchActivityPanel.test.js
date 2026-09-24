/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BatchActivityPanel from '@/components/command-center/BatchActivityPanel.vue'
import api from '@/api'

vi.mock('@/api', () => ({ default: { getReclassificationBatchActivity: vi.fn() } }))
const Modal = { props: ['modelValue', 'existingBatchId'], emits: ['update:modelValue'], template: '<div />' }
let wrapper
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { wrapper?.unmount() })
const render = () => { wrapper = mount(BatchActivityPanel, { global: { stubs: { BatchReclassifyModal: Modal } } }); return wrapper }

describe('compact batch activity', () => {
  it('keeps rows out of live regions, labels controls and reconnects by saved ID', async () => {
    api.getReclassificationBatchActivity.mockResolvedValue({ batches: [{ id: 42, status: 'paused',
      total: 3, completed: 1, failed: 1, skipped: 0, cancelled: 0, recovering: 1, attention: 0 }], nextCursor: '0:42' })
    render()
    await flushPromises()
    expect(wrapper.get('summary').text()).toContain('1 running or paused')
    expect(wrapper.get('ul').attributes('aria-live')).toBeUndefined()
    expect(wrapper.text()).toContain('1 of 3 completed')
    expect(wrapper.text()).toContain('1 awaiting move verification')
    await wrapper.get('[aria-label="View batch 42"]').trigger('click')
    expect(wrapper.getComponent(Modal).props('existingBatchId')).toBe(42)
    wrapper.getComponent(Modal).vm.$emit('update:modelValue', true)
    await flushPromises()
    expect(api.getReclassificationBatchActivity).toHaveBeenCalledOnce()
    wrapper.getComponent(Modal).vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(wrapper.getComponent(Modal).props('modelValue')).toBe(false)
    expect(api.getReclassificationBatchActivity).toHaveBeenCalledTimes(2)
  })

  it('shows loading and empty states without suggesting work should start', async () => {
    api.getReclassificationBatchActivity.mockResolvedValue({ batches: [], nextCursor: null })
    render()
    expect(wrapper.get('[role="status"]').text()).toContain('Loading')
    await flushPromises()
    expect(wrapper.text()).toContain('No started batches')
    expect(wrapper.findAll('button').at(-1).attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent(Modal).exists()).toBe(false)
  })
})
