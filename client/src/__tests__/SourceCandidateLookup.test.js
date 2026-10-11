/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SourceCandidateLookup from '@/components/library/SourceCandidateLookup.vue'
import SourceScopeDraft from '@/components/library/SourceScopeDraft.vue'
import { lookupSourceCandidates } from '@/api/mediaIdentityReviewApi'
import { candidateFailureMessage, parseSourceCandidates } from '@/utils/sourceCandidates'
import { identityAgreementBlockers } from '@/utils/sourceIdentityAgreement'
vi.mock('@/api/mediaIdentityReviewApi', () => ({ lookupSourceCandidates: vi.fn(), reviewSourceScope: vi.fn(), inspectSourceScope: vi.fn() }))
const source = () => ({ key: 'a'.repeat(64), sourceVersion: 'b'.repeat(64), mediaType: 'tv' })
const response = () => ({ version: 'source_candidates.v1', sourceKey: source().key, sourceVersion: source().sourceVersion,
  mediaType: 'tv', reference: '12345678-1234-1234-1234-123456789abc', asOf: '2026-10-10T12:00:00Z', canApply: false, persisted: false,
  lookups: [{ provider: 'tmdb_id', id: 10, tmdbIds: [10], otherScopeMatches: 0, status: 'declared' }],
  candidates: [{ tmdbId: 10, mediaType: 'tv', title: '<script>Fixture</script>', releaseDate: '2020-01-01', available: true, lookupIndexes: [0] }] })
