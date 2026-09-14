/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LibraryEvaluationSummary from '@/components/command-center/LibraryEvaluationSummary.vue'
import { normalizeLibraryEvaluationSummary } from '@/utils/libraryEvaluationSummary'
import { normalizeRepresentativeShadowSummary } from '@/utils/representativeShadowSummary'

function representative() {
  const keys = ['agrees', 'disagrees', 'known_item', 'known_description', 'scope_changed', 'representation_changed',
    'sparse_profiles', 'unconverged_profiles', 'initialization_sensitive', 'no_positive_match', 'tied_destinations',
    'invalid_input', 'missing_query', 'duplicate', 'expired', 'capacity', 'invalidated_batches']
  return { version: 'inventory_representative_shadow_v2', status: 'available', routingAffected: false, pending: 2,
    counts: { ...Object.fromEntries(keys.map(key => [key, 0])), agrees: 4, disagrees: 1, known_item: 3 },
    latency: { under_1ms: 0, under_10ms: 5, at_least_10ms: 0 } }
}

function coverageRepresentative() {
  const value = representative()
  return { ...value, version: 'inventory_representative_shadow_v3',
    counts: { ...value.counts, partial_agrees: 2, partial_disagrees: 1, incomplete_profiles: 4 } }
}

function summary(overrides = {}) {
  return {
    version: 'library_evaluation_summary_v1', status: 'available', routingAffected: false,
    counts: {
      prepared_admin_held: 100, strict_qualified_admin_held: 2, calibrated_qualified_admin_held: 3,
      live_guard_blocked: 1, busy: 1, unavailable: 2, fallback_blocked: 2, freshness_blocked: 1, qualified: 4,
      ...overrides,
    },
  }
}

