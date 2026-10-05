/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it } from 'vitest'
import { libraryRecoveryDeployment } from '@/utils/libraryRecoveryDeployment'
const diagnostic = (extra = {}) => ({ migration: '20261005_180000_ingestion_compatibility_fence.sql', migrationRecorded: true,
  protocolReady: true, checks: [{ table: 'media_server_items', trigger: 'ingestion_compatibility_rows', status: 'not_always_enabled' }], ...extra })
it('gives a specific disabled-trigger repair without offering to redo an applied migration', () => {
  const result = libraryRecoveryDeployment(diagnostic())
  expect(result.facts.join(' ')).toContain('media_server_items / ingestion_compatibility_rows: not enabled for all writes')
  expect(result.steps.join(' ')).toContain('ENABLE ALWAYS')
  expect(result.steps.join(' ')).toContain('Do not delete the migration record')
})
it.each(['missing', 'definition_mismatch'])('does not suggest merely enabling a %s trigger', status => {
  const result = libraryRecoveryDeployment(diagnostic({ checks: [{ table: 'media_server_items', trigger: 'ingestion_compatibility_rows', status }] }))
  expect(result.steps.join(' ')).toContain('reviewed repair')
  expect(result.steps.join(' ')).not.toContain('ENABLE ALWAYS')
})
it('identifies the exact unrecorded update without claiming a known failure cause', () => {
  const result = libraryRecoveryDeployment(diagnostic({ migrationRecorded: false }))
  expect(result.title).toBe('Database update not recorded')
  expect(result.facts.join(' ')).toContain('20261005_180000_ingestion_compatibility_fence.sql')
  expect(result.steps.join(' ')).toContain('missing record alone does not tell us why')
  expect(result.steps.join(' ')).toContain('CLASSIFARR_SCHEMA_MAINTENANCE')
})
it('distinguishes a connection-protocol failure from database DDL repair', () => {
  const result = libraryRecoveryDeployment(diagnostic({ protocolReady: false, checks: [] }))
  expect(result.title).toBe('Import connection needs an update')
  expect(result.steps).toHaveLength(1)
  expect(result.steps[0]).toContain('Update and restart')
  expect(result.steps[0]).not.toContain('migration')
})
it('does not display untrusted identifiers or invent a cause for incomplete diagnostics', () => {
  for (const value of [null, {}, diagnostic({ checks: [] }), diagnostic({ migration: 'secret' }), diagnostic({ protocolReady: null }),
    diagnostic({ checks: Array(13).fill({}) }), diagnostic({ checks: [{ table: '<script>', trigger: 'secret', status: '__proto__' }] })]) {
    expect(libraryRecoveryDeployment(value)).toMatchObject({ title: 'Setup check unavailable', facts: [] })
  }
})
