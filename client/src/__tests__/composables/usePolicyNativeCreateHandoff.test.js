/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it, vi } from 'vitest'
import { usePolicyNativeCreateHandoff } from '@/composables/usePolicyNativeCreateHandoff'

function buildCreateResponse() {
  return {
    data: {
      id: 91,
      name: 'Sci-Fi Movies Policy',
      library_name: 'Sci-Fi Movies',
      native_intent_establishment: {
        statusId: 'initial_intent_established',
        intentId: 501,
        routingConfigured: true,
        ruleCount: 1,
      },
    },
  }
}

describe('usePolicyNativeCreateHandoff', () => {
  it('reloads the persisted policy after a successful native create receipt', async () => {
    const loadPolicy = vi.fn().mockResolvedValue({
      id: 91,
      name: 'Sci-Fi Movies Policy',
      library_name: 'Sci-Fi Movies',
      policy_intent_contract: {
        source: 'native_intent',
        purpose: [{ signal_type: 'genres' }],
        hard_limits: [],
        helpful_hints: [],
        avoid: [],
      },
    })
    const { handoff, establishHandoff } = usePolicyNativeCreateHandoff({ loadPolicy })

    await expect(establishHandoff(buildCreateResponse())).resolves.toBe(true)

    expect(loadPolicy).toHaveBeenCalledWith(91)
    expect(handoff.value).toMatchObject({
      detailsAvailable: true,
      routing: { configured: true },
    })
  })

  it('keeps the successful receipt when the follow-up read fails', async () => {
    const loadPolicy = vi.fn().mockRejectedValue(new Error('connection unavailable'))
    const { handoff, establishHandoff } = usePolicyNativeCreateHandoff({ loadPolicy })

    await expect(establishHandoff(buildCreateResponse())).resolves.toBe(true)

    expect(handoff.value).toMatchObject({
      detailsAvailable: false,
      policy: { id: 91 },
    })
  })
})
