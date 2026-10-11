/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SourceScopeDraft from '@/components/library/SourceScopeDraft.vue'
import SourceScopeEvidence from '@/components/library/SourceScopeEvidence.vue'
import SourceMappingApproval from '@/components/library/SourceMappingApproval.vue'
import ReviewedEpisodeDraft from '@/components/library/ReviewedEpisodeDraft.vue'
import { parseReviewedEpisodeMappings, parseEpisodeReviews } from '@/utils/reviewedEpisodeMappings'
import { parseSourceMappings } from '@/utils/sourceMappings'
import { parseScopeCatalogWorks } from '@/utils/sourceMappingGuidance'
import { reviewSourceScope, inspectSourceScope, approveSourceScope } from '@/api/mediaIdentityReviewApi'
vi.mock('@/api/mediaIdentityReviewApi', () => ({ reviewSourceScope: vi.fn(), inspectSourceScope: vi.fn(), approveSourceScope: vi.fn() }))
const edge = () => ({ sourceSeason: 1, sourceEpisode: 2, tmdbSeriesId: 10, tmdbSeason: 0, tmdbEpisode: 1, tmdbEpisodeId: 100 })
const scope = () => ({ kind: 'whole_work', tmdbId: 10, episodeMappings: [edge()] })
const draft = () => ({ sourceKey: 'a'.repeat(64), sourceVersion: 'b'.repeat(64), draftFingerprint: 'c'.repeat(64), scope: scope() })
const response = () => ({ ...draft(), version: 'source_scope_evidence.v1', canApply: false, persisted: false,
  reference: '2e851bf4-9497-4b99-8b7c-e8117a05c762', evidenceFingerprint: 'd'.repeat(64), verification: 'typed_catalog_membership',
  crossProviderVerified: false, identityAuthority: 'operator_episode_mapping', backfill: { eligible: false, excludedScope: 'all' },
  episodeReviews: [{ ...edge(), title: '<img src=x>' }], comparison: { unit: 'episode', total: 2, matched: 2, operatorReviewed: 1, exclusions: [] } })
let wrapper
beforeEach(() => vi.clearAllMocks())
afterEach(() => wrapper?.unmount())

