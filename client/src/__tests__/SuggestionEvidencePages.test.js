/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import api from '../api'
import SuggestionEvidencePages from '../components/suggestions/SuggestionEvidencePages.vue'

vi.mock('../api', () => ({ default: { getSuggestionEvidence: vi.fn() } }))

let wrapper
const firstPage = {
  suggestionId: 7, referenceCount: 2, nextAfterPosition: 1,
  items: [{ position: 1, status: 'available', title: 'Current title', wasCorrection: null }],
}

beforeEach(() => vi.resetAllMocks())
afterEach(() => wrapper?.unmount())

function openEvidence(suggestionId = 7) {
  wrapper = mount(SuggestionEvidencePages, { props: { suggestionId } })
  return wrapper
}

test('keeps the current page on a transient failure and retries only the same position', async () => {
  const next = Promise.withResolvers()
  api.getSuggestionEvidence.mockResolvedValueOnce(firstPage).mockReturnValueOnce(next.promise)
  openEvidence()
  await flushPromises()
  const button = wrapper.get('button')
  await button.trigger('click')
  await button.trigger('click')
  expect(wrapper.get('[role=status]').text()).toBe('Loading supporting evidence…')
  expect(button.attributes('aria-disabled')).toBe('true')
  expect(api.getSuggestionEvidence.mock.calls).toEqual([[7, undefined], [7, 1]])
  next.reject({ response: { status: 502 } })
  await flushPromises()
  expect(wrapper.text()).toContain('Current title')
  expect(button.text()).toBe('Retry evidence')

  api.getSuggestionEvidence.mockResolvedValueOnce({ suggestionId: 7, referenceCount: 2, nextAfterPosition: null,
    items: [{ position: 2, status: 'unavailable' }] })
  await button.trigger('click')
  await flushPromises()
  expect(api.getSuggestionEvidence).toHaveBeenLastCalledWith(7, 1)
  expect(wrapper.text()).not.toContain('Current title')
  expect(wrapper.text()).toContain('Evidence reference 2 is unavailable.')
  expect(wrapper.get('button').element).toBe(button.element)
  expect(button.attributes('aria-disabled')).toBe('true')
})

test.each([[null, 'Supporting evidence is unavailable.'], [0, 'No supporting evidence.'], [1, 'No evidence at this position.']])(
  'announces an empty page with reference count %s', async (referenceCount, expected) => {
    api.getSuggestionEvidence.mockResolvedValueOnce({ suggestionId: 7, referenceCount, items: [], nextAfterPosition: null })
    openEvidence()
    await flushPromises()
    expect(wrapper.get('[role=status]').text()).toBe(expected)
    expect(wrapper.find('button').exists()).toBe(false)
  },
)

test.each([[403, 'Only administrators can view supporting evidence.'], [404, 'Supporting evidence is unavailable.']])(
  'clears the displayed page if a later request returns %s', async (status, message) => {
    api.getSuggestionEvidence.mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce({ response: { status, data: { error: 'Admin access required' } } })
    openEvidence()
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role=status]').text()).toBe(message)
    expect(wrapper.find('ul').exists()).toBe(false)
  },
)

test('discards a late response after the original evidence view closes', async () => {
  const earlier = Promise.withResolvers()
  api.getSuggestionEvidence.mockReturnValueOnce(earlier.promise).mockResolvedValueOnce({ ...firstPage,
    suggestionId: 8, items: [{ position: 1, status: 'available', title: 'Second suggestion evidence' }],
  })
  openEvidence().unmount()
  openEvidence(8)
  earlier.resolve(firstPage)
  await flushPromises()
  expect(wrapper.text()).toContain('Second suggestion evidence')
  expect(wrapper.text()).not.toContain('Current title')
})

test.each([
  { suggestionId: 8 }, { items: Array(21).fill(firstPage.items[0]) }, { items: [null] },
])('refuses a mismatched or malformed page (%j)', async changes => {
  api.getSuggestionEvidence.mockResolvedValueOnce({ ...firstPage, ...changes })
  openEvidence()
  await flushPromises()
  expect(wrapper.get('[role=status]').text()).toContain('Could not load')
  expect(wrapper.text()).not.toContain('Current title')
})
