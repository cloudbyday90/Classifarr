/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { libraryRecoveryReport } from '@/utils/libraryRecoveryGuidance'

const library = (state, extra = {}) => ({ id: 5, name: 'Movies', media_type: 'movie', is_active: true,
  ingestion_status: { state }, ...extra })

describe('library recovery guidance', () => {
  it('keeps healthy, empty, disabled, archived and unsupported libraries quiet', () => {
    expect(libraryRecoveryReport([]).items).toEqual([])
    for (const row of [library('complete'), library('disabled'), library('legacy_owner_unknown', { is_active: false }),
      library('legacy_owner_unknown', { archived_at: '2026-10-05' }), library('active', { media_type: 'music' })]) {
      expect(libraryRecoveryReport([row]).items).toEqual([])
    }
  })
  it.each(['automatic', 'active', 'review', 'deployment_required', 'unconfigured', 'disabled'])('uses the backend %s recovery decision', mode => {
    const result = libraryRecoveryReport([library('legacy_owner_unknown', { ingestion_status: { state: 'legacy_owner_unknown', recoveryMode: mode } })])
    expect(result.items).toHaveLength(mode === 'disabled' ? 0 : 1)
    expect(result.attention).toBe(['review', 'deployment_required', 'unconfigured'].includes(mode) ? 1 : 0)
    if (mode === 'deployment_required') expect(result.items[0].deployment.title).toBe('Setup check unavailable')
  })
  it.each(['active', 'requested', 'awaiting_import', 'interrupted', 'retry_wait'])('shows %s as automatic progress', state => {
    expect(libraryRecoveryReport([library(state)])).toMatchObject({ progress: 1, attention: 0 })
  })
  it('distinguishes source retry from source review and puts blockers first', () => {
    const result = libraryRecoveryReport([
      library('retry_wait', { ingestion_status: { state: 'retry_wait', sourceRecovery: { state: 'open' } } }),
      library('retry_wait', { id: 6, ingestion_status: { state: 'retry_wait', sourceRecovery: { state: 'review' } } }),
    ])
    expect(result.items.map(item => item.id)).toEqual([6, 5])
    expect(result.items[0].title).toBe('Media server needs review')
    expect(result.items[1].title).toBe('Waiting for media server')
  })
  it('does not guess completion or safe automatic takeover from unknown status', () => {
    for (const state of ['legacy_owner_unknown', 'future_state', '__proto__', 'constructor', undefined]) {
      expect(libraryRecoveryReport([library(state)]).attention).toBe(1)
    }
  })
  it('removes stale advice when unavailable and distinguishes loading from a healthy empty snapshot', () => {
    expect(libraryRecoveryReport([library('legacy_owner_unknown')], { unavailable: true })).toMatchObject({ state: 'unavailable', items: [] })
    expect(libraryRecoveryReport(null).state).toBe('loading')
    expect(libraryRecoveryReport([]).state).toBe('ready')
  })
  it('creates only fixed internal routes and deduplicates valid IDs', () => {
    const result = libraryRecoveryReport([null, library('active', { id: 'javascript:alert(1)' }),
      library('active', { id: -1 }), library('active'), library('active')])
    expect(result.items.map(item => item.path)).toEqual(['/libraries/5'])
  })
})
