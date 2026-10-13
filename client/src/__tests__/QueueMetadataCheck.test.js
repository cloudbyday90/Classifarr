/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import QueueMetadataCheck from '../components/command-center/QueueMetadataCheck.vue'
import { checkQueueTaskMetadata } from '../api/queueTasksApi'
import { queueMetadataCheckMessage } from '../utils/queueMetadataCheckPresentation'

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
