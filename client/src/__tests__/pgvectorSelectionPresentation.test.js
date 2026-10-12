/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { getPgvectorSelectionDetails, getPgvectorSelectionAdvice } from '../utils/pgvectorSelectionPresentation'
import { getPgvectorVariantNotice } from '../utils/pgvectorVariantNotice'

const selection = {
  status: 'current_process',
  report: {
    databaseScope: 'embedded_entrypoint', selectedVariant: 'generic', reason: 'staging_disabled',
    reporterId: '12345678-1234-4567-8123-123456789abc',
    recordedAt: '2026-10-12T15:00:00.000Z', selectedAt: '2026-10-12T14:58:00.000Z',
    databaseStartedAt: '2026-10-12T14:59:00.000Z',
  },
}

describe('pgvector startup evidence presentation', () => {
  it('shows scoped reference points and the actual disabled-staging explanation', () => {
    const details = getPgvectorSelectionDetails(selection)
    expect(details).toMatchObject({ reference: selection.report.reporterId,
      recordedAt: selection.report.recordedAt, selectedAt: selection.report.selectedAt,
      databaseStartedAt: selection.report.databaseStartedAt, scope: 'Embedded entrypoint report' })
    expect(details.summary).toContain('this application process')
    expect(details.advice).toContain('staging was disabled')
    expect(getPgvectorVariantNotice({ enabled: true, pgvectorVariant: 'generic', pgvectorSelection: selection })).toBe(details.advice)
  })
  it.each(['staging_invalid', 'generic_build', 'cpu_no_avx', 'cpu_unknown',
    'optimized_binary_unavailable', 'staging_target_unsafe', 'staging_failed', 'variant_binaries_missing', 'unknown'])('maps fixed reason %s', reason => {
    const actual = { ...selection, report: { ...selection.report, reason } }
    expect(getPgvectorSelectionAdvice(actual)).toBe(getPgvectorSelectionDetails(actual).advice)
  })
  it('shows optimized selection as an observation, not loaded-binary proof', () => {
    const actual = { ...selection, report: { ...selection.report, reason: 'optimized_staged', selectedVariant: 'avx2' } }
    expect(getPgvectorSelectionDetails(actual).advice).toContain('does not verify')
    expect(getPgvectorSelectionAdvice(actual)).toBeNull()
  })
  it.each(['other_process', 'database_changed', 'settings_changed', 'unavailable', 'legacy', 'invalid', 'unsupported'])('does not prescribe fixes using %s evidence', status => {
    const actual = { ...selection, status }
    expect(getPgvectorSelectionDetails(actual).advice).toBe('Use current startup logs before acting on a saved selection report.')
    expect(getPgvectorSelectionAdvice(actual)).toBe(getPgvectorSelectionDetails(actual).summary)
  })
  it.each([null, undefined, [], false, 'text', {}, { report: null }])('handles missing or malformed response %j', value => {
    expect(getPgvectorSelectionDetails(value).reference).toBe('Unknown')
    expect(getPgvectorSelectionAdvice(value)).toBeNull()
  })
  it('does not echo arbitrary values or imply scope for native/older starts', () => {
    const actual = { status: '<script>', report: { reason: '<img>', reporterId: '<img>',
      recordedAt: '<img>', selectedAt: '2026-02-30T00:00:00.000Z', databaseStartedAt: 7 } }
    expect(JSON.stringify(getPgvectorSelectionDetails(actual))).not.toContain('<')
    expect(getPgvectorSelectionDetails(actual)).toMatchObject({ recordedAt: 'Unknown', selectedAt: 'Unknown', databaseStartedAt: 'Unknown' })
    expect(getPgvectorSelectionAdvice({ ...selection, report: { ...selection.report, databaseScope: 'unverified' } })).toBeNull()
    expect(getPgvectorSelectionAdvice({ ...selection, report: { ...selection.report, reason: '<img>' } })).toBeNull()
    expect(getPgvectorSelectionAdvice({ ...selection, report: { ...selection.report, reason: 1 } })).toBeNull()
    expect(getPgvectorSelectionAdvice({ ...selection, status: { toString: null } })).toContain('malformed')
  })
})