it.each(['empty', 'duplicate', 'foreign', 'fraction', 'oversized', 'string', 'missing', 'unmapped'])('rejects %s episode declarations', mode => {
  const input = scope()
  if (mode === 'empty') input.episodeMappings = []
  if (mode === 'duplicate') input.episodeMappings.push(edge())
  if (mode === 'foreign') input.episodeMappings[0].tmdbSeriesId = 20
  if (mode === 'fraction') input.episodeMappings[0].sourceSeason = .1
  if (mode === 'oversized') input.episodeMappings = Array.from({ length: 65 }, edge)
  if (mode === 'string') input.episodeMappings[0].tmdbEpisodeId = '100'
  if (mode === 'missing') input.episodeMappings[0] = null
  if (mode === 'unmapped') Object.assign(input, { kind: 'seasons', mappings: [{ sourceSeason: 9, tmdbSeriesId: 10 }] })
  expect(parseReviewedEpisodeMappings(input)).toBeNull()
})
it.each(['position', 'id', 'title', 'authority', 'count', 'missing', 'combined', 'movie', 'duplicate', 'excluded'])('rejects forged %s preview evidence', mode => {
  const data = response()
  if (mode === 'position') data.episodeReviews[0].tmdbSeason = 1
  if (mode === 'id') data.episodeReviews[0].tmdbEpisodeId = 999
  if (mode === 'title') data.episodeReviews[0].title = ''
  if (mode === 'authority') data.identityAuthority = 'automatic'
  if (mode === 'count') data.comparison.operatorReviewed = 0
  if (mode === 'missing') delete data.episodeReviews
  if (mode === 'combined') data.combinedAudit = {}
  if (mode === 'movie') data.comparison.unit = 'movie'
  if (mode === 'duplicate') data.episodeReviews.push(data.episodeReviews[0])
  if (mode === 'excluded') data.comparison.exclusions.push({ season: 1, episode: 2 })
  expect(parseEpisodeReviews(data, scope(), data.comparison)).toBeNull()
})
it('requires episode evidence when the scope contains declarations, while supporting old scopes', () => {
  const data = response()
  expect(parseEpisodeReviews(data, scope(), data.comparison)).toEqual(data.episodeReviews)
  expect(parseEpisodeReviews({}, { kind: 'whole_work', tmdbId: 10 }, {})).toEqual([])
  expect(parseEpisodeReviews(data, { kind: 'whole_work', tmdbId: 10 }, data.comparison)).toBeNull()
})
it('submits explicit rows through the existing API and clears evidence when edited', async () => {
  reviewSourceScope.mockImplementation(async (_key, body) => ({ data: { ...draft(), scope: body.scope,
    version: 'source_scope_review.v1', status: 'valid_draft', canApply: false, persisted: false,
    verification: 'structure_only', backfill: { eligible: false, excludedScope: 'all' } } }))
  wrapper = mount(SourceScopeDraft, { props: { source: { key: draft().sourceKey, sourceVersion: draft().sourceVersion, mediaType: 'tv' }, offset: 0 } })
  await wrapper.get('input').setValue('10')
  const form = wrapper.getComponent(ReviewedEpisodeDraft)
  await form.get('button').trigger('click')
  for (const [i, value] of Object.values(edge()).entries()) await form.findAll('input')[i].setValue(String(value))
  expect(form.findAll('label').every(label => form.find(`[id="${label.attributes('for')}"]`).exists())).toBe(true)
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(reviewSourceScope.mock.calls[0][1].scope).toEqual(scope())
  expect(wrapper.findComponent(SourceScopeEvidence).exists()).toBe(true)
  await form.findAll('input')[1].setValue('3')
  expect(wrapper.findComponent(SourceScopeEvidence).exists()).toBe(false)
  await form.findAll('button')[0].trigger('click')
  expect(form.findAll('input')).toHaveLength(0)
})
it('shows escaped target titles and separates human proposals from declared IDs', async () => {
  const data = response()
  data.episodeReviews[0].sourceTitle = '<script>Source title</script>'
  inspectSourceScope.mockResolvedValue({ data })
  wrapper = mount(SourceScopeEvidence, { props: { draft: draft(), offset: 0 } })
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="status"]').text()).toContain('Human-reviewed episode identities: 1. Source-declared ID matches: 1.')
  expect(wrapper.get('[aria-label="Human episode identity decisions"]').text()).toContain('<img src=x>')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('script').exists()).toBe(false)
  expect(wrapper.text()).toContain('<script>Source title</script>')
  expect(wrapper.text()).toContain('Titles are review context, not proof of identity.')
  expect(wrapper.findComponent(SourceMappingApproval).exists()).toBe(true)
})

it.each(['', {}, 8, 'x'.repeat(501), 'hidden\u202e', 'new\nline'])('rejects malformed source-title context: %s', sourceTitle => {
  const data = response()
  data.episodeReviews[0].sourceTitle = sourceTitle
  expect(parseEpisodeReviews(data, scope(), data.comparison)).toBeNull()
})

it.each([undefined, null])('shows unavailable source title without inventing identity: %s', async sourceTitle => {
  const data = response()
  data.episodeReviews[0].sourceTitle = sourceTitle
  inspectSourceScope.mockResolvedValue({ data })
  wrapper = mount(SourceScopeEvidence, { props: { draft: draft(), offset: 0 } })
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Source title unavailable')
})
it('requires both confirmations and clears them when evidence changes', async () => {
  approveSourceScope.mockResolvedValue({ data: { version: 'source_mapping_approval.v1', mappingId: response().reference, status: 'approved', materialized: false } })
  wrapper = mount(SourceMappingApproval, { props: { draft: draft(), evidence: { evidenceFingerprint: 'd'.repeat(64) }, offset: 0 } })
  const inputs = wrapper.findAll('input')
  await inputs[1].setValue(true); await wrapper.get('button').trigger('click')
  expect(approveSourceScope).not.toHaveBeenCalled()
  await inputs[0].setValue(true); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(approveSourceScope.mock.calls[0][1]).toMatchObject({ confirmed: true, episodesConfirmed: true, scope: scope() })
  await wrapper.setProps({ evidence: { evidenceFingerprint: 'e'.repeat(64) } })
  expect(wrapper.findAll('input').every(input => input.element.checked === false)).toBe(true)
})
const movieScope = () => ({ kind: 'seasons', coverage: 'complete', sourceSeasonNumbers: [1],
  mappings: [{ sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 1 }],
  episodeMappings: [{ sourceSeason: 1, sourceEpisode: 2, tmdbMovieId: 100 }] })

