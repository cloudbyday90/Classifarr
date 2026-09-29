/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import RetryReadinessSummary from '@/components/command-center/RetryReadinessSummary.vue'

const mock = vi.hoisted(() => ({ state: null }))
vi.mock('@/composables/useRetryReadiness', () => ({ useRetryReadiness: () => mock.state }))
const makeReport = () => ({ inspected: 6, hasMore: false, observedAt: '2026-09-29T20:00:00Z', earliestRetryAt: '2026-09-29T20:01:00Z',
  counts: { cached_ready: 1, provider_ready: 1, provider_wait: 1, settings_blocked: 1, scheduled: 1, held: 1 } })
const render = (props = {}) => mount(RetryReadinessSummary, { props, global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to.path || to"><slot /></a>' } } } })
beforeEach(() => {
  mock.state = Object.fromEntries(Object.entries({ report: makeReport(), paused: false, unavailable: false,
    stale: false, forbidden: false, loading: false, nextCheckAt: '2026-09-29T20:01:00Z' }).map(([key, value]) => [key, ref(value)]))
  mock.state.togglePaused = vi.fn()
})
describe('RetryReadinessSummary', () => {
  it('shows OMDb local usage without cache promises or web-search settings', () => {
    mock.state.report.value = { ...makeReport(), scope: 'omdb', inspected: 5,
      counts: { ...makeReport().counts, cached_ready: 0 },
      quota: { status: 'available', used: 9, limit: 10, resetAt: '2026-09-30T00:00:00Z' } }
    const wrapper = render({ scope: 'omdb' })
    expect(wrapper.get('h2').text()).toBe('OMDb retries')
    expect(wrapper.findAll('dl dd')).toHaveLength(5)
    expect(wrapper.text()).toContain('Local daily usage: 9 of 10')
    expect(wrapper.text()).toContain('no reserved quota')
    expect(wrapper.text()).not.toContain('Cached results ready')
    expect(wrapper.text()).toContain('Review OMDb settings')
  })
  it('keeps zero counts in the legend without drawing false chart segments', () => {
    mock.state.report.value = { ...makeReport(), scope: 'omdb', inspected: 5,
      counts: { cached_ready: 0, provider_ready: 0, provider_wait: 5, settings_blocked: 0, scheduled: 0, held: 0 },
      quota: { status: 'limit_reached', used: 10, limit: 10, resetAt: '2026-09-30T00:00:00Z' } }
    const wrapper = render({ scope: 'omdb' })
    expect(wrapper.findAll('.stacked-bar span')).toHaveLength(1)
    expect(wrapper.findAll('dl dd')).toHaveLength(5)
  })
  it('suppresses OMDb usage when stale, and propagates pause changes to the selector', async () => {
    mock.state.stale.value = true
    const wrapper = render({ scope: 'omdb' })
    expect(wrapper.find('.quota').exists()).toBe(false)
    mock.state.paused.value = true
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('pause-change')).toEqual([[true]])
  })
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
