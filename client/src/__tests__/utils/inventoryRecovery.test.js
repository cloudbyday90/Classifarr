/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it } from 'vitest'
import { parseInventoryRecovery, recoveryDate, recoveryRetryLabel, safePlexItemLink } from '@/utils/inventoryRecovery'
import { inventoryRecoveryFixture, inventoryRecoveryPlexUrl } from '../fixtures/inventoryRecovery'
it('accepts valid bounded pages and all retry labels', () => {
  const report = inventoryRecoveryFixture()
  expect(parseInventoryRecovery(report, 0)).toBe(report)
  for (const state of ['waiting', 'eligible', 'in_progress', 'source_blocked', 'not_scheduled']) {
    expect(recoveryRetryLabel(state)).not.toBe('Retry state unknown')
  }
  expect(recoveryRetryLabel('unknown')).toBe('Retry state unknown')
  expect(recoveryDate(null)).toBe('Not recorded')
  expect(recoveryDate('bad')).toBe('Not recorded')
  expect(recoveryDate(report.asOf)).not.toBe('Not recorded')
})
it.each([undefined, { version: 9 }, { afterId: 8 }, { pageSize: 99 }, { total: -1 }, { movies: 4 },
  { asOf: 'bad' }, { items: null }, { items: Array(26).fill({}) }, { total: 0, movies: 0 }, { nextCursor: 5 }])('withholds invalid snapshot %j', patch => {
  expect(() => parseInventoryRecovery(patch === undefined ? undefined : { ...inventoryRecoveryFixture(), ...patch }, 0)).toThrow()
})
it.each([{ id: 0 }, { mediaType: 'music' }, { title: null }, { diagnosis: 'x'.repeat(501) }, { retryState: 'pretend' }])('rejects malformed item %j', patch => {
  const report = inventoryRecoveryFixture()
  Object.assign(report.items[0], patch)
  expect(() => parseInventoryRecovery(report, 0)).toThrow()
})
it('rejects out-of-order IDs and cursor mismatches', () => {
  const report = inventoryRecoveryFixture(0, 26)
  report.nextCursor = 24
  expect(() => parseInventoryRecovery(report, 0)).toThrow()
  report.nextCursor = 25; report.items[1].id = 1
  expect(() => parseInventoryRecovery(report, 0)).toThrow()
})
it.each([null, 'javascript:alert(1)', 'https://app.plex.tv.evil.test/', `${inventoryRecoveryPlexUrl}&token=private`,
  inventoryRecoveryPlexUrl.replace('https:', 'http:'), inventoryRecoveryPlexUrl.replace('123', '../private')])('rejects unsafe link %j', url => {
  expect(safePlexItemLink(url)).toBe(false)
})
it('accepts only the existing token-free Plex item URL shape', () => {
  expect(safePlexItemLink(inventoryRecoveryPlexUrl)).toBe(true)
})