describe('LibraryEvaluationSummary', () => {
  it('separates partial comparisons from missing coverage in the existing closed disclosure', async () => {
    const value = coverageRepresentative()
    expect(normalizeRepresentativeShadowSummary(value)).toMatchObject({ compared: 8, differs: 2,
      partialCompared: 3, partialDiffers: 1, unseen: 12, notCompared: 4, excluded: 3 })
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: { ...summary(), representative: value } } })
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(wrapper.get('details').text()).toContain('3 of these comparisons used profiles with some descriptions still missing; 1 differed')
    expect(wrapper.get('details').text()).toContain('at least 90%')
    expect(wrapper.get('details').text()).toContain('Missing descriptions can bias a profile')
    expect(wrapper.get('details').text()).toContain('Descriptions are still backfilling for one or more destinations')
    expect(wrapper.get('[role="status"]').attributes('aria-atomic')).toBe('true')
    const announcement = wrapper.get('[role="status"]').text()
    await wrapper.get('button').trigger('click')
    const updated = { ...value, counts: { ...value.counts, partial_agrees: 3 } }
    await wrapper.setProps({ evaluation: { ...summary(), representative: updated } })
    expect(wrapper.text()).toContain('8 decisions compared')
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('9 decisions compared')
    expect(wrapper.get('[role="status"]').text()).toBe(announcement)
    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ evaluation: undefined })
    expect(wrapper.find('section').exists()).toBe(false)
  })
  it('does not show partial coverage prose when no partial comparisons have run', () => {
    const value = coverageRepresentative()
    value.counts.partial_agrees = 0; value.counts.partial_disagrees = 0
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: { ...summary(), representative: value } } })
    expect(wrapper.text()).not.toContain('Missing descriptions can bias a profile')
    expect(normalizeRepresentativeShadowSummary(representative()).partialCompared).toBe(0)
  })
  it.each([
    value => { delete value.counts.partial_agrees }, value => { delete value.counts.incomplete_profiles },
    value => { value.counts.partial_disagrees = -1 }, value => { value.counts.incomplete_profiles = 1_000_001 },
  ])('rejects malformed v3 coverage counts without hiding the main summary', mutate => {
    const value = coverageRepresentative(); mutate(value)
    expect(normalizeRepresentativeShadowSummary(value)).toBeNull()
    expect(normalizeLibraryEvaluationSummary({ ...summary(), representative: value }).passed).toBe(9)
  })
  it('separates unseen coverage, nonzero causes and excluded attempts without claiming accuracy', () => {
    const value = representative()
    Object.assign(value.counts, { unconverged_profiles: 2, sparse_profiles: 1, initialization_sensitive: 3,
      no_positive_match: 4, tied_destinations: 5, duplicate: 6, invalid_input: 2, invalidated_batches: 100 })
    const normalized = normalizeRepresentativeShadowSummary(value)
    expect(normalized).toMatchObject({ compared: 5, differs: 1, unseen: 20, notCompared: 15, excluded: 11 })
    expect(normalized.reasons.map(reason => reason.count)).toEqual([2, 1, 3, 4, 5])
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: { ...summary(), representative: value } } })
    const details = wrapper.get('details')
    expect(details.attributes('open')).toBeUndefined()
    expect(details.text()).toContain('20 eligible unseen observations, 5 were compared and 15 could not be compared')
    expect(details.text()).toContain('11 other observations were excluded')
    for (const reason of normalized.reasons) expect(details.text()).toContain(reason.label)
    expect(wrapper.get('[role="status"]').text()).not.toMatch(/20|15|profiles picked/)
  })
  it('shows only nonzero diagnoses and preserves pause, resume and permission clearing', async () => {
    const value = representative()
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: { ...summary(), representative: value } } })
    expect(wrapper.text()).not.toContain('Library profiles have not finished fitting')
    await wrapper.get('button').trigger('click')
    const changed = { ...value, counts: { ...value.counts, unconverged_profiles: 2 } }
    await wrapper.setProps({ evaluation: { ...summary(), representative: changed } })
    expect(wrapper.text()).not.toContain('Library profiles have not finished fitting')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('details').text()).toContain('Library profiles have not finished fitting')
    expect(wrapper.text()).not.toContain('Learned profiles picked different destinations')
    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ evaluation: undefined })
    expect(wrapper.find('section').exists()).toBe(false)
  })
  it('adds a quiet, automatically refreshed profile comparison in the existing card and pause boundary', async () => {
    const value = representative();
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: { ...summary(), representative: value } } })
    expect(wrapper.text()).toContain('5 decisions compared; 1 differed')
    expect(wrapper.text()).toContain('Routing is unchanged')
    expect(wrapper.get('details').text()).toContain('3 other observations were excluded')
    expect(wrapper.get('details').text()).toContain('Agreement is not accuracy')
    const announcement = wrapper.get('[role="status"]').text()
    await wrapper.setProps({ evaluation: { ...summary(), representative: { ...value, counts: { ...value.counts, agrees: 5 } } } })
    expect(wrapper.text()).toContain('6 decisions compared')
    expect(wrapper.get('[role="status"]').text()).toBe(announcement)
    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ evaluation: { ...summary(), representative: value } })
    expect(wrapper.text()).toContain('6 decisions compared')
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('5 decisions compared')
    await wrapper.setProps({ evaluation: null })
    expect(wrapper.text()).not.toContain('decisions compared')
  })
  it('labels saturated profile counts as lower bounds without counting invalidated batches as items', () => {
    const value = representative(); value.counts.agrees = 1_000_000; value.counts.invalidated_batches = 9
    expect(normalizeRepresentativeShadowSummary(value)).toMatchObject({ capped: true, skipped: 3 })
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: { ...summary(), representative: value } } })
    expect(wrapper.text()).toContain('profile-comparison counter reached its limit')
  })
  it.each([
    value => { value.version = 'future' }, value => { value.status = 'unavailable' },
    value => { value.version = 'inventory_representative_shadow_v1' },
    value => { value.routingAffected = true }, value => { value.privateText = 'PRIVATE title' },
    value => { value.pending = 33 }, value => { value.counts.agrees = -1 },
    value => { value.counts.agrees = '1' }, value => { value.counts.agrees = 1_000_001 },
    value => { value.counts.privateText = 1 }, value => { value.counts = null },
    value => { value.latency = null }, value => { value.latency.under_1ms = NaN },
    value => { delete value.counts.initialization_sensitive }, value => { value.counts.no_positive_match = 0.5 },
  ])('hides malformed optional profiles while keeping existing counters available', mutate => {
    const value = representative(); mutate(value)
    expect(normalizeRepresentativeShadowSummary(value)).toBeNull()
    const result = normalizeLibraryEvaluationSummary({ ...summary(), representative: value })
    expect(result.representative).toBeNull()
    expect(result.passed).toBe(9)
  })
  it('separates evidence passes from the held subset, not preparation or accuracy', () => {
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: summary() }, slots: { default: 'Protected study details' } })
    expect(wrapper.text()).toContain('9 checks passed')
    expect(wrapper.text()).toContain('5 passing checks were held for confirmation')
    expect(wrapper.text()).toContain('4 did not meet the evidence checks')
    expect(wrapper.text()).toContain('3 could not finish')
    expect(wrapper.find('details').attributes('open')).toBeUndefined()
    expect(wrapper.find('details').text()).toContain('Protected study details')
    expect(wrapper.find('[role="status"]').text()).not.toMatch(/9|5/)
  })
  it('updates automatically, freezes the summary, and resumes at the latest snapshot', async () => {
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: summary() } })
    await wrapper.setProps({ evaluation: summary({ qualified: 5 }) })
    expect(wrapper.text()).toContain('10 checks passed')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
    await wrapper.setProps({ evaluation: summary({ qualified: 6 }) })
    expect(wrapper.text()).toContain('10 checks passed')
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('11 checks passed')
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false')
  })
  it('clears a paused snapshot on failure or permission loss', async () => {
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: summary() } })
    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ evaluation: null })
    expect(wrapper.text()).toContain('unavailable')
    expect(wrapper.text()).not.toContain('9 checks passed')
    await wrapper.setProps({ evaluation: undefined })
    expect(wrapper.find('section').exists()).toBe(false)
  })
  it('shows an honest empty state after restart and a saturation warning', async () => {
    const empty = Object.fromEntries(Object.keys(summary().counts).map(key => [key, 0]))
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: summary() } })
    await wrapper.setProps({ evaluation: summary(empty) })
    expect(wrapper.text()).toContain('No completed evidence checks')
    await wrapper.setProps({ evaluation: summary({ qualified: 1_000_000 }) })
    expect(wrapper.text()).toContain('lower bounds')
  })
  it.each([null, {}, { ...summary(), version: 'future' }, { ...summary(), routingAffected: true },
    { ...summary(), status: 'unavailable' }, { ...summary(), secret: 'hidden' }, { ...summary(), counts: null },
    summary({ secret: 1 }), summary({ busy: undefined }), summary({ busy: -1 }), summary({ busy: 1.2 }),
    summary({ busy: '1' }), summary({ busy: 1_000_001 }), summary({ busy: Infinity }),
  ])('rejects unknown or malformed diagnostics without displaying them: %j', input => {
    expect(normalizeLibraryEvaluationSummary(input)).toBeNull()
  })
})
