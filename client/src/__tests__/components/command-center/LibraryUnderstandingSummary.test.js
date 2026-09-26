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
    expect(wrapper.text()).toContain('1 of 3')
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toContain('33%')
    expect(wrapper.text()).toContain('1 updating')
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
    expect(wrapper.text()).toContain('Check delayed library updates')
    expect(wrapper.text()).toContain('background worker needs a check')
    expect(wrapper.find('a[href="#libraries"]').exists()).toBe(true)
    wrapper.find('a[href="#libraries"]').trigger('click')
    expect(wrapper.emitted('open-library-status')).toHaveLength(1)
    expect(wrapper.find('a[href="/libraries/identity-review"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('See items & recovery')
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
    expect(wrapper.text()).toContain('Overview paused')
    await wrapper.setProps({ summary: null })
    expect(wrapper.text()).toContain('temporarily unavailable')
  })

  it('keeps pending decisions distinct and prioritizes them over unconfirmed recovery', async () => {
    const wrapper = mount(LibraryUnderstandingSummary, { props: {
      summary: { ...summary, sourceIdentity: { ...summary.sourceIdentity, unresolvedItemCount: 11 } },
      pendingDecisionCount: 4,
    }, global: { stubs: { SourceIdentityIssuesPanel: true } } })
    expect(wrapper.text()).toContain('Review the pending decisions')
    expect(wrapper.findAll('.metric-number').map(node => node.text())).toEqual(['11', '4'])
    await wrapper.find('a[href="#needs-attention"]').trigger('click')
    expect(wrapper.emitted('open-decisions')).toHaveLength(1)
    await wrapper.find('button[aria-controls="overview-source-issues"]').trigger('click')
    expect(wrapper.findComponent({ name: 'SourceIdentityIssuesPanel' }).props('expectedCount')).toBe(11)
    await wrapper.setProps({ pendingDecisionCount: null })
    expect(wrapper.text()).toContain('Status unavailable')
    expect(wrapper.text()).toContain('Check the metadata issues')
  })

  it('has honest loading, empty, unavailable, and all-current states', async () => {
    const wrapper = mount(LibraryUnderstandingSummary, { props: { loading: true }, global: { stubs: { RouterLink: true } } })
    expect(wrapper.text()).toContain('Checking library status')
    await wrapper.setProps({ summary: { ...summary, libraryCount: 0 } })
    expect(wrapper.text()).toContain('No libraries connected')
    expect(wrapper.find('[role="img"]').exists()).toBe(false)
    await wrapper.setProps({ summary: { ...summary, profile: { ...summary.profile, current: 3, updating: 0, paused: 0 } }, pendingDecisionCount: 0 })
    expect(wrapper.text()).toContain('No action indicated by these checks')
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toContain('100%')
    await wrapper.setProps({ pendingDecisionCount: null })
    expect(wrapper.text()).toContain('Wait for decision status')
  })

  it('resumes with the latest snapshot and does not freeze lost decision access', async () => {
    const wrapper = mount(LibraryUnderstandingSummary, { props: { summary, pendingDecisionCount: 4 } })
    await wrapper.find('button').trigger('click')
    await wrapper.setProps({ pendingDecisionCount: null })
    expect(wrapper.text()).toContain('Status unavailable')
    await wrapper.setProps({ pendingDecisionCount: 2 })
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.decision-number').text()).toBe('2')
    await wrapper.setProps({ pendingDecisionCount: 0 })
    expect(wrapper.text()).toContain('Check library update progress')
  })
})
