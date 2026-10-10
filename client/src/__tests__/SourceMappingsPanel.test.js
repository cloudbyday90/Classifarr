/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SourceMappingsPanel from '@/components/library/SourceMappingsPanel.vue'
import { getSourceMappings, revokeSourceMapping } from '@/api/mediaIdentityReviewApi'
import { parseSourceMappings } from '@/utils/sourceMappings'
vi.mock('@/api/mediaIdentityReviewApi', () => ({ getSourceMappings: vi.fn(), revokeSourceMapping: vi.fn() }))
const id = '2e851bf4-9497-4b99-8b7c-e8117a05c762'
const report = () => ({ version: 'source_mappings.v1', offset: 0, hasMore: false, items: [{ id, title: 'Fixture',
  libraryName: 'Library', status: 'awaiting_sync', scope: { kind: 'whole_work', tmdbId: 10 }, retryAfter: null }] })
let wrapper
beforeEach(() => { vi.clearAllMocks(); getSourceMappings.mockResolvedValue(report()); revokeSourceMapping.mockResolvedValue({ data: { version: 'source_mapping_revocation.v1', mappingId: id, status: 'revoked' } }); wrapper = mount(SourceMappingsPanel) })
afterEach(() => wrapper.unmount())
const button = text => wrapper.findAll('button').find(value => value.text().startsWith(text))
async function load() { await button('Refresh').trigger('click'); await flushPromises() }
it('reads only on request, requires confirmation to revoke and announces completion', async () => {
  expect(getSourceMappings).not.toHaveBeenCalled(); await load()
  expect(wrapper.text()).toContain('Awaiting successful verification')
  expect(button('Revoke').attributes('disabled')).toBeDefined()
  await wrapper.get('input').setValue(true); await button('Revoke').trigger('click'); await flushPromises()
  expect(revokeSourceMapping).toHaveBeenCalledWith(id)
  expect(wrapper.get('[role="status"]').text()).toContain('Mapping revoked')
  expect(wrapper.find('input').exists()).toBe(false)
})
it('blocks replay after a lost response until status is read again', async () => {
  revokeSourceMapping.mockRejectedValue(new Error('private error'))
  await load(); await wrapper.get('input').setValue(true); await button('Revoke').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Refresh saved mappings')
  expect(button('Revoke').attributes('disabled')).toBeDefined()
  await load(); expect(wrapper.get('input').element.checked).toBe(false)
  expect(wrapper.text()).not.toContain('private error')
})
it('displays season scope and bounded pages', async () => {
  const value = report(); value.offset = 50; value.hasMore = true; value.items[0].scope = { kind: 'seasons', coverage: 'complete', mappings: [{ sourceSeason: 2, tmdbSeriesId: 12, tmdbSeason: 1 }] }
  getSourceMappings.mockResolvedValue(value); await load()
  expect(wrapper.text()).toContain('Source season 2 → TMDb series 12, season 1')
  await button('Next').trigger('click'); await flushPromises()
  expect(getSourceMappings).toHaveBeenLastCalledWith({ offset: 100 })
  await button('Previous').trigger('click'); await flushPromises()
  expect(getSourceMappings).toHaveBeenLastCalledWith({ offset: 0 })
})
it('sanitizes unreadable state and clears stale results', async () => {
  await load(); getSourceMappings.mockRejectedValue(new Error('private'))
  await load(); expect(wrapper.find('input').exists()).toBe(false)
  expect(wrapper.get('[role="alert"]').text()).toContain('unavailable')
})
it.each([
  value => { value.version = 'old' }, value => { value.items[0].status = 'private' },
  value => { value.items[0].scope = { kind: 'seasons', coverage: 'partial', mappings: [] } },
  value => { value.items[0].scope.tmdbId = -1 }, value => { value.items[0].retryAfter = 'invalid' },
])('fails closed on malformed saved state', change => {
  const value = report(); change(value); expect(parseSourceMappings(value)).toBeNull()
})

it.each([['missing_tmdb_episode_id', 'episode-level metadata'], ['check_unconfirmed', 'interrupted'], ['private-token', 'GitHub issue'], [undefined, 'GitHub issue']])('shows fixed saved guidance for %s without leaking arbitrary diagnostics', async (code, text) => {
  const value = report(); value.items[0].status = 'verification_deferred'; value.items[0].diagnostic = { code, message: 'secret' }
  getSourceMappings.mockResolvedValue(value); await load()
  expect(wrapper.text()).toContain(text)
  expect(wrapper.text()).not.toContain('secret')
  expect(wrapper.text()).not.toContain('private-token')
  expect(revokeSourceMapping).not.toHaveBeenCalled()
})
