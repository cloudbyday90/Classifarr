/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import TuningSuggestionsDashboard from '../views/TuningSuggestionsDashboard.vue'
import api from '../api'
import { isSuggestionReviewConflict } from '../utils/suggestionReviewErrors'

vi.mock('../api', () => ({ default: {
  getSuggestionPage: vi.fn(), getPolicies: vi.fn(), getUserProfile: vi.fn(),
  applySuggestion: vi.fn(), rejectSuggestion: vi.fn(),
} }))

const suggestion = { id: 1, policy_id: 2, status: 'pending', suggestion_type: 'adjust_threshold' }
const proposal = { ...suggestion, proposal_status: 'available', suggestion_config: { recommended: 90 } }
const lastPage = { items: [suggestion], nextBeforeId: null }
const firstPage = {
  items: Array.from({ length: 20 }, (_, index) => ({ ...suggestion, id: 21 - index })),
  nextBeforeId: 2,
}
let wrapper

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('confirm', vi.fn(() => true))
  vi.stubGlobal('alert', vi.fn())
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getSuggestionPage.mockResolvedValue(lastPage)
  api.getPolicies.mockResolvedValue([{ id: 2, name: 'Movies' }])
  api.getUserProfile.mockResolvedValue({ role: 'admin' })
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function mountDashboard() {
  wrapper = shallowMount(TuningSuggestionsDashboard)
  await flushPromises()
}

async function openDetails(item = suggestion) {
  await wrapper.findComponent({ name: 'SuggestionCard' }).vm.$emit('view-details', item)
}

test.each(['SUGGESTION_NOT_PENDING', 'SUGGESTION_POLICY_CHANGED'])('apply refreshes on %s without retry or a success message', async code => {
  await mountDashboard()
  await openDetails()
  api.applySuggestion.mockRejectedValueOnce({ response: { status: 409, data: { code } } })
  api.getSuggestionPage.mockResolvedValueOnce({ items: [], nextBeforeId: null })
  await wrapper.vm.applySuggestion(proposal)
  expect(api.applySuggestion).toHaveBeenCalledExactlyOnceWith(suggestion.id)
  expect(api.getSuggestionPage).toHaveBeenCalledTimes(2)
  expect(wrapper.findComponent({ name: 'SuggestionCard' }).exists()).toBe(false)
  expect(alert).toHaveBeenCalledWith('This suggestion has changed and was not updated by this request.')
})

test('reject closes the stale modal and refreshes after another reviewer wins', async () => {
  await mountDashboard()
  await openDetails()
  wrapper.vm.showRejectModal({ ...proposal, proposal_status: 'unavailable', suggestion_config: null })
  await flushPromises()
  expect(wrapper.findComponent({ name: 'RejectModal' }).exists()).toBe(true)
  api.rejectSuggestion.mockRejectedValueOnce({ response: { status: 409, data: { code: 'SUGGESTION_NOT_PENDING' } } })
  await wrapper.vm.confirmReject('No longer needed')
  await flushPromises()
  expect(api.rejectSuggestion).toHaveBeenCalledExactlyOnceWith(suggestion.id, 'No longer needed')
  expect(wrapper.findComponent({ name: 'RejectModal' }).exists()).toBe(false)
  expect(api.getSuggestionPage).toHaveBeenCalledTimes(2)
})

test('policy authority conflicts keep their existing error behavior', async () => {
  await mountDashboard()
  await openDetails()
  api.applySuggestion.mockRejectedValueOnce({ message: 'Policy authority changed', response: { status: 409, data: { code: 'POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED' } } })
  await wrapper.vm.applySuggestion(proposal)
  expect(api.getSuggestionPage).toHaveBeenCalledTimes(1)
  expect(alert).toHaveBeenCalledWith('Failed to apply suggestion: Policy authority changed')
})

test.each(['Admin access required', 'Valid administrator identity required'])(
  'apply refusal explains who can act without repeating the request (%s)', async error => {
    await mountDashboard()
    await openDetails()
    api.applySuggestion.mockRejectedValueOnce({ response: { status: 403, data: { error } } })
    await wrapper.vm.applySuggestion(proposal)
    expect(api.applySuggestion).toHaveBeenCalledTimes(1)
    expect(api.getSuggestionPage).toHaveBeenCalledTimes(1)
    expect(alert).toHaveBeenCalledExactlyOnceWith('Ask a Classifarr administrator to review and apply this suggestion.')
  },
)

