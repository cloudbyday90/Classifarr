/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({
  default: {
    decay: vi.fn(),
    promote: vi.fn(),
    purge: vi.fn(),
  },
}))

import api from '@/api'
import { useEvidenceActions } from '@/composables/useEvidenceActions'

describe('useEvidenceActions composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('decay returns ok with changed=false and sets already-candidate message', async () => {
    api.decay.mockResolvedValueOnce({ changed: false, row: { id: 5 } })

    const actions = useEvidenceActions()
    const result = await actions.decay(5)

    expect(result).toEqual({ ok: true, changed: false, row: { id: 5 } })
    expect(actions.actionSuccess.value).toContain('already in candidate')
    expect(actions.actionLoading.value).toBe(false)
  })

  it('promote returns ok with changed=true and sets active message', async () => {
    api.promote.mockResolvedValueOnce({ changed: true, row: { id: 7 } })

    const actions = useEvidenceActions()
    const result = await actions.promote(7)

    expect(result).toEqual({ ok: true, changed: true, row: { id: 7 } })
    expect(actions.actionSuccess.value).toContain('set to active')
  })

  it('purge returns deleted count and error paths surface error message', async () => {
    api.purge.mockResolvedValueOnce({ deleted: 3 })

    const actions = useEvidenceActions()
    const result = await actions.purge({ status: 'candidate' })

    expect(result).toEqual({ ok: true, deleted: 3 })
    expect(actions.actionSuccess.value).toContain('Purged 3')

    api.promote.mockRejectedValueOnce(new Error('Permission denied'))
    const failResult = await actions.promote(99)

    expect(failResult).toEqual({ ok: false })
    expect(actions.actionError.value).toBe('Permission denied')
  })

  it('decay uses fallback message when error has no message', async () => {
    api.decay.mockRejectedValueOnce({})

    const actions = useEvidenceActions()
    const result = await actions.decay(10)

    expect(result).toEqual({ ok: false })
    expect(actions.actionError.value).toBe('Failed to decay evidence row')
  })

  it('decay sets candidate message when changed is true', async () => {
    api.decay.mockResolvedValueOnce({ changed: true, row: { id: 3 } })

    const actions = useEvidenceActions()
    const result = await actions.decay(3)

    expect(result.changed).toBe(true)
    expect(actions.actionSuccess.value).toContain('set to candidate')
  })

  it('promote sets already-active message and uses fallback on error without message', async () => {
    api.promote.mockResolvedValueOnce({ changed: false, row: { id: 8 } })

    const actions = useEvidenceActions()
    const okResult = await actions.promote(8)

    expect(okResult.changed).toBe(false)
    expect(actions.actionSuccess.value).toContain('already active')

    api.promote.mockRejectedValueOnce({})
    const failResult = await actions.promote(8)

    expect(failResult).toEqual({ ok: false })
    expect(actions.actionError.value).toBe('Failed to promote evidence row')
  })
})
