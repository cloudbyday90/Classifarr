/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import QueueMetadataCheck from '../components/command-center/QueueMetadataCheck.vue'
import { checkQueueTaskMetadata } from '../api/queueTasksApi'
import { queueMetadataCheckMessage } from '../utils/queueMetadataCheckPresentation'
import { queueIdentityEvidenceMessage, queueIdentityEvidenceSources } from '../utils/queueIdentityEvidencePresentation'

vi.mock('../api/queueTasksApi', () => ({ checkQueueTaskMetadata: vi.fn() }))
const task = { id: 23, status: 'failed', completed_at: '2026-10-13', attempts: 1,
  error_message: 'task_metadata_not_found', payload: { tmdb_id: 42, media_type: 'movie' } }
const report = { taskId: '23', tmdbId: 42, mediaType: 'movie', checkedAt: '2026-10-13T12:00:00Z',
  savedFailure: 'task_metadata_not_found', observation: { category: 'not_found', httpStatus: 404 }, candidate: null }
const render = () => mount(QueueMetadataCheck, { props: { task } })
beforeEach(() => { vi.resetAllMocks(); checkQueueTaskMetadata.mockResolvedValue({ data: report }) })

describe('saved task metadata check', () => {
  test.each([
    [{ checks: 1, nextCheckAt: '2026-10-14T12:00:00Z' }, 'Automatic record check:'],
    [{ checks: 6, nextCheckAt: '2026-10-14T12:00:00Z' }, 'checks are exhausted'],
    [{ checks: 1, recoveredAt: '2026-10-13T12:00:00Z' }, 'recovery was already used'],
  ])('shows saved recovery state without provider requests: %j', (metadata_recovery, text) => {
    const wrapper = mount(QueueMetadataCheck, { props: { task: { ...task, metadata_recovery } } })
    expect(wrapper.text()).toContain(text)
    expect(checkQueueTaskMetadata).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  test('only checks on explicit click and never emits a retry or mutation', async () => {
    const wrapper = render()
    expect(checkQueueTaskMetadata).not.toHaveBeenCalled()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(checkQueueTaskMetadata).toHaveBeenCalledWith(23, { signal: expect.any(AbortSignal) })
    expect(wrapper.text()).toContain('TMDb movie ID: 42')
    expect(wrapper.text()).toContain('still cannot find')
    expect(wrapper.text()).toContain('Task #23')
    expect(wrapper.emitted('retry')).toBeUndefined()
    wrapper.unmount()
  })
  test('shows a successful TV check without treating it as a completed classification', async () => {
    checkQueueTaskMetadata.mockResolvedValue({ data: { ...report, mediaType: 'tv', observation: { category: 'available', httpStatus: 200 },
      candidate: { title: '<script>unsafe</script>', releaseDate: '2026-01-01' } } })
    const wrapper = render()
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('TV series ID: 42')
    expect(wrapper.text()).toContain('Nothing has been retried or changed')
    expect(wrapper.find('script').exists()).toBe(false)
    wrapper.unmount()
  })
  test('shows an external-ID candidate as unapproved evidence, never a repair action', async () => {
    checkQueueTaskMetadata.mockResolvedValue({ data: { ...report, identityEvidence: {
      reason: 'candidate_for_review', sources: ['imdb_id', 'tvdb_id', 'private'],
      candidate: { tmdbId: 99, mediaType: 'tv', title: '<script>unsafe</script>', releaseDate: '2026-01-01' },
    } } })
    const wrapper = render()
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('not an approved replacement')
    expect(wrapper.text()).toContain('same work and edition')
    expect(wrapper.text()).toContain('TV series ID 99')
    expect(wrapper.text()).toContain('IMDb, TVDB')
    expect(wrapper.text()).not.toContain('private')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(checkQueueTaskMetadata).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  test.each([
    ['external_ids_missing', 'no saved IMDb'], ['source_unavailable', 'no longer available'],
    ['source_conflict', 'disagree'], ['conflicting_external_ids', 'disagree'],
    ['invalid_external_id', 'invalid'], ['external_id_not_found', 'no matching'],
    ['original_id_only', 'original record'], ['reverse_id_conflict', 'do not confirm'],
    ['ambiguous_external_id', 'more than one'], ['invalid_response', 'could not be verified'],
  ])('explains evidence outcome %s', (reason, text) => {
    expect(queueIdentityEvidenceMessage({ reason })).toContain(text)
  })
  test.each(['unknown', 'constructor', '__proto__', '<script>secret</script>'])('evidence reason %s never becomes raw guidance', reason => {
    expect(queueIdentityEvidenceMessage({ reason })).toContain('Open a GitHub issue')
    expect(queueIdentityEvidenceMessage({ reason })).not.toContain(reason)
  })
  test.each([['not_found', 'record needed'], ['invalid_response', 'candidate details'], ['rate_limited', 'limiting requests'], ['unknown', 'GitHub issue']])('explains follow-up provider %s separately', (category, text) => {
    expect(queueIdentityEvidenceMessage({ reason: 'provider_unavailable', observation: { category } })).toContain(text)
  })
  test('source labels are bounded and deduplicated', () => {
    expect(queueIdentityEvidenceSources(['imdb_id', 'imdb_id', '<script>'])).toBe('IMDb')
    expect(queueIdentityEvidenceSources(null)).toBe('')
    expect(queueIdentityEvidenceMessage(null)).toContain('GitHub issue')
  })
  test('support details distinguish original 404 from follow-up timeout', async () => {
    checkQueueTaskMetadata.mockResolvedValue({ data: { ...report, identityEvidence: {
      reason: 'provider_unavailable', observation: { category: 'timeout', httpStatus: null, transportCode: 'ETIMEDOUT' },
    } } })
    const wrapper = render()
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('Current check: not_found · HTTP 404')
    expect(wrapper.text()).toContain('Provider: timeout · HTTP unavailable')
    expect(wrapper.text()).toContain('ETIMEDOUT')
    wrapper.unmount()
  })
  test.each([[403, 'administrator'], [409, 'changed'], [404, 'no longer exists'], [429, 'Wait a minute'], [500, 'unavailable']])('handles HTTP %s without raw error reflection', async (status, text) => {
    checkQueueTaskMetadata.mockRejectedValue({ response: { status, data: { error: 'private-secret' } } })
    const wrapper = render()
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain(text)
    expect(wrapper.text()).not.toContain('private-secret')
    wrapper.unmount()
  })
  test('cancels in-flight checks and ignores a late response after task revision changes', async () => {
    let finish
    checkQueueTaskMetadata.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const wrapper = render()
    await wrapper.find('button').trigger('click')
    const signal = checkQueueTaskMetadata.mock.calls[0][1].signal
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ task: { ...task, attempts: 2 } })
    expect(signal.aborted).toBe(true)
    finish({ data: report }); await flushPromises()
    expect(wrapper.text()).not.toContain('still cannot find')
    wrapper.unmount()
  })
  test('aborts on unmount', async () => {
    checkQueueTaskMetadata.mockImplementation(() => new Promise(() => {}))
    const wrapper = render()
    await wrapper.find('button').trigger('click')
    const signal = checkQueueTaskMetadata.mock.calls[0][1].signal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
  })
  test.each(['unknown', 'constructor', '__proto__', '<script>secret</script>'])('unknown category %s remains bounded', category => {
    expect(queueMetadataCheckMessage(category)).toContain('Open a GitHub issue')
    expect(queueMetadataCheckMessage(category)).not.toContain(category)
  })
});
