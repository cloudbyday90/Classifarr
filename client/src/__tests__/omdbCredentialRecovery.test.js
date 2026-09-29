/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import OMDb from '../views/settings/OMDb.vue'
import api from '../api'

vi.mock('../api', () => ({ default: { getOMDbConfig: vi.fn(), updateOMDbConfig: vi.fn(), testOMDb: vi.fn() } }))
vi.mock('../stores/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
const options = { global: { stubs: {
  Card: { template: '<section><slot /></section>' },
  Button: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  Input: true, PasswordInput: true, Toggle: true,
} } }
beforeEach(() => {
  vi.clearAllMocks()
  api.getOMDbConfig.mockResolvedValue({ api_key: 'masked', is_active: true, credential_rejected_at: '2026-09-29T00:00:00Z' })
})
it('explains the pause and next step with a programmatic status', async () => {
  const wrapper = mount(OMDb, options); await flushPromises()
  expect(wrapper.get('[role="status"]').text()).toContain('Save a corrected key')
  expect(wrapper.text()).toContain('Pending item retry budgets are preserved')
})
it('uses the saved response, not an optimistic assumption that any save fixes access', async () => {
  api.updateOMDbConfig.mockResolvedValueOnce({ data: { credential_rejected_at: 'still-rejected' } })
    .mockResolvedValueOnce({ data: { credential_rejected_at: null } })
  const wrapper = mount(OMDb, options); await flushPromises()
  const save = wrapper.findAll('button').find(button => button.text() === 'Save Changes')
  await save.trigger('click'); await flushPromises()
  expect(wrapper.find('[role="status"]').exists()).toBe(true)
  await save.trigger('click'); await flushPromises()
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
})
it('a connection test is diagnostic, not permission to clear the persisted pause', async () => {
  api.testOMDb.mockResolvedValue({ data: { success: true } })
  const wrapper = mount(OMDb, options); await flushPromises()
  await wrapper.findAll('button').find(button => button.text() === 'Test Connection').trigger('click')
  await flushPromises()
  expect(wrapper.find('[role="status"]').exists()).toBe(true)
})
