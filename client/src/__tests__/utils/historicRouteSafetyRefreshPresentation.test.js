/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'

import {
  formatHistoricRouteSafetyRefreshTimestamp,
  historicRouteSafetyRefreshExecutionPresentation,
  historicRouteSafetyRefreshStatusPresentation,
  isHistoricRouteSafetyRefreshReceiptInFlight,
} from '@/utils/historicRouteSafetyRefreshPresentation'

describe('historic route-safety refresh presentation', () => {
  it('maps protected lifecycle identifiers to fixed operator-facing language', () => {
    expect(historicRouteSafetyRefreshExecutionPresentation('queued')).toEqual({
      label: 'Queued',
      tone: 'info',
    })
    expect(historicRouteSafetyRefreshStatusPresentation('runtime_awaiting_decision')).toEqual({
      label: 'Needs a decision',
      description: 'Current policy evaluation requires an operator decision.',
      tone: 'warning',
    })
  })

  it('does not surface an unrecognized protected identifier to the operator', () => {
    expect(historicRouteSafetyRefreshStatusPresentation('internal_provider_payload')).toEqual({
      label: 'Status unavailable',
      description: 'Classifarr returned an unrecognized protected status.',
      tone: 'warning',
    })
    expect(historicRouteSafetyRefreshExecutionPresentation('internal_command')).toEqual({
      label: 'Unavailable',
      tone: 'warning',
    })
  })

  it('only identifies genuinely worker-owned receipt states as in flight', () => {
    expect(isHistoricRouteSafetyRefreshReceiptInFlight({
      receipt: { executionStatusId: 'requested' },
      records: [],
    })).toBe(true)
    expect(isHistoricRouteSafetyRefreshReceiptInFlight({
      receipt: { executionStatusId: 'finalized' },
      records: [{ reconciliationStatusId: 'queue_processing' }],
    })).toBe(true)
    expect(isHistoricRouteSafetyRefreshReceiptInFlight({
      receipt: { executionStatusId: 'finalized' },
      records: [{ reconciliationStatusId: 'runtime_awaiting_decision' }],
    })).toBe(false)
  })

  it('renders unavailable timestamps without leaking invalid source data', () => {
    expect(formatHistoricRouteSafetyRefreshTimestamp()).toBe('Not available')
    expect(formatHistoricRouteSafetyRefreshTimestamp('not-a-date')).toBe('Not available')
  })
})
