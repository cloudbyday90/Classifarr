/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_NATIVE_CREATE_HANDOFF_STATUS_IDS,
  buildPolicyNativeCreateHandoff,
} from '@/utils/policyNativeCreateHandoff'

function buildCreateResponse(overrides = {}) {
  return {
    id: 91,
    name: 'Sci-Fi Movies Policy',
    library_name: 'Sci-Fi Movies',
    native_intent_establishment: {
      statusId: 'initial_intent_established',
      intentId: 501,
      routingConfigured: false,
      ruleCount: 1,
    },
    ...overrides,
  }
}

function buildPersistedPolicy(overrides = {}) {
  return {
    id: 91,
    name: 'Sci-Fi Movies Policy',
    library_name: 'Sci-Fi Movies',
    policy_intent_contract: {
      source: 'native_intent',
      purpose: [{ signal_type: 'genres' }],
      hard_limits: [{ signal_type: 'certification' }],
      helpful_hints: [],
      avoid: [],
    },
    ...overrides,
  }
}

describe('policyNativeCreateHandoff', () => {
  it('summarizes persisted native authority and routing without reading a client draft', () => {
    const handoff = buildPolicyNativeCreateHandoff({
      createResponse: buildCreateResponse(),
      persistedPolicy: buildPersistedPolicy(),
    })

    expect(handoff).toMatchObject({
      statusId: POLICY_NATIVE_CREATE_HANDOFF_STATUS_IDS.CREATED,
      policy: {
        id: 91,
        name: 'Sci-Fi Movies Policy',
        libraryName: 'Sci-Fi Movies',
      },
      declaredIntent: {
        authorityLabel: 'Declared destination intent',
        ruleCount: 2,
        purposeRuleCount: 1,
      },
      routing: {
        configured: false,
        label: 'Routing setup still needed',
      },
      detailsAvailable: true,
    })
  })

  it('uses the successful create receipt when the persisted details are unavailable', () => {
    const handoff = buildPolicyNativeCreateHandoff({
      createResponse: buildCreateResponse(),
    })

    expect(handoff).toMatchObject({
      statusId: POLICY_NATIVE_CREATE_HANDOFF_STATUS_IDS.CREATED_DETAILS_UNAVAILABLE,
      declaredIntent: {
        ruleCount: 1,
      },
      detailsAvailable: false,
    })
  })

  it('rejects an unverified or incomplete create response', () => {
    expect(buildPolicyNativeCreateHandoff({
      createResponse: { id: 91 },
      persistedPolicy: buildPersistedPolicy(),
    })).toBeNull()
  })
})
