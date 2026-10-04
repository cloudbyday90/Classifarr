/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { usePresetSave } from '../../composables/usePresetSave'

const requestId = 'efb9b919-5d23-4778-b731-888343987e71'
const receipt = (state = 'pending', resolved = false, presetId = null) => ({ requestId, state, resolved, presetId })
const scopes = []
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop() })
function setup() {
  const api = { getPendingCustomPresetSave: vi.fn().mockResolvedValue({ request: null }),
    beginCustomPresetSave: vi.fn().mockResolvedValue({ data: receipt() }),
    completeCustomPresetSave: vi.fn().mockResolvedValue({ data: receipt('saved', false, 9) }),
    resolveCustomPresetSave: vi.fn().mockResolvedValue({ data: receipt('saved', true, 9) }),
    updateCustomPreset: vi.fn(), createCustomPreset: vi.fn() }
  const scope = effectScope()
  scopes.push(scope)
  return { api, scope, state: scope.run(() => usePresetSave(api)) }
}

describe('usePresetSave', () => {
  it('owns one operation through reservation, save and acknowledgement, without legacy writes', async () => {
    const { api, state } = setup()
    const request = Promise.withResolvers()
    api.completeCustomPresetSave.mockReturnValue(request.promise)
    const first = state.save({ name: 'New' })
    expect(state.pending.value).toBe(true)
    expect(await state.save({ name: 'Duplicate' })).toBe(false)
    await flushPromises()
    expect(api.completeCustomPresetSave).toHaveBeenCalledWith(requestId, { name: 'New' })
    state.reset()
    request.resolve({ data: receipt('saved', false, 9) })
    expect(await first).toBe(true)
    expect(state.pending.value).toBe(false)
    expect(api.resolveCustomPresetSave).toHaveBeenCalledWith(requestId)
    expect(api.createCustomPreset).not.toHaveBeenCalled()
  })

  it('does not treat failed receipt acknowledgement as a failed save', async () => {
    const { api, state } = setup()
    api.resolveCustomPresetSave.mockRejectedValueOnce(new Error('private'))
    expect(await state.save({ name: 'Saved' })).toBe(true)
    expect(state.error.value).toContain('Preset saved.')
    expect(state.needsReview.value).toBe(true)
    expect(await state.save({})).toBe(false)
    expect(await state.reviewCreation()).toBe('saved')
    expect(state.needsReview.value).toBe(false)
    expect(state.notice.value).toBe('Preset saved.')
  })

  it.each([undefined, 400, 401, 403, 408, 409, 429, 500, 503])('does not clear an uncertain creation after %s without resolution', async status => {
    const { api, state } = setup()
    api.completeCustomPresetSave.mockRejectedValueOnce({ response: { status, data: { error: 'private detail' } } })
    expect(await state.save({})).toBe(false)
    state.reset({ reviewed: true })
    expect(state.needsReview.value).toBe(true)
    expect(await state.save({})).toBe(false)
    expect(state.error.value).not.toContain('private')
    api.resolveCustomPresetSave.mockResolvedValueOnce({ data: receipt('cancelled', true) })
    expect(await state.reviewCreation()).toBe('cancelled')
    expect(state.notice.value).toContain('Not saved')
    expect(api.completeCustomPresetSave).toHaveBeenCalledTimes(1)
    expect(await state.save({})).toBe(true)
  })

  it('recovers a lost reservation response by reading server state, with no write replay', async () => {
    const { api, state } = setup()
    api.beginCustomPresetSave.mockRejectedValueOnce(new Error('lost'))
    expect(await state.save({})).toBe(false)
    api.getPendingCustomPresetSave.mockResolvedValueOnce({ request: receipt() })
    api.resolveCustomPresetSave.mockResolvedValueOnce({ data: receipt('cancelled', true) })
    expect(await state.reviewCreation()).toBe('cancelled')
    expect(api.completeCustomPresetSave).not.toHaveBeenCalled()
  })

  it.each(['pending', 'saved'])('discovers a %s request after reload without resolving on mount', async outcome => {
    const { api, state } = setup()
    api.getPendingCustomPresetSave.mockResolvedValue({ request: receipt(outcome) })
    await state.initialize()
    expect(state.needsReview.value).toBe(true)
    expect(api.resolveCustomPresetSave).not.toHaveBeenCalled()
    expect(await state.save({})).toBe(false)
    expect(await state.reviewCreation()).toBe('saved')
    expect(api.completeCustomPresetSave).not.toHaveBeenCalled()
  })

  it('keeps failed reads blocked and recovers when there is no reservation', async () => {
    const { api, state } = setup()
    api.getPendingCustomPresetSave.mockRejectedValueOnce(new Error('private'))
    await state.initialize()
    expect(state.needsReview.value).toBe(true)
    expect(await state.reviewCreation()).toBe('cancelled')
    expect(api.resolveCustomPresetSave).not.toHaveBeenCalled()
    expect(state.needsReview.value).toBe(false)
  })

  it.each([{}, { request: { requestId: 'bad' } }])('rejects malformed status rather than assuming it is empty', async value => {
    const { api, state } = setup()
    api.getPendingCustomPresetSave.mockResolvedValue(value)
    await state.initialize()
    expect(state.needsReview.value).toBe(true)
    expect(await state.reviewCreation()).toBeNull()
  })

  it.each([{}, receipt(), receipt('saved', false, 9), { ...receipt('saved', true, 9), requestId: 'f'.repeat(36) }])('keeps an invalid reconciliation blocked', async value => {
    const { api, state } = setup()
    api.getPendingCustomPresetSave.mockResolvedValue({ request: receipt() })
    api.resolveCustomPresetSave.mockResolvedValue({ data: value })
    await state.initialize()
    expect(await state.reviewCreation()).toBeNull()
    expect(state.needsReview.value).toBe(true)
    expect(state.error.value).toContain('Could not confirm')
  })

  it('reports a saved preset that has since been deleted', async () => {
    const { api, state } = setup()
    api.getPendingCustomPresetSave.mockResolvedValue({ request: receipt('saved') })
    api.resolveCustomPresetSave.mockResolvedValue({ data: receipt('saved', true) })
    await state.initialize()
    await state.reviewCreation()
    expect(state.notice.value).toContain('since been deleted')
  })

  it.each(['begin', 'complete', 'resolve', 'read'])('ignores late %s completion after disposal', async phase => {
    const { api, scope, state } = setup()
    const request = Promise.withResolvers()
    const method = { begin: 'beginCustomPresetSave', complete: 'completeCustomPresetSave', resolve: 'resolveCustomPresetSave', read: 'getPendingCustomPresetSave' }[phase]
    api[method].mockReturnValue(request.promise)
    const saving = state.save({})
    await flushPromises()
    scope.stop()
    request.resolve(phase === 'read' ? { request: null } : { data: receipt(phase === 'begin' ? 'pending' : 'saved', phase === 'resolve', phase === 'begin' ? null : 9) })
    expect(await saving).toBe(false)
    expect(state.error.value).toBe('')
    expect(await state.save({})).toBe(false)
    if (phase === 'begin') expect(api.completeCustomPresetSave).not.toHaveBeenCalled()
  })

  it.each([400, 401, 403, 429])('preserves explicit refusal handling for updates (%s)', async status => {
    const { api, state } = setup()
    api.updateCustomPreset.mockRejectedValueOnce({ response: { status } })
    expect(await state.save({}, 9)).toBe(false)
    expect(state.needsReview.value).toBe(false)
    expect(await state.save({}, 9)).toBe(true)
    expect(api.beginCustomPresetSave).not.toHaveBeenCalled()
  })

  it('retains manual list review for uncertain updates', async () => {
    const { api, state } = setup()
    api.updateCustomPreset.mockRejectedValueOnce(new Error('lost'))
    expect(await state.save({}, 9)).toBe(false)
    expect(state.isCreationReview()).toBe(false)
    state.reset()
    expect(state.needsReview.value).toBe(true)
    expect(await state.reviewCreation()).toBeNull()
    state.reset({ reviewed: true })
    expect(await state.save({}, 9)).toBe(true)
  })
})
