/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LibraryEvaluationSummary from '@/components/command-center/LibraryEvaluationSummary.vue'
import { normalizeLibraryEvaluationSummary } from '@/utils/libraryEvaluationSummary'
import { normalizeRepresentativeShadowSummary } from '@/utils/representativeShadowSummary'

function representative() {
  const keys = ['agrees', 'disagrees', 'known_item', 'known_description', 'scope_changed', 'representation_changed',
    'sparse_profiles', 'unstable_profiles', 'ambiguous_profiles', 'invalid_input', 'missing_query', 'duplicate', 'expired', 'capacity', 'invalidated_batches']
  return { version: 'inventory_representative_shadow_v1', status: 'available', routingAffected: false, pending: 2,
    counts: { ...Object.fromEntries(keys.map(key => [key, 0])), agrees: 4, disagrees: 1, known_item: 3 },
    latency: { under_1ms: 0, under_10ms: 5, at_least_10ms: 0 } }
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
  it('adds a quiet, automatically refreshed profile comparison in the existing card and pause boundary', async () => {
    const value = representative();
    const wrapper = mount(LibraryEvaluationSummary, { props: { evaluation: { ...summary(), representative: value } } })
    expect(wrapper.text()).toContain('5 decisions compared; 1 differed')
    expect(wrapper.text()).toContain('Routing is unchanged')
    expect(wrapper.get('details').text()).toContain('3 observations were skipped')
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
    value => { value.routingAffected = true }, value => { value.privateText = 'PRIVATE title' },
    value => { value.pending = 33 }, value => { value.counts.agrees = -1 },
    value => { value.counts.agrees = '1' }, value => { value.counts.agrees = 1_000_001 },
    value => { value.counts.privateText = 1 }, value => { value.counts = null },
    value => { value.latency = null }, value => { value.latency.under_1ms = NaN },
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
