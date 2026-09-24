/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LibraryUnderstandingSummary from '@/components/command-center/LibraryUnderstandingSummary.vue'

const summary = {
  libraryCount: 3,
  profile: { current: 1, updating: 1, coolingDown: 0, unverified: 0,
    paused: 1, noInventory: 0 },
  recovery: { overdueLibraryCount: 0, workerStalled: false },
  sourceIdentity: { unresolvedItemCount: 0, coveredActiveLibraryCount: 1,
    activeLibraryCount: 2 },
}

describe('LibraryUnderstandingSummary', () => {
  it('shows organic profile progress without treating queued work as an action', () => {
    const wrapper = mount(LibraryUnderstandingSummary, { props: { summary },
      global: { stubs: { RouterLink: true } },
    })
    expect(wrapper.text()).toContain('1 of 3 inventory-derived library profiles are current')
    expect(wrapper.text()).toContain('1 is updating automatically')
    expect(wrapper.text()).toContain('not placement accuracy')
    expect(wrapper.text()).not.toContain('Needs review')
  })

  it('calls out overdue recovery and source IDs with contextual paths', () => {
    const wrapper = mount(LibraryUnderstandingSummary, {
      props: { summary: { ...summary,
        recovery: { overdueLibraryCount: 1, workerStalled: true },
        sourceIdentity: { ...summary.sourceIdentity, unresolvedItemCount: 2 },
      } },
      global: { stubs: { RouterLink: true } },
    })
    expect(wrapper.text()).toContain('Needs review')
    expect(wrapper.text()).toContain('background worker also needs a check')
    expect(wrapper.find('a[href="#libraries"]').exists()).toBe(true)
    wrapper.find('a[href="#libraries"]').trigger('click')
    expect(wrapper.emitted('open-library-status')).toHaveLength(1)
    expect(wrapper.findComponent({ name: 'RouterLink' }).exists()).toBe(true)
  })

  it('does not turn missing data into a healthy zero', () => {
    const wrapper = mount(LibraryUnderstandingSummary)
    expect(wrapper.text()).toContain('temporarily unavailable')
    expect(wrapper.text()).not.toContain('Profiles current')
  })

  it('pauses display updates but clears a lost snapshot', async () => {
    const wrapper = mount(LibraryUnderstandingSummary, { props: { summary } })
    await wrapper.find('button').trigger('click')
    await wrapper.setProps({ summary: { ...summary, profile: { ...summary.profile,
      current: 2, updating: 0 } } })
    expect(wrapper.text()).toContain('1 of 3')
    expect(wrapper.text()).toContain('Display paused')
    await wrapper.setProps({ summary: null })
    expect(wrapper.text()).toContain('temporarily unavailable')
  })
})
