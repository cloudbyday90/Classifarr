/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test, vi } from 'vitest'
import { buildPolicyComparisonRows, formatFractionPercent } from '../../utils/policyStatsComparison'

const rowsFor = (current, previous) => buildPolicyComparisonRows([
  { period: 'previous_7_days', ...previous },
  { period: 'last_7_days', ...current },
])

describe('policy comparison values', () => {
  test('compares fractions, percentages and counts using their explicit API scales', () => {
    expect(rowsFor({ decisions: '12', accuracy: '1.0', auto_rate: '25.0' },
      { decisions: '9', accuracy: '0.5', auto_rate: '75.0' })).toEqual([
      { id: 'decisions', label: 'Decisions', current: '12', previous: '9', change: '+3' },
      { id: 'accuracy', label: 'Accuracy', current: '100.0%', previous: '50.0%', change: '+50.0 percentage points' },
      { id: 'auto_rate', label: 'Auto Rate', current: '25.0%', previous: '75.0%', change: '-50.0 percentage points' },
    ])
  })

  test('preserves zero counts and rates, including a zero baseline', () => {
    const rows = rowsFor({ decisions: 0, accuracy: 0, auto_rate: 100 }, { decisions: 0, accuracy: 0, auto_rate: 0 })
    expect(rows.map(row => row.change)).toEqual(['0', '0.0 percentage points', '+100.0 percentage points'])
    expect(rows.map(row => row.previous)).toEqual(['0', '0.0%', '0.0%'])
  })

  test('missing periods and fields remain unavailable without removing known values', () => {
    const rows = buildPolicyComparisonRows([{ period: 'last_7_days', decisions: 0, accuracy: null, auto_rate: null }])
    expect(rows.map(row => row.current)).toEqual(['0', 'N/A', 'N/A'])
    expect(rows.every(row => row.previous === 'N/A' && row.change === 'N/A')).toBe(true)
    expect(buildPolicyComparisonRows(null).every(row => row.current === 'N/A' && row.change === 'N/A')).toBe(true)
  })

  test.each([null, undefined, '', ' ', false, true, [], {}, NaN, Infinity, -Infinity,
    'NaN', 'Infinity', '1.2oops', '0x1', '<img src=x onerror=alert(1)>', -1, '1e309'])('rejects invalid values: %j', value => {
    const rows = rowsFor({ decisions: value, accuracy: value, auto_rate: value }, { decisions: 0, accuracy: 0, auto_rate: 0 })
    expect(rows.every(row => row.current === 'N/A' && row.change === 'N/A')).toBe(true)
    expect(formatFractionPercent(value)).toBe('N/A')
  })

  test('does not invoke object coercion while validating untrusted values', () => {
    const valueOf = vi.fn(() => 1)
    expect(formatFractionPercent({ valueOf })).toBe('N/A')
    expect(valueOf).not.toHaveBeenCalled()
  })

  test.each([0.1, Number.MAX_SAFE_INTEGER + 1, '9007199254740993'])('rejects an invalid count: %s', decisions => {
    expect(rowsFor({ decisions }, { decisions: 1 })[0]).toMatchObject({ current: 'N/A', change: 'N/A' })
  })

  test('rejects rates outside their declared scales without clamping them', () => {
    const rows = rowsFor({ accuracy: 1.01, auto_rate: 100.01 }, { accuracy: 0, auto_rate: 0 })
    expect(rows.slice(1).every(row => row.current === 'N/A' && row.change === 'N/A')).toBe(true)
  })

  test.each([0.50001, 0.49999])('rounds tiny changes to neutral zero: %s', accuracy => {
    expect(rowsFor({ accuracy }, { accuracy: 0.5 })[1].change).toBe('0.0 percentage points')
  })

  test('subtracts before rounding and handles numeric strings numerically', () => {
    const rows = rowsFor({ accuracy: '0.1004', auto_rate: '9' }, { accuracy: '0.0996', auto_rate: '10' })
    expect(rows[1]).toMatchObject({ current: '10.0%', previous: '10.0%', change: '+0.1 percentage points' })
    expect(rows[2].change).toBe('-1.0 percentage point')
    expect(formatFractionPercent(' 5e-1 ')).toBe('50.0%')
  })
})