test('an unrelated forbidden response keeps the ordinary error handling', async () => {
  await mountDashboard()
  await openDetails()
  api.applySuggestion.mockRejectedValueOnce({ message: 'Request failed', response: { status: 403, data: { error: 'CSRF validation failed' } } })
  await wrapper.vm.applySuggestion(proposal)
  expect(alert).toHaveBeenCalledExactlyOnceWith('Failed to apply suggestion: Request failed')
})

test('rejection refusal keeps the dialog and the submitted reason available', async () => {
  await mountDashboard()
  await openDetails()
  wrapper.vm.showRejectModal(proposal)
  api.rejectSuggestion.mockRejectedValueOnce({ response: { status: 403, data: { error: 'Admin access required' } } })
  await wrapper.vm.confirmReject('Dismiss')
  expect(api.rejectSuggestion).toHaveBeenCalledExactlyOnceWith(suggestion.id, 'Dismiss')
  expect(api.getSuggestionPage).toHaveBeenCalledTimes(1)
  expect(wrapper.findComponent({ name: 'RejectModal' }).exists()).toBe(true)
  expect(alert).toHaveBeenCalledExactlyOnceWith('Ask a Classifarr administrator to review and reject this suggestion.')
})

test.each([undefined, {}, { response: { status: 500 } }, { response: { status: 409 } },
  { response: { status: 409, data: { code: 'UNRELATED' } } }])('does not classify an unrelated error as a lifecycle conflict', error => {
  expect(isSuggestionReviewConflict(error)).toBe(false)
})

test.each(['SUGGESTION_EVIDENCE_REQUIRED', 'SUGGESTION_EVIDENCE_STALE', 'SUGGESTION_EVIDENCE_BUSY'])('evidence conflict %s resets to the first page without reapplying', async code => {
  api.getSuggestionPage.mockResolvedValueOnce(firstPage)
  await mountDashboard()
  await wrapper.vm.showOlder()
  await flushPromises()
  await openDetails()
  api.applySuggestion.mockRejectedValueOnce({ response: { status: 409, data: { code } } })
  await wrapper.vm.applySuggestion(proposal)
  expect(api.applySuggestion).toHaveBeenCalledTimes(1)
  expect(api.getSuggestionPage.mock.calls).toEqual([[{ status: 'pending' }], [{ status: 'pending', beforeId: 2 }], [{ status: 'pending' }]])
  expect(alert).toHaveBeenCalledWith(code === 'SUGGESTION_EVIDENCE_BUSY'
    ? 'Suggestion evidence is being updated. Please try again later.'
    : 'Suggestion evidence needs refreshing. Run analysis before applying a new suggestion.')
})

test('only an administrator with a current pending proposal can start a review', async () => {
  api.getUserProfile.mockResolvedValue({ role: 'user' })
  await mountDashboard()
  await openDetails()
  expect(wrapper.findComponent({ name: 'SuggestionDetailsDialog' }).props('canReview')).toBe(false)
  expect(wrapper.find('select[aria-label="Policy"]').exists()).toBe(false)
  expect(api.getPolicies).not.toHaveBeenCalled()
  await wrapper.vm.applySuggestion(proposal)
  wrapper.vm.showRejectModal(proposal)
  await wrapper.vm.confirmReject('Dismiss')
  expect(api.applySuggestion).not.toHaveBeenCalled()
  expect(api.rejectSuggestion).not.toHaveBeenCalled()
})

test('an administrator can restore review controls after a failed permissions check', async () => {
  api.getUserProfile.mockRejectedValueOnce(new Error('Profile unavailable'))
  await mountDashboard()
  expect(wrapper.get('[role="alert"]').text()).toContain('Could not check review permissions')
  expect(api.getPolicies).not.toHaveBeenCalled()
  await openDetails()
  expect(wrapper.findComponent({ name: 'SuggestionDetailsDialog' }).props('canReview')).toBe(false)
  await wrapper.vm.loadReviewer()
  expect(api.getUserProfile).toHaveBeenCalledTimes(2)
  expect(api.getPolicies).toHaveBeenCalledTimes(1)
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.findComponent({ name: 'SuggestionDetailsDialog' }).props('canReview')).toBe(true)
})