it('renders a typed movie exception without inventing episode coordinates', async () => {
  const proposal = movieScope(), data = { ...response(), scope: proposal,
    catalogWorks: [{ tmdbId: 10, mediaType: 'tv', title: 'Series', releaseDate: null },
      { tmdbId: 100, mediaType: 'movie', title: '<img src=x>', releaseDate: null }],
    episodeReviews: [{ ...proposal.episodeMappings[0], title: '<img src=x>', sourceTitle: 'Reunion' }] }
  inspectSourceScope.mockResolvedValue({ data })
  wrapper = mount(SourceScopeEvidence, { props: { draft: { ...draft(), scope: proposal }, offset: 0 } })
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('TMDb movie 100 (standalone movie; excluded from TV learning)')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.findComponent(SourceMappingApproval).exists()).toBe(true)
  expect(wrapper.text()).toContain('does not add a movie-library membership or move any files')
})

it.each(['whole', 'mixed', 'duplicate', 'string', 'zero', 'unknown'])('rejects invalid movie exception %s', mode => {
  const proposal = movieScope()
  if (mode === 'whole') Object.assign(proposal, { kind: 'whole_work', tmdbId: 10 })
  if (mode === 'mixed') proposal.episodeMappings[0].tmdbEpisodeId = 100
  if (mode === 'duplicate') proposal.episodeMappings.push({ ...proposal.episodeMappings[0], sourceEpisode: 3 })
  if (mode === 'string') proposal.episodeMappings[0].tmdbMovieId = '100'
  if (mode === 'zero') proposal.episodeMappings[0].tmdbMovieId = 0
  if (mode === 'unknown') proposal.episodeMappings[0].allow = true
  expect(parseReviewedEpisodeMappings(proposal)).toBeNull()
})

it('clears stale target fields when changing target type and clears movie exceptions for whole-series scope', async () => {
  wrapper = mount(SourceScopeDraft, { props: { source: { key: draft().sourceKey, sourceVersion: draft().sourceVersion, mediaType: 'tv' }, offset: 0 } })
  await wrapper.get('select').setValue('seasons')
  const form = wrapper.getComponent(ReviewedEpisodeDraft)
  await form.get('button').trigger('click')
  await form.get('select').setValue('movie')
  expect(form.findAll('input')).toHaveLength(3)
  expect(form.text()).toContain('TMDb movie ID')
  await form.get('select').setValue('episode')
  expect(form.findAll('input')).toHaveLength(6)
  await form.get('select').setValue('movie')
  await wrapper.get('select').setValue('whole_work')
  expect(form.findAll('input')).toHaveLength(0)
})

it('rejects a movie review that mixes movie and TV target coordinates', () => {
  const proposal = movieScope(), data = { ...response(), episodeReviews: [{ ...proposal.episodeMappings[0], title: 'Movie', tmdbEpisodeId: 100 }] }
  expect(parseEpisodeReviews(data, proposal, data.comparison)).toBeNull()
})

it('requires complete typed catalog context for movie exceptions, including same-number IDs', () => {
  const proposal = movieScope()
  proposal.episodeMappings[0].tmdbMovieId = 10
  const context = { scope: proposal }
  const works = [{ tmdbId: 10, mediaType: 'tv', title: 'Series', releaseDate: null },
    { tmdbId: 10, mediaType: 'movie', title: 'Movie', releaseDate: null }]
  expect(parseScopeCatalogWorks(works, context, 'episode')).toEqual(works)
  expect(parseScopeCatalogWorks(undefined, context, 'episode')).toBeNull()
  expect(parseScopeCatalogWorks([works[0]], context, 'episode')).toBeNull()
  expect(parseScopeCatalogWorks([works[0], { ...works[1], mediaType: 'tv' }], context, 'episode')).toBeNull()
})

it('preserves human decisions in the saved-mappings projection', () => {
  const data = { version: 'source_mappings.v1', offset: 0, hasMore: false, items: [{ id: response().reference,
    title: 'Fixture', libraryName: 'Library', status: 'awaiting_sync', scope: scope() }] }
  expect(parseSourceMappings(data).items[0].episodeMappings).toEqual([edge()])
  data.items[0].scope.episodeMappings[0].tmdbEpisodeId = 0
  expect(parseSourceMappings(data)).toBeNull()
})
