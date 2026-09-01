/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  CAPABILITY_METRICS_ERROR_LOG_HANDOFF_ID,
  CAPABILITY_METRICS_PERSISTENCE_FAILURE_REASON_CODE,
  buildCapabilityMetricsErrorLogHandoffLocation,
  removeCapabilityMetricsErrorLogHandoffQuery,
  resolveCapabilityMetricsErrorLogHandoffReasonCode,
} from '@/utils/capabilityMetricsErrorLogHandoff'

describe('capabilityMetricsErrorLogHandoff', () => {
  it('builds the sole fixed Logs handoff without dynamic diagnostic detail', () => {
    const location = buildCapabilityMetricsErrorLogHandoffLocation()

    expect(location).toEqual({
      name: 'Settings',
      query: {
        tab: 'logs',
        handoff: CAPABILITY_METRICS_ERROR_LOG_HANDOFF_ID,
        reasonCode: CAPABILITY_METRICS_PERSISTENCE_FAILURE_REASON_CODE,
      },
    })
    expect(Object.isFrozen(location)).toBe(true)
    expect(JSON.stringify(location)).not.toContain('private-provider')
    expect(JSON.stringify(location)).not.toContain('model')
  })

  it('recognizes only an exact fixed handoff and removes only its query fields', () => {
    const query = {
      tab: 'logs',
      handoff: CAPABILITY_METRICS_ERROR_LOG_HANDOFF_ID,
      reasonCode: CAPABILITY_METRICS_PERSISTENCE_FAILURE_REASON_CODE,
      preserved: 'value',
    }

    expect(resolveCapabilityMetricsErrorLogHandoffReasonCode(query))
      .toBe(CAPABILITY_METRICS_PERSISTENCE_FAILURE_REASON_CODE)
    expect(resolveCapabilityMetricsErrorLogHandoffReasonCode({
      ...query,
      reasonCode: 'untrusted_reason_code',
    })).toBeNull()
    expect(removeCapabilityMetricsErrorLogHandoffQuery(query)).toEqual({
      tab: 'logs',
      preserved: 'value',
    })
  })
})
