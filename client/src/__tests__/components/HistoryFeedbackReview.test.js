/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import HistoryFeedbackReview from '@/components/history/HistoryFeedbackReview.vue'
import { feedbackReviewFixture, feedbackCommandFixture, feedbackReceiptFixture } from '../fixtures/feedbackReviewFixture'
const { api } = vi.hoisted(() => ({ api: { prepareFeedbackReview: vi.fn(), submitFeedbackReview: vi.fn(), getFeedbackReviewReceipt: vi.fn() } }))
vi.mock('@/api', () => ({ default: api }))
let wrapper
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear()
  api.prepareFeedbackReview.mockResolvedValue({ data: feedbackReviewFixture() })
  api.submitFeedbackReview.mockResolvedValue({ data: { ...feedbackReceiptFixture() } })
  wrapper = mount(HistoryFeedbackReview, { props: { classificationId: '7' }, attachTo: document.body })
})
afterEach(() => { wrapper.unmount(); document.body.innerHTML = '' })
const button = text => [...document.querySelectorAll('button')].find(element => element.textContent.trim() === text)
const open = async () => { button('Review library feedback').click(); await flushPromises() }
test('renders the served original and current outcome separately and submits the labeled policy choice', async () => {
  await open(); const dialog = document.querySelector('dialog')
  expect(dialog.textContent).toContain('Original automated destination: Original destination')
  expect(dialog.textContent).toContain('Current recorded outcome: Current outcome')
  const submit = button('Confirm original destination as feedback'); expect(submit.disabled).toBe(true)
  const select = dialog.querySelector('select'); expect(dialog.querySelector(`label[for="${select.id}"]`).textContent).toContain('original destination')
  select.value = '11'; select.dispatchEvent(new Event('change', { bubbles: true })); await flushPromises()
  submit.click(); await flushPromises()
  expect(api.submitFeedbackReview).toHaveBeenCalledWith('7', feedbackCommandFixture())
  expect(dialog.querySelector('[role="status"]').textContent).toContain('Feedback was recorded')
})
test('closing a pending send suppresses late presentation and reopening recovers only its receipt', async () => {
  let complete
  api.submitFeedbackReview.mockReturnValue(new Promise(resolve => { complete = resolve }))
  await open(); const select = document.querySelector('select'); select.value = '11'; select.dispatchEvent(new Event('change', { bubbles: true })); await flushPromises()
  button('Confirm original destination as feedback').click(); await flushPromises()
  document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true })); await flushPromises()
  complete({ data: feedbackReceiptFixture() }); await flushPromises(); expect(document.querySelector('dialog')).toBeNull()
  api.getFeedbackReviewReceipt.mockResolvedValue(feedbackReceiptFixture()); await open()
  expect(document.querySelector('[role="status"]').textContent).toContain('Feedback was recorded')
  expect(api.prepareFeedbackReview).toHaveBeenCalledTimes(1); expect(api.submitFeedbackReview).toHaveBeenCalledTimes(1)
})
