/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useMediaIdentityReceiptRecovery } from '@/composables/useMediaIdentityReceiptRecovery'
import { clearRecoveryReference, readRecoveryReference, recoveryReference, storeRecoveryReference } from '@/utils/mediaIdentityRecoveryStorage'
import api from '@/api'

vi.mock('@/api', () => ({ default: { getMediaIdentityReceipt: vi.fn() } }))
const previewId = '2e851bf4-9497-4b99-8b7c-e8117a05c762'
const reference = { version: 1, itemId: 1, previewId }
const receipt = { itemId: 1, previewId, auditId: 99, tmdbId: 12, mediaType: 'movie', sourceVersion: 'a'.repeat(64), confirmedAt: '2026-09-05T12:00:00Z' }
const confirmed = { version: 1, status: 'confirmed', receipt }
let scope, recovery
beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  api.getMediaIdentityReceipt.mockResolvedValue({ version: 1, status: 'not_observed', receipt: null })
  scope = effectScope()
  recovery = scope.run(useMediaIdentityReceiptRecovery)
})
afterEach(() => { scope.stop(); vi.restoreAllMocks(); sessionStorage.clear() })

describe('identity confirmation receipt recovery', () => {
  it('persists only the reference, restores it, and recovers a later commit with GET', async () => {
    recovery.remember(1, previewId)
    expect(readRecoveryReference()).toEqual(reference)
    scope.stop()
    scope = effectScope()
    recovery = scope.run(useMediaIdentityReceiptRecovery)
    expect(recovery.restore()).toBe(true)
    await recovery.check()
    expect(recovery.phase.value).toBe('unknown')
    expect(readRecoveryReference()).toEqual(reference)
    api.getMediaIdentityReceipt.mockResolvedValue(confirmed)
    await recovery.check()
    expect(recovery.receipt.value).toEqual(receipt)
    expect(recovery.phase.value).toBe('confirmed')
    expect(readRecoveryReference()).toBeNull()
    expect(api.getMediaIdentityReceipt.mock.calls).toEqual([[1, previewId], [1, previewId]])
  })
  it.each([undefined, 401, 403, 503])('retains an unknown outcome on receipt read failure %s', async status => {
    recovery.remember(1, previewId)
    api.getMediaIdentityReceipt.mockRejectedValue({ response: status ? { status } : undefined })
    await recovery.check()
    expect(recovery.phase.value).toBe('unknown')
    expect(recovery.receipt.value).toBeNull()
    expect(readRecoveryReference()).toEqual(reference)
    expect(recovery.notice.value).toContain([401, 403].includes(status) ? 'same active administrator' : 'outcome remains unknown')
  })
  it.each([
    null, { ...confirmed, version: 2 }, { ...confirmed, status: 'not_observed' },
    ...[{ itemId: 2 }, { previewId: 'other' }, { auditId: 0 }, { tmdbId: '12' }, { mediaType: 'person' }, { sourceVersion: null }, { sourceVersion: 'bad' }, { confirmedAt: null }, { confirmedAt: 'bad' }]
      .map(change => ({ ...confirmed, receipt: { ...receipt, ...change } })),
  ])('does not announce malformed or mismatched evidence as confirmed: %j', async result => {
    recovery.remember(1, previewId)
    api.getMediaIdentityReceipt.mockResolvedValue(result)
    await recovery.check()
    expect(recovery.phase.value).toBe('unknown')
    expect(recovery.receipt.value).toBeNull()
  })
  it.each(['dismiss', 'replace', 'dispose'])('ignores a late receipt after %s and retains any newer reference', async action => {
    let resolve
    api.getMediaIdentityReceipt.mockImplementation(() => new Promise(done => { resolve = done }))
    recovery.remember(1, previewId)
    const check = recovery.check()
    await recovery.check()
    expect(api.getMediaIdentityReceipt).toHaveBeenCalledTimes(1)
    if (action === 'dispose') scope.stop()
    else recovery.clear()
    if (action === 'replace') recovery.remember(2, previewId)
    resolve(confirmed)
    await check
    expect(recovery.receipt.value).toBeNull()
    expect(readRecoveryReference()).toEqual(action === 'dismiss' ? null : { ...reference, itemId: action === 'replace' ? 2 : 1 })
  })
  it('supports in-memory recovery when browser persistence throws', async () => {
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => { throw new Error('storage blocked') })
    recovery.remember(1, previewId)
    expect(recovery.storageWarning.value).toContain('Keep this page open')
    api.getMediaIdentityReceipt.mockResolvedValue(confirmed)
    await recovery.check()
    expect(recovery.phase.value).toBe('confirmed')
  })
  it('ignores invalid storage and cannot delete a newer pending reference', () => {
    expect(recovery.restore()).toBe(false)
    for (const value of [null, {}, { ...reference, itemId: '1' }, { ...reference, previewId: 'bad' }]) {
      expect(recoveryReference(value)).toBeNull()
      expect(storeRecoveryReference(value)).toBe(false)
    }
    expect(() => recovery.remember(1, 'bad')).toThrow('Invalid confirmation reference')
    storeRecoveryReference({ ...reference, title: 'never retain', token: 'never retain' })
    expect(JSON.parse(sessionStorage.getItem(sessionStorage.key(0)))).toEqual(reference)
    clearRecoveryReference({ ...reference, itemId: 2 })
    expect(readRecoveryReference()).toEqual(reference)
    sessionStorage.setItem(sessionStorage.key(0), 'malformed JSON')
    expect(readRecoveryReference()).toBeNull()
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readRecoveryReference()).toBeNull()
  })
});
