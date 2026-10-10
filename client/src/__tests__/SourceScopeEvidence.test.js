/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SourceScopeEvidence from '@/components/library/SourceScopeEvidence.vue'
import { inspectSourceScope } from '@/api/mediaIdentityReviewApi'
import { parseSourceScopeEvidence } from '@/utils/sourceScopeEvidence'
vi.mock('@/api/mediaIdentityReviewApi', () => ({ inspectSourceScope: vi.fn() }))
const draft = () => ({ sourceKey: 'a'.repeat(64), sourceVersion: 'b'.repeat(64), draftFingerprint: 'c'.repeat(64),
  scope: { kind: 'whole_work', tmdbId: 10 } })
const response = () => ({ ...draft(), version: 'source_scope_evidence.v1', canApply: false, persisted: false,
  verification: 'typed_catalog_membership', crossProviderVerified: false,
  backfill: { eligible: false, excludedScope: 'all' }, reference: '2e851bf4-9497-4b99-8b7c-e8117a05c762',
  comparison: { unit: 'episode', total: 2, matched: 1, exclusions: [{ season: 1, episode: 2, reason: 'missing_tmdb_episode_id' }] } })
let wrapper
const render = () => { wrapper = mount(SourceScopeEvidence, { props: { draft: draft(), offset: 0 } }); return wrapper }
beforeEach(() => { vi.clearAllMocks(); inspectSourceScope.mockResolvedValue({ data: response() }) })
afterEach(() => wrapper?.unmount())
it('only reads on request, announces totals and keeps exclusions outside the live region', async () => {
  render(); expect(inspectSourceScope).not.toHaveBeenCalled()
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(inspectSourceScope).toHaveBeenCalledWith(draft().sourceKey,
    { sourceVersion: draft().sourceVersion, scope: draft().scope, offset: 0 }, expect.any(AbortSignal))
  const status = wrapper.get('[role="status"]')
  expect(status.text()).toContain('1 of 2 episodes')
  expect(status.text()).toContain('did not enable backfill or resolve the conflict')
  expect(status.find('li').exists()).toBe(false)
  expect(wrapper.get('details').text().replace(/\s+/g, ' ')).toContain('Season 1, episode 2: No TMDb episode ID supplied')
  expect(wrapper.text()).toContain('not independent cross-provider identity verification')
  expect(wrapper.findAll('button')).toHaveLength(1)
})
it.each(['cancel', 'edit', 'offset', 'unmount'])('cancels and discards a late response after %s', async action => {
  let finish
  inspectSourceScope.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(); await wrapper.get('button').trigger('click')
  const signal = inspectSourceScope.mock.calls[0][2]
  expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  if (action === 'cancel') await wrapper.findAll('button')[1].trigger('click')
  if (action === 'edit') await wrapper.setProps({ draft: { ...draft(), draftFingerprint: 'd'.repeat(64) } })
  if (action === 'offset') await wrapper.setProps({ offset: 50 })
  if (action === 'unmount') wrapper.unmount()
  expect(signal.aborted).toBe(true)
  finish({ data: response() }); await flushPromises()
  if (action !== 'unmount') expect(wrapper.find('details').exists()).toBe(false)
  if (action === 'cancel') expect(wrapper.get('[role="status"]').text()).toContain('cancelled. Nothing was saved')
})
it.each([[409, 'changed'], [401, 'administrator'], [403, 'administrator'], [429, 'Wait'], [503, 'safety limits']])('sanitizes %s failures', async (status, message) => {
  inspectSourceScope.mockRejectedValue({ response: { status, data: { error: 'private-details' } } })
  render(); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain(message)
  expect(wrapper.text()).not.toContain('private-details')
})
it('rejects malformed transport results instead of showing success', async () => {
  inspectSourceScope.mockResolvedValue({ data: {} }); render()
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').exists()).toBe(true)
  expect(wrapper.find('details').exists()).toBe(false)
})
it.each([
  value => { value.canApply = true }, value => { value.persisted = true },
  value => { value.crossProviderVerified = true }, value => { value.backfill.eligible = true },
  value => { value.sourceVersion = 'changed' }, value => { value.draftFingerprint = 'changed' },
  value => { value.reference = 'private-error' }, value => { value.comparison.total = 2001 },
  value => { value.comparison.matched = 3 }, value => { value.comparison.exclusions[0].reason = 'private-error' },
  value => { value.comparison.exclusions[0].episode = -1 },
  value => { value.comparison.exclusions[0].reason = 'parent_identity_unresolved' },
  value => { value.comparison.exclusions.push(value.comparison.exclusions[0]); value.comparison.total = 3 },
  value => { value.comparison.unit = 'movie' },
])('fails closed on a forged or malformed response', change => {
  const value = response(); change(value); expect(parseSourceScopeEvidence(value, draft())).toBeNull()
})
it('projects safe fields only and accepts a single typed movie declaration', () => {
  const value = response(); value.privateError = 'secret'; value.comparison.exclusions[0].raw = 'secret'
  expect(JSON.stringify(parseSourceScopeEvidence(value, draft()))).not.toContain('secret')
  value.comparison = { unit: 'movie', total: 1, matched: 0, exclusions: [{ reason: 'parent_identity_unresolved' }] }
  expect(parseSourceScopeEvidence(value, draft())).toMatchObject({ unit: 'movie', total: 1, matched: 0 })
  value.comparison = { unit: 'movie', total: 1, matched: 1, exclusions: [] }
  expect(parseSourceScopeEvidence(value, draft()).matched).toBe(1)
})
