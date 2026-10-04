/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { usePresetSave } from '../../composables/usePresetSave'

let scope
afterEach(() => scope?.stop())

function setup() {
  const api = { createCustomPreset: vi.fn(), updateCustomPreset: vi.fn() }
  scope = effectScope()
  return { api, state: scope.run(() => usePresetSave(api)) }
}

describe('usePresetSave', () => {
  it('owns pending state until settlement and rejects concurrent submissions', async () => {
    const { api, state } = setup()
    const request = Promise.withResolvers()
    api.createCustomPreset.mockReturnValue(request.promise)
    const first = state.save({ name: 'New' })
    expect(state.pending.value).toBe(true)
    state.reset()
    expect(await state.save({ name: 'Duplicate' })).toBe(false)
    expect(api.createCustomPreset).toHaveBeenCalledTimes(1)
    request.resolve({ data: { id: 1 } })
    expect(await first).toBe(true)
    expect(state.pending.value).toBe(false)
  })

  it('updates an existing preset without creating another', async () => {
    const { api, state } = setup()
    expect(await state.save({ name: 'Updated' }, 9)).toBe(true)
    expect(api.updateCustomPreset).toHaveBeenCalledWith(9, { name: 'Updated' })
    expect(api.createCustomPreset).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'Check its name and settings'], [422, 'Check its name and settings'],
    [401, 'Sign in again'], [403, 'do not have permission'], [429, 'Wait before trying again'],
  ])('shows safe feedback for an explicit %s rejection and permits a manual retry', async (status, message) => {
    const { api, state } = setup()
    api.createCustomPreset.mockRejectedValueOnce({ response: { status, data: { error: 'secret detail' } } })
    expect(await state.save({})).toBe(false)
    expect(state.error.value).toContain(message)
    expect(state.error.value).not.toContain('secret')
    expect(state.needsReview.value).toBe(false)
    expect(await state.save({})).toBe(true)
    expect(state.error.value).toBe('')
  })

  it.each([undefined, 408, 409, 500, 503])('requires review after an uncertain %s result, even after reopening', async status => {
    const { api, state } = setup()
    api.createCustomPreset.mockRejectedValueOnce({ response: { status } })
    expect(await state.save({})).toBe(false)
    expect(state.pending.value).toBe(false)
    expect(state.needsReview.value).toBe(true)
    state.reset()
    expect(await state.save({})).toBe(false)
    expect(api.createCustomPreset).toHaveBeenCalledTimes(1)
    state.reset({ reviewed: true })
    expect(state.error.value).toBe('')
    expect(await state.save({})).toBe(true)
  })

  it.each([true, false])('does not publish a late outcome after disposal (success=%s)', async success => {
    const { api, state } = setup()
    const request = Promise.withResolvers()
    api.createCustomPreset.mockReturnValue(request.promise)
    const first = state.save({})
    scope.stop()
    if (success) request.resolve({})
    else request.reject(new Error('private failure'))
    expect(await first).toBe(false)
    expect(state.error.value).toBe('')
    state.reset({ reviewed: true })
    expect(await state.save({})).toBe(false)
    expect(api.createCustomPreset).toHaveBeenCalledTimes(1)
  })
})