test('an administrator applies once after confirmation and then resets the page', async () => {
  const write = Promise.withResolvers()
  await mountDashboard()
  await openDetails()
  await wrapper.vm.applySuggestion({ ...proposal, proposal_status: 'unavailable', suggestion_config: null })
  confirm.mockReturnValueOnce(false)
  await wrapper.vm.applySuggestion(proposal)
  expect(api.applySuggestion).not.toHaveBeenCalled()
  api.applySuggestion.mockReturnValueOnce(write.promise)
  const applied = wrapper.vm.applySuggestion(proposal)
  await wrapper.vm.applySuggestion(proposal)
  expect(api.applySuggestion).toHaveBeenCalledExactlyOnceWith(suggestion.id)
  write.resolve({ data: { success: true } })
  await applied
  expect(api.getSuggestionPage).toHaveBeenCalledTimes(2)
  expect(alert).toHaveBeenCalledWith('Suggestion applied successfully!')
})

test('uses explicit All, combines it with the policy picker, and ignores late filter results', async () => {
  const first = Promise.withResolvers()
  api.getSuggestionPage.mockReturnValueOnce(first.promise)
  await mountDashboard()
  await wrapper.find('select[aria-label="Suggestion status"]').setValue('all')
  await wrapper.find('select[aria-label="Policy"]').setValue(2)
  await flushPromises()
  first.resolve(firstPage)
  await flushPromises()
  expect(api.getSuggestionPage.mock.calls).toEqual([[{ status: 'pending' }], [{ status: 'all' }], [{ status: 'all', policyId: 2 }]])
  expect(wrapper.get('[role="status"]').text()).toBe('Page 1. 1 suggestion on this page.')
  expect(wrapper.findAllComponents({ name: 'SuggestionCard' })).toHaveLength(1)
})

test('retains the current page on failure, retries the exact cursor, and re-reads Newer', async () => {
  api.getSuggestionPage.mockResolvedValueOnce(firstPage)
  await mountDashboard()
  api.getSuggestionPage.mockRejectedValueOnce(new Error('Unavailable'))
  await wrapper.vm.showOlder()
  expect(wrapper.get('[role="status"]').text()).toContain('previous results are still shown')
  expect(wrapper.findAllComponents({ name: 'SuggestionCard' })).toHaveLength(20)
  api.getSuggestionPage.mockResolvedValueOnce({ items: [], nextBeforeId: null })
  await wrapper.vm.retry()
  expect(wrapper.get('[role="status"]').text()).toContain('No suggestions at this position')
  await wrapper.vm.showNewer()
  expect(api.getSuggestionPage.mock.calls).toEqual([[{ status: 'pending' }], [{ status: 'pending', beforeId: 2 }],
    [{ status: 'pending', beforeId: 2 }], [{ status: 'pending' }]])
})

test('rejects a page that repeats its own boundary', async () => {
  api.getSuggestionPage.mockResolvedValueOnce(firstPage)
  await mountDashboard()
  api.getSuggestionPage.mockResolvedValueOnce({ items: [{ ...suggestion, id: 2 }], nextBeforeId: null })
  await wrapper.vm.showOlder()
  expect(wrapper.get('[role="status"]').text()).toContain('Could not load the requested page')
  expect(wrapper.findAllComponents({ name: 'SuggestionCard' })).toHaveLength(20)
})

test('retries the current filter while an obsolete retry is still pending', async () => {
  const oldRetry = Promise.withResolvers()
  api.getSuggestionPage.mockRejectedValueOnce(new Error('Unavailable'))
  await mountDashboard()
  const retryEvent = { currentTarget: wrapper.element }
  api.getSuggestionPage.mockReturnValueOnce(oldRetry.promise)
  const obsolete = wrapper.vm.retryList(retryEvent)
  api.getSuggestionPage.mockRejectedValueOnce(new Error('All unavailable'))
  await wrapper.find('select[aria-label="Suggestion status"]').setValue('all')
  await flushPromises()
  expect(wrapper.get('[role="status"]').text()).toBe('Could not load suggestions.')
  try {
    await wrapper.vm.retryList(retryEvent)
    expect(api.getSuggestionPage).toHaveBeenNthCalledWith(4, { status: 'all' })
    expect(wrapper.get('[role="status"]').text()).toBe('Page 1. 1 suggestion on this page.')
  } finally {
    oldRetry.resolve(firstPage)
    await obsolete
  }
  expect(wrapper.findAllComponents({ name: 'SuggestionCard' })).toHaveLength(1)
})
