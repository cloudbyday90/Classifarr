/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { applyHealthObservation, healthFreshnessGuidance } from '../utils/healthObservationFreshness'
import HealthFreshnessNote from '../components/system/HealthFreshnessNote.vue'

describe('health observation presentation', () => {
  const service = Object.freeze({ status: 'connected', trend: 'improving' })
  it('uses server age rather than the browser clock or receipt time', () => {
    const detail = Object.freeze({ freshness: Object.freeze({ state: 'fresh', ageMs: 0, maxAgeMs: 90000 }) })
    expect(applyHealthObservation(service, detail)).toMatchObject({ status: 'healthy', trend: 'improving', observedStatus: 'healthy' })
    expect(service.status).toBe('connected')
  })
  it.each([undefined, {}, { freshness: {} }, { freshness: { state: 'future' } },
    { freshness: { state: 'fresh', ageMs: -1, maxAgeMs: 90000 } },
    { freshness: { state: 'fresh', ageMs: 90000, maxAgeMs: 90000 } },
    { freshness: { state: 'fresh', ageMs: '0', maxAgeMs: 90000 } },
    { freshness: { state: 'fresh', ageMs: 0, maxAgeMs: Infinity } },
    { freshness: { state: 'stale', ageMs: 90000, maxAgeMs: 90000 } },
  ])('conservatively handles unknown or expired metadata %j', detail => {
    expect(applyHealthObservation(service, detail)).toMatchObject({ status: 'unknown', observedStatus: 'healthy', trend: null })
  })
  it.each(['disabled', 'not configured'])('preserves inactive %s without a timestamp', status => {
    expect(applyHealthObservation({ status }, undefined).freshness.state).toBe('inactive')
  })
  it.each(['check_time_invalid', 'check_time_future'])('directs unverifiable %s to clock/log review', reason => {
    expect(healthFreshnessGuidance('unknown', reason)).toContain('server clock and logs')
  })
  it.each(['fresh', 'inactive'])('does not display a warning for %s', state => {
    const wrapper = mount(HealthFreshnessNote, { props: { state } })
    expect(wrapper.find('[data-testid="health-freshness-note"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('escapes unknown check metadata and keeps it outside a live status region', () => {
    const wrapper = mount(HealthFreshnessNote, { props: { checkedAt: '<img src=x onerror=alert(1)>', observedStatus: 'healthy' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('Check time unavailable')
    expect(wrapper.text()).toContain('Last reported status: Healthy')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
