/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import RetryReadinessSummary from '@/components/command-center/RetryReadinessSummary.vue'

const mock = vi.hoisted(() => ({ state: null }))
vi.mock('@/composables/useRetryReadiness', () => ({ useRetryReadiness: () => mock.state }))
const makeReport = () => ({ inspected: 6, hasMore: false, observedAt: '2026-09-29T20:00:00Z', earliestRetryAt: '2026-09-29T20:01:00Z',
  counts: { cached_ready: 1, provider_ready: 1, provider_wait: 1, settings_blocked: 1, scheduled: 1, held: 1 } })
const render = () => mount(RetryReadinessSummary, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to.path || to"><slot /></a>' } } } })
beforeEach(() => {
  mock.state = Object.fromEntries(Object.entries({ report: makeReport(), paused: false, unavailable: false,
    stale: false, forbidden: false, loading: false, nextCheckAt: '2026-09-29T20:01:00Z' }).map(([key, value]) => [key, ref(value)]))
  mock.state.togglePaused = vi.fn()
})
describe('RetryReadinessSummary', () => {
  it('pairs every colored segment with text counts and only one fixed settings action', () => {
    const wrapper = render()
    expect(wrapper.findAll('dl dd')).toHaveLength(6)
    expect(wrapper.get('.ready-count').text()).toContain('2of 6 checked ready')
    expect(wrapper.get('.stacked-bar').attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.text()).toContain('Keep them off if intentional')
    expect(wrapper.text()).toContain('Next status check:')
    expect(wrapper.text()).not.toContain('100%')
  })
  it('discloses partial coverage and cannot extrapolate whole-backlog readiness', () => {
    mock.state.report.value.hasMore = true
    expect(render().text()).toContain('Partial view: first 50 pending rows per queue')
  })
  it.each(['stale', 'unavailable'])('hides readiness chart and action when %s', flag => {
    mock.state[flag].value = true
    const wrapper = render()
    expect(wrapper.find('dl').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('Current readiness cannot be confirmed')
  })
  it('distinguishes loading from an observed empty queue', () => {
    mock.state.report.value = null; mock.state.loading.value = true
    expect(render().text()).toContain('Checking readiness')
    mock.state.report.value = { ...makeReport(), inspected: 0, counts: {} }
    expect(render().text()).toContain('No action needed')
  })
  it('exposes a native keyboard pause control, not a worker stop', async () => {
    mock.state.paused.value = true
    const wrapper = render()
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
    await wrapper.get('button').trigger('click')
    expect(mock.state.togglePaused).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('background retries are unchanged')
    expect(wrapper.text()).not.toContain('Next status check:')
  })
  it('omits the panel after lost authorization', () => {
    mock.state.forbidden.value = true
    expect(render().find('section').exists()).toBe(false)
  })
})