const agreement = () => {
  const data = response()
  data.lookups.push({ provider: 'imdb_id', id: 'tt123', tmdbIds: [10], otherScopeMatches: 0, status: 'matched' })
  data.candidates[0].lookupIndexes.push(1)
  data.identityAudit = { version: 'source_identity_agreement.v1', basis: 'tmdb_parent_lookups',
    status: 'catalog_agreement', candidateTmdbId: 10, blockers: [], completeScopeVerified: false, automaticRecoveryEligible: false }
  return data
}
let wrapper
const render = () => { wrapper = mount(SourceCandidateLookup, { props: { source: source(), offset: 0 } }); return wrapper }
beforeEach(() => { vi.clearAllMocks(); lookupSourceCandidates.mockResolvedValue({ data: response() }) })
afterEach(() => wrapper?.unmount())
it('announces catalog agreement without claiming complete scope or adding any action', async () => {
  lookupSourceCandidates.mockResolvedValue({ data: agreement() })
  render(); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="status"]').text()).toContain('complete scope still needs verification')
  expect(wrapper.get('[role="status"]').attributes('aria-atomic')).toBe('true')
  expect(wrapper.text()).toContain('not independent proof')
  expect(wrapper.text()).toContain('No repair was authorized')
  expect(wrapper.findAll('input, select, a')).toHaveLength(0)
  expect(wrapper.findAll('button').map(button => button.text())).toEqual(['Find candidate IDs'])
  expect(lookupSourceCandidates).toHaveBeenCalledTimes(1)
})
it.each(Object.entries(identityAgreementBlockers))('explains %s using fixed text', async (code, label) => {
  const data = agreement()
  Object.assign(data.identityAudit, { status: 'review_required', candidateTmdbId: null, blockers: [code] })
  lookupSourceCandidates.mockResolvedValue({ data })
  render(); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain(label)
  expect(wrapper.get('[role="status"]').text()).toContain('unresolved evidence remains')
})
it.each(['null', 'version', 'basis', 'scope', 'authority', 'status', 'unknown', 'duplicate', 'oversize', 'not_array', 'not_string',
  'positive_blocker', 'wrong_id', 'no_external', 'no_declared', 'other_scope', 'missing', 'multi', 'unavailable', 'empty_review', 'review_id'])('rejects forged audit: %s', mode => {
  const data = agreement(), audit = data.identityAudit
  if (mode === 'null') data.identityAudit = null
  if (mode === 'version') audit.version = 'unknown'
  if (mode === 'basis') audit.basis = 'independent'
  if (mode === 'scope') audit.completeScopeVerified = true
  if (mode === 'authority') audit.automaticRecoveryEligible = true
  if (mode === 'status') audit.status = 'approved'
  if (mode === 'unknown') audit.blockers = ['__proto__']
  if (mode === 'duplicate') audit.blockers = ['missing_catalog_match', 'missing_catalog_match']
  if (mode === 'oversize') audit.blockers = Array(9).fill('missing_catalog_match')
  if (mode === 'not_array') audit.blockers = null
  if (mode === 'not_string') audit.blockers = [42]
  if (mode === 'positive_blocker') audit.blockers = ['missing_catalog_match']
  if (mode === 'wrong_id') audit.candidateTmdbId = 11
  if (mode === 'no_external') { data.lookups.pop(); data.candidates[0].lookupIndexes = [0] }
  if (mode === 'no_declared') { data.lookups.shift(); data.candidates[0].lookupIndexes = [0] }
  if (mode === 'other_scope') data.lookups[1].otherScopeMatches = 1
  if (mode === 'missing') { data.lookups[1].status = 'no_match'; data.lookups[1].tmdbIds = []; data.candidates[0].lookupIndexes = [0] }
  if (mode === 'multi') {
    data.lookups[1].tmdbIds.push(11)
    data.candidates.push({ ...data.candidates[0], tmdbId: 11, lookupIndexes: [1] })
  }
  if (mode === 'unavailable') Object.assign(data.candidates[0], { available: false, title: null, releaseDate: null })
  if (mode === 'empty_review') Object.assign(audit, { status: 'review_required', candidateTmdbId: null })
  if (mode === 'review_id') Object.assign(audit, { status: 'review_required', blockers: ['missing_catalog_match'] })
  expect(parseSourceCandidates(data, source())).toBeNull()
})
it('only fetches on request and renders typed, escaped suggestions without approval', async () => {
  render(); expect(lookupSourceCandidates).not.toHaveBeenCalled()
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(lookupSourceCandidates).toHaveBeenCalledWith(source().key, { offset: 0, sourceVersion: source().sourceVersion }, expect.any(AbortSignal))
  expect(wrapper.text()).toContain('TMDb series ID: 10')
  expect(wrapper.text()).toContain('<script>Fixture</script>')
  expect(wrapper.find('script').exists()).toBe(false)
  expect(wrapper.get('[role="status"]').text()).toBe('1 candidate found. Nothing was saved.')
  expect(wrapper.findAll('input, select, a')).toHaveLength(0)
  expect(wrapper.findAll('button').map(button => button.text())).toEqual(['Find candidate IDs'])
})
it('distinguishes no candidate, other-scope matches and missing details', async () => {
  const data = response(); data.candidates = []; data.lookups = [{ provider: 'tvdb_id', id: 10, status: 'other_scope', otherScopeMatches: 1, tmdbIds: [] }]
  lookupSourceCandidates.mockResolvedValue({ data }); render(); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('This does not mean the item has no metadata')
  expect(wrapper.text()).toContain('Only other types or scopes matched')
  const missing = response(); Object.assign(missing.candidates[0], { available: false, title: null, releaseDate: null })
  lookupSourceCandidates.mockResolvedValue({ data: missing }); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Catalog details not found')
})
it.each(['cancel', 'key', 'revision', 'offset', 'unmount'])('aborts and discards late responses after %s', async change => {
  const pending = Promise.withResolvers(); lookupSourceCandidates.mockReturnValue(pending.promise)
  render(); await wrapper.get('button').trigger('click')
  const signal = lookupSourceCandidates.mock.calls[0][2]
  expect(wrapper.get('[role="status"]').text()).toContain('Looking up')
  if (change === 'cancel') await wrapper.findAll('button')[1].trigger('click')
  if (change === 'key') await wrapper.setProps({ source: { ...source(), key: 'c'.repeat(64) } })
  if (change === 'revision') await wrapper.setProps({ source: { ...source(), sourceVersion: 'c'.repeat(64) } })
  if (change === 'offset') await wrapper.setProps({ offset: 50 })
  if (change === 'unmount') wrapper.unmount()
  expect(signal.aborted).toBe(true)
  pending.resolve({ data: response() }); await flushPromises()
  if (change !== 'unmount') expect(wrapper.text()).not.toContain('TMDb series ID: 10')
})
it('opening the draft is inert; closing it cancels candidate work and leaves its fields alone', async () => {
  const pending = Promise.withResolvers(); lookupSourceCandidates.mockReturnValue(pending.promise)
  wrapper = mount(SourceScopeDraft, { props: { source: source(), offset: 0 } })
  const details = wrapper.get('details'); details.element.open = true; await details.trigger('toggle')
  expect(lookupSourceCandidates).not.toHaveBeenCalled()
  await wrapper.get('input').setValue('42')
  await wrapper.findComponent(SourceCandidateLookup).get('button').trigger('click')
  const signal = lookupSourceCandidates.mock.calls[0][2]
  details.element.open = false; await details.trigger('toggle')
  expect(signal.aborted).toBe(true); expect(wrapper.get('input').element.value).toBe('42')
  pending.resolve({ data: response() }); await flushPromises()
  expect(wrapper.findComponent(SourceCandidateLookup).exists()).toBe(false)
})
it.each(['authority', 'key', 'type', 'date', 'provider', 'status', 'id', 'provenance', 'duplicate', 'missing', 'title', 'available'])('rejects malformed %s', async mode => {
  const data = response()
  if (mode === 'authority') data.canApply = true
  if (mode === 'key') data.sourceKey = 'c'.repeat(64)
  if (mode === 'type') data.candidates[0].mediaType = 'movie'
  if (mode === 'date') data.asOf = 'no'
  if (mode === 'provider') data.lookups[0].provider = '__proto__'
  if (mode === 'status') data.lookups[0].status = 'matched'
  if (mode === 'id') data.lookups[0].id = -1
  if (mode === 'provenance') data.candidates[0].lookupIndexes = [1]
  if (mode === 'duplicate') data.candidates.push(data.candidates[0])
  if (mode === 'missing') data.candidates = []
  if (mode === 'title') data.candidates[0].title = ''
  if (mode === 'available') data.candidates[0].available = false
  expect(parseSourceCandidates(data, source())).toBeNull()
  lookupSourceCandidates.mockResolvedValue({ data }); render(); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Nothing was saved')
})
it.each([[401, null, 'administrator'], [403, null, 'administrator'], [409, null, 'source changed'], [429, null, 'Wait'],
  [503, 'candidate_busy', 'Another source review'], [503, 'candidate_lookup_limit', 'too many candidates'],
  [503, 'candidate_timed_out', 'timed out'], [500, null, 'did not complete']])('provides fixed failure guidance %s/%s', async (status, code, text) => {
  const error = { response: { status, data: { code, error: 'private-secret' } } }
  expect(candidateFailureMessage(error)).toContain(text)
  lookupSourceCandidates.mockRejectedValue(error); render(); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain(text); expect(wrapper.text()).not.toContain('private-secret')
})
