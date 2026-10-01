/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ImageIndexProgressCard from '../components/system/ImageIndexProgressCard.vue'
import { getImageIndexProgress } from '../api/systemHealthApi'
import { presentImageIndexProgress } from '../utils/imageIndexProgressPresentation'
vi.mock('../api/systemHealthApi', () => ({ getImageIndexProgress: vi.fn() }))
const report = {
  status: 'waiting', reason: 'cooldown', observedAt: '2026-10-01T12:00:00Z',
  automatic: { started: 1, limit: 3, nextEligibleAt: '2026-10-01T13:00:00Z' },
  indexes: [{ key: 'idx_embeddings_image_hnsw', status: 'invalid' },
    { key: 'idx_embeddings_image_present', status: 'verified' }, { key: 'idx_embeddings_image_hash', status: 'verified' }],
}
let wrapper
beforeEach(() => { vi.clearAllMocks(); getImageIndexProgress.mockResolvedValue(report) })
afterEach(() => { wrapper?.unmount(); vi.useRealTimers() })
describe('image-index progress card', () => {
  it('renders a labeled visual checklist, actual attempts, time and one next action', async () => {
    wrapper = mount(ImageIndexProgressCard); await flushPromises()
    expect(wrapper.find('[role="status"]').attributes('aria-atomic')).toBe('true')
    expect(wrapper.findAll('li')).toHaveLength(3)
    expect(wrapper.text()).toContain('2 of 3 indexes verified — not a build percentage')
    expect(wrapper.text()).toContain('Automatic attempts started: 1 / 3')
    expect(wrapper.text()).toContain('Automatic cooldown ends:')
    expect(wrapper.text()).toContain('Wait until the earliest eligibility time')
    expect(wrapper.find('time').attributes('datetime')).toBe(report.automatic.nextEligibleAt)
    expect(wrapper.text()).toContain('Read-only snapshot')
  })
  it('refreshes only when requested, with no polling', async () => {
    vi.useFakeTimers()
    wrapper = mount(ImageIndexProgressCard); await flushPromises()
    await vi.advanceTimersByTimeAsync(300_000)
    expect(getImageIndexProgress).toHaveBeenCalledTimes(1)
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(getImageIndexProgress).toHaveBeenCalledTimes(2)
  })
  it('disables refresh while pending and ignores completion after unmount', async () => {
    let finish
    getImageIndexProgress.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    wrapper = mount(ImageIndexProgressCard)
    await flushPromises()
    expect(wrapper.find('[role="status"]').text()).toContain('Checking')
    expect(wrapper.find('button').attributes('aria-disabled')).toBe('true')
    await wrapper.find('button').trigger('click')
    expect(getImageIndexProgress).toHaveBeenCalledTimes(1)
    wrapper.unmount(); finish(report); await flushPromises()
  })
  it('removes stale green data on a refresh failure and recovers on retry', async () => {
    getImageIndexProgress.mockResolvedValueOnce({ ...report, status: 'verified', reason: 'healthy' })
    wrapper = mount(ImageIndexProgressCard); await flushPromises()
    getImageIndexProgress.mockRejectedValueOnce(new Error('secret'))
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('Unavailable')
    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('secret')
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('cooling down')
  })
  it('explains denied access without rendering counts or retry instructions', async () => {
    getImageIndexProgress.mockRejectedValueOnce({ response: { status: 403 } })
    wrapper = mount(ImageIndexProgressCard); await flushPromises()
    expect(wrapper.text()).toContain('Administrator access is required')
    expect(wrapper.text()).not.toContain('Next:')
  })
  it('does not invent counts or cooldowns when evidence is unavailable', async () => {
    getImageIndexProgress.mockResolvedValueOnce({ ...report, status: 'needs_review', reason: 'definition_mismatch', indexes: null, automatic: null })
    wrapper = mount(ImageIndexProgressCard); await flushPromises()
    expect(wrapper.text()).toContain('Needs review')
    expect(wrapper.text()).not.toContain('of 3')
    expect(wrapper.text()).not.toContain('Automatic attempts')
  })
  it('omits a missing cooldown timestamp', async () => {
    getImageIndexProgress.mockResolvedValueOnce({ ...report, automatic: { started: 0, limit: 3, nextEligibleAt: null } })
    wrapper = mount(ImageIndexProgressCard); await flushPromises()
    expect(wrapper.text()).not.toContain('cooldown ends')
  })
  it.each(['disabled', 'not_configured', 'schema_unavailable', 'restore_verification_required', 'definition_mismatch',
    'repair_unverified', 'attempt_limit', 'worker_claimed', 'claim_recovery', 'queue_delay', 'queued', 'awaiting_check',
    'waiting_for_libraries', 'waiting_for_inventory', 'ingesting', 'backfilling', 'waiting_for_database', 'validating', 'building', 'healthy'])('explains %s with a fixed next action', reason => {
    expect(presentImageIndexProgress({ status: 'running', reason }).action).toBeTruthy()
    expect(presentImageIndexProgress({ reason }).description).not.toContain('could not be checked')
  })
  it('uses a safe fallback for future states/reasons', () => {
    expect(presentImageIndexProgress({ status: 'secret', reason: 'secret' })).toMatchObject({ label: 'Unavailable' })
    expect(JSON.stringify(presentImageIndexProgress(null))).not.toContain('secret')
  })
})
