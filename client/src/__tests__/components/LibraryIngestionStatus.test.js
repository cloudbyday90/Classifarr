/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LibraryIngestionStatus from '@/components/library/LibraryIngestionStatus.vue'
import { ingestionPollInterval, libraryIngestionState, librarySyncResultMessage } from '@/utils/libraryIngestionStatus'

const library = state => ({ ingestion_status: { state, items: 25, total: 100, pages: 2, retryAt: '2026-09-27T18:00:00Z' } })
describe('Library ingestion status', () => {
  it.each(['open', 'probing', 'review'])('explains source recovery %s without masking ownership or completion', state => {
    const value = { ingestion_status: { state: 'awaiting_import', sourceRecovery: { state } } }
    const wrapper = mount(LibraryIngestionStatus, { props: { library: value } })
    expect(wrapper.get('[role="status"]').text()).toContain(state === 'review' ? 'recovery needs review' : 'Waiting for media server')
    expect(wrapper.find('progress').exists()).toBe(false)
    expect(ingestionPollInterval(value)).toBe(10000)
    expect(libraryIngestionState(value, true)).toBe('requested')
    for (const phase of ['active', 'disabled', 'unconfigured', 'legacy_owner_unknown', 'complete']) {
      expect(libraryIngestionState({ ingestion_status: { ...value.ingestion_status, state: phase } })).toBe(phase)
    }
    wrapper.unmount()
  })
  it('uses the later source/library eligibility time and retains inconclusive canary guidance', async () => {
    const value = library('retry_wait')
    value.ingestion_status.sourceRecovery = { state: 'open', retryAt: '2026-09-28T18:00:00Z', reason: 'probe_inconclusive' }
    value.ingestion_status.preflight = { phase: 'collections', message: 'Permission denied.', nextStep: 'Check library access.' }
    const wrapper = mount(LibraryIngestionStatus, { props: { library: value } })
    expect(wrapper.text()).toContain(new Date(value.ingestion_status.sourceRecovery.retryAt).toLocaleString())
    expect(wrapper.text()).toContain('Check library access.')
    await wrapper.setProps({ library: { ingestion_status: { state: 'retry_wait', sourceRecovery: { state: 'open', retryAt: 'invalid' } } } })
    expect(wrapper.text()).not.toContain('Retry eligible after')
    expect(wrapper.text()).not.toContain('Check library access.')
    wrapper.unmount()
  })
  it('never labels a deferred request as completed', () => {
    for (const reason of ['ingestion_owned', 'ingestion_capacity', 'retry_wait', 'legacy_owner_unknown', 'source_disabled', 'source_unconfigured', 'source_preflight_unavailable', 'future']) {
      expect(librarySyncResultMessage({ deferred: true, reason })).not.toContain('complete')
    }
    expect(librarySyncResultMessage({ success: true })).toBe('Library sync complete')
    expect(librarySyncResultMessage({ success: true, skipped: true })).toContain('not imported')
    expect(librarySyncResultMessage(null)).toContain('unavailable')
  })
  it.each(['media', 'collections'])('shows the last %s preflight cause and action, suppressing stale details', async phase => {
    const value = { ...library('retry_wait'), ingestion_status: { ...library('retry_wait').ingestion_status,
      preflight: { phase, message: 'The source did not report a total.', nextStep: 'Check server pagination. Automatic retry is scheduled.' } } }
    const wrapper = mount(LibraryIngestionStatus, { props: { library: value } })
    expect(wrapper.get('[role="status"]').text()).toContain('import check needs attention')
    expect(wrapper.get('[role="status"]').text()).toContain('Check server pagination')
    expect(wrapper.text()).toContain('Check server pagination')
    expect(wrapper.find('progress').exists()).toBe(false)
    await wrapper.setProps({ unavailable: true })
    expect(wrapper.text()).not.toContain('Check server pagination')
    await wrapper.setProps({ unavailable: false, library: { ingestion_status: { state: 'active', preflight: value.ingestion_status.preflight } } })
    expect(wrapper.text()).not.toContain('Check server pagination')
    await wrapper.setProps({ library: { ingestion_status: { state: 'retry_wait', preflight: { phase: 'unknown' } } } })
    expect(wrapper.text()).toContain('Import retry scheduled')
    wrapper.unmount()
  })
  it.each([
    ['awaiting_import', 'Library backfill scheduled', 10000],
    ['active', 'Importing library', 2000], ['interrupted', 'Import interrupted', 10000],
    ['retry_wait', 'Import retry scheduled', 10000], ['legacy_owner_unknown', 'owner needs verification', 10000],
    ['disabled', 'Import paused', null], ['unconfigured', 'Import waiting for setup', null], ['requested', 'Import requested', 2000],
  ])('explains %s without claiming completion', (state, text, interval) => {
    const wrapper = mount(LibraryIngestionStatus, { props: { library: library(state) } })
    expect(wrapper.get('[role="status"]').text()).toContain(text)
    expect(ingestionPollInterval(library(state))).toBe(interval)
    expect(wrapper.find('progress').exists()).toBe(state === 'active')
    wrapper.unmount()
  })
  it('only displays a percentage for a known positive total and labels its limits', async () => {
    const wrapper = mount(LibraryIngestionStatus, { props: { library: library('active') } })
    expect(wrapper.get('progress').attributes('value')).toBe('25')
    expect(wrapper.text()).toContain('final checks still required')
    await wrapper.setProps({ library: { ingestion_status: { state: 'active', items: 25, total: null } } })
    expect(wrapper.find('progress').exists()).toBe(false)
    await wrapper.setProps({ library: { ingestion_status: { state: 'active', items: 150, total: 100 } } })
    expect(wrapper.get('progress').attributes('value')).toBe('100')
    wrapper.unmount()
  })
  it('does not announce changing counts and does not display an invented retry time', async () => {
    const wrapper = mount(LibraryIngestionStatus, { props: { library: library('retry_wait') } })
    expect(wrapper.text()).toContain('25 items processed')
    expect(wrapper.get('[role="status"]').text()).not.toContain('25')
    expect(wrapper.text()).toContain('Retry eligible after')
    await wrapper.setProps({ library: { ingestion_status: { state: 'retry_wait', retryAt: 'invalid', items: -1 } } })
    expect(wrapper.text()).not.toContain('Retry eligible after')
    expect(wrapper.text()).toContain('0 items processed')
    wrapper.unmount()
  })
  it('keeps stale progress distinct from current progress', () => {
    const wrapper = mount(LibraryIngestionStatus, { props: { library: library('active'), unavailable: true } })
    expect(wrapper.text()).toContain('last status may be out of date')
    expect(wrapper.find('progress').exists()).toBe(false)
    wrapper.unmount()
  })
  it('does not spin on an unowned legacy running record or a completed import', () => {
    expect(libraryIngestionState({ sync_status: { status: 'running' } })).toBe('legacy_owner_unknown')
    expect(libraryIngestionState(null)).toBe('complete')
    expect(libraryIngestionState(library('complete'), true)).toBe('requested')
    expect(ingestionPollInterval(library('complete'))).toBeNull()
    const wrapper = mount(LibraryIngestionStatus, { props: { library: library('complete') } })
    expect(wrapper.find('section').exists()).toBe(false)
    wrapper.unmount()
  })
})
