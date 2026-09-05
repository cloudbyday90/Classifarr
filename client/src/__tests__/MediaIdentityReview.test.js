/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MediaIdentityReview from '@/views/MediaIdentityReview.vue'
import api from '@/api'

vi.mock('@/api', () => ({ default: { getMediaIdentityReviewItems: vi.fn(), previewMediaIdentity: vi.fn(), confirmMediaIdentity: vi.fn() } }))
const source = { id: 1, title: '<script>Source</script>', year: 2026, mediaType: 'movie', sourceVersion: 'source', libraryName: 'Movies', reason: 'conflicting_external_ids' }
const preview = { previewId: 'preview', expiresAt: '2026-09-05T12:00:00Z', source, candidate: { tmdbId: 12, title: 'Candidate', releaseDate: '2026-01-01' } }
let wrapper
const button = name => wrapper.findAll('button').find(node => node.text() === name)
async function start() {
  wrapper = mount(MediaIdentityReview, { attachTo: document.body, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
}
async function selectAndPreview() {
  await button('Review').trigger('click')
  await wrapper.get('#review-tmdb-id').setValue('12')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  api.getMediaIdentityReviewItems.mockResolvedValue({ items: [source], nextCursor: null })
  api.previewMediaIdentity.mockResolvedValue({ data: preview })
  api.confirmMediaIdentity.mockResolvedValue({ data: { auditId: 99 } })
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

describe('operator identity review', () => {
  it('shows readable reasons and escaped evidence, then requires explicit verification', async () => {
    await start()
    expect(wrapper.text()).toContain('external IDs identify different items')
    expect(wrapper.find('script').exists()).toBe(false)
    await selectAndPreview()
    expect(api.previewMediaIdentity).toHaveBeenCalledWith(1, { tmdbId: '12', sourceVersion: 'source' })
    expect(document.activeElement.textContent.trim()).toBe('TMDb candidate')
    expect(button('Confirm identity').attributes('disabled')).toBeDefined()
    expect(api.confirmMediaIdentity).not.toHaveBeenCalled()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    api.getMediaIdentityReviewItems.mockResolvedValue({ items: [], nextCursor: null })
    await button('Confirm identity').trigger('click')
    await flushPromises()
    expect(api.confirmMediaIdentity).toHaveBeenCalledWith(1, { previewId: 'preview', confirmed: true })
    expect(wrapper.get('[role="status"]').text()).toContain('Audit receipt 99')
    expect(document.activeElement.textContent.trim()).toBe('Review media IDs')
  })
  it('ignores a provider response arriving after cancellation', async () => {
    let resolvePreview
    api.previewMediaIdentity.mockImplementation(() => new Promise(resolve => { resolvePreview = resolve }))
    await start()
    await selectAndPreview()
    await button('Back to review queue').trigger('click')
    resolvePreview({ data: preview })
    await flushPromises()
    expect(wrapper.text()).not.toContain('TMDb candidate')
    expect(wrapper.text()).not.toContain('Candidate ready')
    expect(button('Review')).toBeDefined()
  })
  it('invalidates a rejected confirmation and announces the source conflict', async () => {
    api.confirmMediaIdentity.mockRejectedValue({ response: { status: 409, data: { error: 'The source item changed. Refresh the queue.' } } })
    await start()
    await selectAndPreview()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await button('Confirm identity').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('source item changed')
    expect(button('Confirm identity')).toBeUndefined()
  })
  it('keeps the saved receipt visible if refreshing the queue fails', async () => {
    await start()
    await selectAndPreview()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    api.getMediaIdentityReviewItems.mockRejectedValue(new Error('offline'))
    await button('Confirm identity').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Audit receipt 99')
    expect(wrapper.get('[role="alert"]').text()).toContain('Refresh the queue')
  })
  it('filters and uses a bounded cursor to load more items', async () => {
    api.getMediaIdentityReviewItems.mockResolvedValueOnce({ items: [source], nextCursor: 1 })
    await start()
    api.getMediaIdentityReviewItems.mockResolvedValueOnce({ items: [{ ...source, id: 2 }], nextCursor: null })
    await button('Load more items').trigger('click')
    await flushPromises()
    expect(api.getMediaIdentityReviewItems).toHaveBeenLastCalledWith({ limit: 25, afterId: 1 })
    await wrapper.get('select').setValue('tv')
    await flushPromises()
    expect(api.getMediaIdentityReviewItems).toHaveBeenLastCalledWith({ limit: 25, mediaType: 'tv' })
  })
  it('explains administrator access failures and provider errors', async () => {
    api.getMediaIdentityReviewItems.mockRejectedValueOnce({ response: { status: 403 } })
    await start()
    expect(wrapper.get('[role="alert"]').text()).toContain('administrator session')
    await button('Refresh queue').trigger('click')
    await flushPromises()
    api.previewMediaIdentity.mockRejectedValueOnce({ response: { status: 503, data: { error: 'TMDb is unavailable.' } } })
    await selectAndPreview()
    expect(wrapper.get('[role="alert"]').text()).toBe('TMDb is unavailable.')
    expect(button('Preview identity').attributes('disabled')).toBeUndefined()
  })
});
