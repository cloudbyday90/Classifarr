/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { parseEpisodeGap } from '@/utils/sourceEpisodeGap'
import SourceEpisodeGap from '@/components/library/SourceEpisodeGap.vue'
const scope = { kind: 'whole_work', tmdbId: 10 }
const exclusion = { season: 1, episode: 2, reason: 'missing_tmdb_episode_id' }
const gap = () => ({ sourceIds: 'none', catalogPosition: 'absent', target: { tmdbSeriesId: 10, season: 1, episode: 2 } })

it.each(['none', 'other_only'])('accepts bounded %s evidence without leaking unknown fields', sourceIds => {
  const value = { ...gap(), sourceIds, private: 'secret' }; value.target.private = 'secret'
  const parsed = parseEpisodeGap(value, exclusion, scope)
  expect(parsed).toEqual({ ...gap(), sourceIds })
  expect(JSON.stringify(parsed)).not.toContain('secret')
})
it('binds explicitly remapped seasons rather than assuming matching numbering', () => {
  const value = gap(); value.target.season = 5
  expect(parseEpisodeGap(value, exclusion, { kind: 'seasons', mappings: [{ sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 5 }] })).toEqual(value)
  expect(parseEpisodeGap(value, exclusion, scope)).toBeNull()
  expect(parseEpisodeGap(value, exclusion, { kind: 'seasons', mappings: [] })).toBeNull()
})
it.each([
  value => { value.sourceIds = 'tmdb' }, value => { value.sourceIds = 'secret' },
  value => { value.catalogPosition = 'secret' }, value => { value.target.tmdbSeriesId = 20 },
  value => { value.target.episode = 3 }, value => { value.target = null },
])('rejects malformed and contradictory gap evidence', change => {
  const value = gap(); change(value); expect(parseEpisodeGap(value, exclusion, scope)).toBeNull()
})
it('rejects unrelated exclusions and requires a supplied TMDb ID for absent-ID membership', () => {
  expect(parseEpisodeGap(null, exclusion, scope)).toBeNull()
  expect(parseEpisodeGap(gap(), { ...exclusion, reason: 'unmapped_season' }, scope)).toBeNull()
  const absent = { ...exclusion, reason: 'episode_absent_from_scope' }
  expect(parseEpisodeGap(gap(), absent, scope)).toBeNull()
  expect(parseEpisodeGap({ ...gap(), sourceIds: 'tmdb', catalogPosition: 'present' }, absent, scope)).toBeTruthy()
})
it.each([
  ['none', 'absent', 'no supported external IDs', 'no episode at this proposed position'],
  ['other_only', 'present', 'other external IDs but no TMDb', 'position alone does not verify'],
  ['tmdb', 'absent', 'not found in the checked catalog scope', 'cannot guarantee'],
])('renders fixed actionable copy for %s / %s without buttons or live-region chatter', (sourceIds, catalogPosition, sourceText, positionText) => {
  const wrapper = mount(SourceEpisodeGap, { props: { gap: { ...gap(), sourceIds, catalogPosition } } })
  expect(wrapper.text()).toContain(sourceText); expect(wrapper.text()).toContain(positionText)
  expect(wrapper.text()).toContain('TMDb series 10, season 1, episode 2')
  expect(wrapper.text()).toContain('no source metadata was changed')
  expect(wrapper.find('button, [role="status"], [role="alert"]').exists()).toBe(false)
  wrapper.unmount()
})
