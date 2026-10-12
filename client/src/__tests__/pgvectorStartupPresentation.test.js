/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { getPgvectorStartupPresentation } from '../utils/pgvectorStartupPresentation'

const present = (report = {}, selection = {}) => getPgvectorStartupPresentation({
  selection: { status: 'current_process', ...selection, report: {
    schemaVersion: 1, databaseScope: 'embedded_entrypoint', build: 'multi',
    selectedVariant: 'avx2', cpuAvx: 'true', cpuAvx2: 'true', ...report,
  } },
})

describe('pgvector startup compatibility (not operational health)', () => {
  it.each(['avx', 'avx2'])('compares explicit %s support only', selectedVariant => {
    const key = selectedVariant === 'avx' ? 'cpuAvx' : 'cpuAvx2'
    for (const supported of [true, 'true']) {
      expect(present({ selectedVariant, [key]: supported }).label).toBe('CPU match reported at startup')
    }
    for (const unsupported of [false, 'false']) {
      expect(present({ selectedVariant, [key]: unsupported }).label).toBe('CPU mismatch reported at startup')
    }
    for (const unknown of [null, undefined, 'unknown', 'TRUE', 1, {}, []]) {
      expect(present({ selectedVariant, [key]: unknown }).label).toBe('Compatibility unknown')
    }
  })

  it.each(['legacy', 'invalid', 'other_process', 'database_changed', 'settings_changed', 'unavailable', null, 'future'])('keeps %s evidence unknown', status => {
    expect(present({}, { status }).label).toBe('Compatibility unknown')
    expect(present({ selectedVariant: 'generic' }, { status }).label).toBe('Compatibility unknown')
  })

  it.each(['unverified', null, 'future'])('does not compare CPUs with %s database relationship', databaseScope => {
    expect(present({ databaseScope }).label).toBe('Compatibility unknown')
  })

  it.each([undefined, null, 0, 2, '1'])('requires version 1, not %s', schemaVersion => {
    expect(present({ schemaVersion }).label).toBe('Compatibility unknown')
  })

  it.each([null, undefined, [], 'avx2', { selection: [] }, { selection: { report: [] } },
    { selectedVariant: 'avx2', cpuAvx2: 'true' }])('does not treat legacy or malformed data as current (%j)', value => {
    expect(getPgvectorStartupPresentation(value).label).toBe('Compatibility unknown')
  })

  it('describes generic mode without asserting health or CPU support', () => {
    const result = present({ selectedVariant: 'generic', build: 'generic', cpuAvx: null, cpuAvx2: 'unknown' })
    expect(result.label).toBe('Generic selected at startup')
    expect(result.cpuAvx).toBe('Unknown')
    expect(result.cpuAvx2).toBe('Unknown')
    expect(result).not.toHaveProperty('status')
    expect(JSON.stringify(result)).not.toMatch(/healthy/i)
  })

  it.each(['unknown', 'future', {}, null])('does not accept an unrecognized variant %j', selectedVariant => {
    expect(present({ selectedVariant }).label).toBe('Compatibility unknown')
    expect(present({ selectedVariant }).selectedVariant).toBe('unknown')
  })

  it('does not copy arbitrary fields into labels and retains scoped report details', () => {
    const result = present({ build: '<script>bad</script>', cpuAvx: 'secret',
      reporterId: '12345678-1234-4567-8123-123456789abc', recordedAt: '2026-10-12T15:00:00.000Z',
    })
    expect(result.build).toBe('unknown')
    expect(result.cpuAvx).toBe('Unknown')
    expect(JSON.stringify(result)).not.toMatch(/secret|<script>/)
    expect(result.selection.reference).toBe('12345678-1234-4567-8123-123456789abc')
    expect(result.selection.recordedAt).toBe('2026-10-12T15:00:00.000Z')
  })

  it('uses report facts, not conflicting legacy values', () => {
    const result = getPgvectorStartupPresentation({ selectedVariant: 'avx2', cpuAvx2: 'true',
      selection: { status: 'current_process', report: {
        schemaVersion: 1, databaseScope: 'embedded_entrypoint', selectedVariant: 'avx', cpuAvx: 'false',
      } },
    })
    expect(result.label).toBe('CPU mismatch reported at startup')
    expect(result.selectedVariant).toBe('avx')
  })
})
