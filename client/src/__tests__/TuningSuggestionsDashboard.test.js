/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import TuningSuggestionsDashboard from '../views/TuningSuggestionsDashboard.vue'
import api from '../api'
import { isSuggestionReviewConflict } from '../utils/suggestionReviewErrors'

vi.mock('../api', () => ({ default: { getSuggestions: vi.fn(), getPolicies: vi.fn(), getSuggestion: vi.fn(),
  applySuggestion: vi.fn(), rejectSuggestion: vi.fn() } }))
const suggestion = { id: 1, status: 'pending', suggestion_type: 'adjust_threshold', suggestion_config: { threshold_type: 'auto_classify', current: 85, recommended: 90 } }
let wrapper
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('confirm', vi.fn(() => true))
  vi.stubGlobal('alert', vi.fn())
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getSuggestions.mockResolvedValue([suggestion])
  api.getPolicies.mockResolvedValue([])
  api.getSuggestion.mockResolvedValue(suggestion)
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function mountDashboard() {
  wrapper = shallowMount(TuningSuggestionsDashboard)
  await flushPromises()
}

test.each(['SUGGESTION_NOT_PENDING', 'SUGGESTION_POLICY_CHANGED'])('apply refreshes on %s without retry or a success message', async code => {
  await mountDashboard()
  api.applySuggestion.mockRejectedValueOnce({ response: { status: 409, data: { code } } })
  api.getSuggestions.mockResolvedValueOnce([])
  await wrapper.vm.applySuggestion(suggestion)
  expect(api.applySuggestion).toHaveBeenCalledTimes(1)
  expect(api.getSuggestions).toHaveBeenCalledTimes(2)
  expect(wrapper.findComponent({ name: 'SuggestionCard' }).exists()).toBe(false)
  expect(alert).toHaveBeenCalledWith('This suggestion has changed and was not updated by this request.')
})

test('reject closes the stale modal and refreshes after another reviewer wins', async () => {
  await mountDashboard()
  wrapper.vm.showRejectModal(suggestion)
  await flushPromises()
  expect(wrapper.findComponent({ name: 'RejectModal' }).exists()).toBe(true)
  api.rejectSuggestion.mockRejectedValueOnce({ response: { status: 409, data: { code: 'SUGGESTION_NOT_PENDING' } } })
  await wrapper.vm.confirmReject('No longer needed')
  await flushPromises()
  expect(api.rejectSuggestion).toHaveBeenCalledTimes(1)
  expect(wrapper.findComponent({ name: 'RejectModal' }).exists()).toBe(false)
  expect(api.getSuggestions).toHaveBeenCalledTimes(2)
})

test('policy authority conflicts keep their existing error behavior', async () => {
  await mountDashboard()
  api.applySuggestion.mockRejectedValueOnce({ message: 'Policy authority changed', response: { status: 409, data: { code: 'POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED' } } })
  await wrapper.vm.applySuggestion(suggestion)
  expect(api.getSuggestions).toHaveBeenCalledTimes(1)
  expect(alert).toHaveBeenCalledWith('Failed to apply suggestion: Policy authority changed')
})

test('existing successful reviews still refresh and canceled apply requests do not run', async () => {
  await mountDashboard()
  confirm.mockReturnValueOnce(false)
  await wrapper.vm.applySuggestion(suggestion)
  expect(api.applySuggestion).not.toHaveBeenCalled()
  api.applySuggestion.mockResolvedValueOnce({ data: { success: true } })
  await wrapper.vm.applySuggestion(suggestion)
  expect(alert).toHaveBeenCalledWith('Suggestion applied successfully!')
  wrapper.vm.showRejectModal(suggestion)
  api.rejectSuggestion.mockResolvedValueOnce({ data: { success: true } })
  await wrapper.vm.confirmReject('Reason')
  expect(alert).toHaveBeenCalledWith('Suggestion rejected')
})

test.each([undefined, {}, { response: { status: 500 } }, { response: { status: 409 } },
  { response: { status: 409, data: { code: 'UNRELATED' } } }])('does not classify an unrelated error as a lifecycle conflict', error => {
  expect(isSuggestionReviewConflict(error)).toBe(false)
})


test.each(['SUGGESTION_EVIDENCE_REQUIRED', 'SUGGESTION_EVIDENCE_STALE', 'SUGGESTION_EVIDENCE_BUSY'])('evidence conflict %s refreshes without reapplying', async code => {
  await mountDashboard()
  api.applySuggestion.mockRejectedValueOnce({ response: { status: 409, data: { code } } })
  await wrapper.vm.applySuggestion(suggestion)
  expect(api.applySuggestion).toHaveBeenCalledTimes(1)
  expect(api.getSuggestions).toHaveBeenCalledTimes(2)
  expect(alert).toHaveBeenCalledWith(code === 'SUGGESTION_EVIDENCE_BUSY'
    ? 'Suggestion evidence is being updated. Please try again later.'
    : 'Suggestion evidence needs refreshing. Run analysis before applying a new suggestion.')
})

test('named filters allow viewing superseded history', async () => {
  await mountDashboard()
  await wrapper.find('select[aria-label="Suggestion status"]').setValue('superseded')
  await flushPromises()
  expect(api.getSuggestions).toHaveBeenLastCalledWith('superseded', '')
  expect(wrapper.find('select[aria-label="Policy"]').exists()).toBe(true)
})
