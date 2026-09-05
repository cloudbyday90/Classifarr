/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LibraryObservationTrends from '@/components/library/LibraryObservationTrends.vue'
import { observationTrendChange, observationTrendUnchanged } from '@/utils/observationTrendDisplay'
import { libraryObservationHistoryFixture } from './fixtures/libraryObservationHistoryFixture'

const render = (samples = libraryObservationHistoryFixture().samples, libraries = []) =>
  mount(LibraryObservationTrends, { props: { samples, libraries } })

describe('per-library coverage trends', () => {
  it('shows uneven progress, explicit denominators and escaped current labels', () => {
    const wrapper = render(undefined, [{ id: 1, name: '<img src=x onerror=alert(1)>' }])
    expect(wrapper.get('h4').text()).toContain('<img src=x onerror=alert(1)> (library 1)')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('Keywords 2 / 4 (50%)')
    expect(wrapper.text()).toContain('captured +1, fresh 0, keywords +1, language 0')
    expect(wrapper.text()).toContain('Inventory population changed; comparison withheld.')
    expect(wrapper.findAll('caption')).toHaveLength(2)
    expect(wrapper.findAll('th[scope="row"]')).toHaveLength(4)
    expect(wrapper.findAll('[role="region"][tabindex="0"]')).toHaveLength(2)
  })
  it('preserves missing, capacity and out-of-selection history without zero filling', () => {
    const { samples } = libraryObservationHistoryFixture()
    samples[0].libraryCoverage = null
    samples[0].status = 'capacity_exceeded'
    samples[1].libraryIds = [2]
    samples[1].libraryCoverage = null
    samples[1].acquisitionConfigured = false
    const wrapper = render(samples)
    expect(wrapper.text()).toContain('Per-library coverage unavailable.')
    expect(wrapper.text()).toContain('Inventory limit exceeded; counts withheld.')
    expect(wrapper.text()).toContain('Library outside this sample selection.')
    expect(wrapper.text()).toContain('Per-library detail unavailable.')
    expect(wrapper.text()).toContain('Acquisition was not configured.')
    expect(wrapper.text()).not.toContain('0%')
  })
  it('shows both a gap and population change, selection changes and unchanged intervals', () => {
    const { samples } = libraryObservationHistoryFixture()
    samples[0].selectionChanged = true
    Object.assign(samples[0].libraryCoverage[0], { comparison: 'sample_gap', delta: null, populationChanged: true })
    Object.assign(samples[0].libraryCoverage[1], { comparison: 'comparable', populationChanged: false,
      delta: { capturedRows: 0, freshRows: -1, keywordRows: 0, languageRows: 0 }, unchangedIntervals: 3 })
    const wrapper = render(samples)
    expect(wrapper.text()).toContain('Gap between hourly samples; comparison withheld.')
    expect(wrapper.text()).toContain('Inventory population also changed.')
    expect(wrapper.text()).toContain('Selected libraries changed')
    expect(wrapper.text()).toContain('unchanged across 3 hourly intervals.')
    expect(wrapper.text()).toContain('fresh -1')
  })
  it.each([{ samples: [] }, { samples: [{ libraryIds: [] }] }])('describes absent or empty populations: %j', ({ samples }) => {
    const wrapper = render(samples)
    expect(wrapper.text()).toContain('No selected libraries')
    expect(wrapper.find('table').exists()).toBe(false)
  })
  it.each([
    ['previous_unavailable', 'Previous per-library coverage unavailable'],
    ['newly_selected', 'Newly selected library'], ['configuration_changed', 'Acquisition configuration changed'],
    ['unexpected', 'Comparison unavailable'], ['comparable', 'Comparison unavailable'],
  ])('describes comparison boundaries: %s', (comparison, text) => {
    expect(observationTrendChange({ comparison })).toContain(text)
  })
  it('uses singular intervals and omits an unknown or zero unchanged period', () => {
    expect(observationTrendUnchanged({ unchangedIntervals: 1 })).toContain('1 hourly interval.')
    expect(observationTrendUnchanged({ unchangedIntervals: 0 })).toBe('')
    expect(observationTrendUnchanged(null)).toBe('')
  })
})
