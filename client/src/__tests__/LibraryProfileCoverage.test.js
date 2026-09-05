/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LibraryProfileCoverage from '@/components/library/LibraryProfileCoverage.vue'

const observation = { version: 'library.profile_observation.v1', population: 'inventory_rows', itemCount: 3, duplicateIdentifiedRowCount: 1,
  traits: Object.fromEntries(['rating', 'genres', 'studio', 'keywords', 'language'].map(field => [field, { observedCount: 2, unknownCount: 1 }])) }

describe('library profile metadata coverage', () => {
  it('explains the population and associates known and missing counts with row/column headers', () => {
    const wrapper = mount(LibraryProfileCoverage, { props: { observation } })
    expect(wrapper.text()).toContain('share of all 3 inventory items')
    expect(wrapper.text()).toContain('percentages can total more than 100%')
    expect(wrapper.text()).toContain('1 entries repeat a known movie or TV identity')
    expect(wrapper.get('caption').text()).toBe('Metadata coverage')
    expect(wrapper.findAll('th[scope="col"]').map(node => node.text())).toEqual(['Trait', 'Known', 'Missing'])
    expect(wrapper.findAll('th[scope="row"]')).toHaveLength(5)
    expect(wrapper.findAll('tbody tr').map(node => node.findAll('td').map(cell => cell.text()))).toEqual(Array(5).fill(['2', '1']))
    expect(wrapper.find('button').exists()).toBe(false)
  })
  it.each([null, {}, { ...observation, version: 'other' }, { ...observation, itemCount: -1 }, { ...observation, traits: {} }])('does not invent coverage for a legacy or malformed profile: %j', value => {
    const wrapper = mount(LibraryProfileCoverage, { props: { observation: value } })
    expect(wrapper.text()).toContain('coverage has not been measured')
    expect(wrapper.find('table').exists()).toBe(false)
  })
  it('distinguishes unmeasured historical snapshots from profiles waiting for refresh', () => {
    const wrapper = mount(LibraryProfileCoverage, { props: { historical: true } })
    expect(wrapper.text()).toContain('percentage denominator is unverified')
    expect(wrapper.text()).not.toContain('automatic profile refresh')
  })
})
