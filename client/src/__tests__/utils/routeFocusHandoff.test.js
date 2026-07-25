/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  clearRouteFocusHandoff,
  consumeRouteFocusHandoff,
  requestRouteFocusHandoff,
} from '@/utils/routeFocusHandoff'

afterEach(() => {
  clearRouteFocusHandoff('LibraryDetail')
})

describe('routeFocusHandoff', () => {
  it('provides one non-persistent focus destination to the next route', () => {
    expect(requestRouteFocusHandoff({
      routeName: 'LibraryDetail',
      targetId: 'library-arr-mapping',
      fallbackTargetId: 'library-detail-title',
    })).toBe(true)

    expect(consumeRouteFocusHandoff('LibraryDetail')).toEqual({
      targetId: 'library-arr-mapping',
      fallbackTargetId: 'library-detail-title',
    })
    expect(consumeRouteFocusHandoff('LibraryDetail')).toBeNull()
  })

  it('rejects incomplete handoffs and can clear a pending route transition', () => {
    expect(requestRouteFocusHandoff({ routeName: '', targetId: 'library-arr-mapping' })).toBe(false)
    expect(requestRouteFocusHandoff({ routeName: 'LibraryDetail', targetId: '' })).toBe(false)

    requestRouteFocusHandoff({ routeName: 'LibraryDetail', targetId: 'library-arr-mapping' })
    expect(clearRouteFocusHandoff('LibraryDetail')).toBe(true)
    expect(consumeRouteFocusHandoff('LibraryDetail')).toBeNull()
  })
})
