/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  createPolicyNativeReadinessSummaryService,
} from '../../services/policyNativeReadinessSummaryService.mjs';
import { jest } from '@jest/globals';
import {
  POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS,
} from '../../services/policyNativeReadinessSummaryContract.mjs';

function buildContext(overrides = {}) {
  return {
    policy: { id: 42, libraryId: 7 },
    routing: {
      configured: true,
      routeReady: true,
      targetName: 'radarr library mapping',
    },
    ...overrides,
  };
}

function buildNativeIntent(overrides = {}) {
  return {
    authority: {
      stateId: 'single_active_native_intent',
      activeIntentCount: 1,
      authoritative: true,
    },
    intent: {
      id: 91,
      policy_id: 42,
      library_id: 7,
      intent_version: 3,
      validation_status: 'valid',
    },
    rules: [{
      intent_role: 'purpose',
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['Animation'] },
    }],
    templates: [],
    validation: {
      status: 'valid',
      error_count: 0,
      warning_count: 0,
      errors: [],
      warnings: [],
    },
    ...overrides,
  };
}

function buildProfileHandoff(overrides = {}) {
  return {
    ok: true,
    profileFreshness: { stale: false },
    evidenceBoundary: {
      projection: {
        version: 'policy.evidence.v1',
        buckets: {},
        warnings: [],
      },
    },
    sideEffects: { libraryProfileRead: true },
    ...overrides,
  };
}

function createService({
  context = buildContext(),
  nativeIntent = buildNativeIntent(),
  profileHandoff = buildProfileHandoff(),
} = {}) {
  const fetchContext = jest.fn().mockResolvedValue(context);
  const fetchNativeIntent = jest.fn().mockResolvedValue(nativeIntent);
  const loadProfileEvidence = jest.fn().mockResolvedValue(profileHandoff);
  const service = createPolicyNativeReadinessSummaryService({
    fetchContext,
    fetchNativeIntent,
    loadProfileEvidence,
  });

  return {
    fetchContext,
    fetchNativeIntent,
    loadProfileEvidence,
    service,
  };
}

describe('policyNativeReadinessSummaryService', () => {
  test('reads authoritative native intent, cached profile freshness, and routing without side effects', async () => {
    const { service, fetchContext, fetchNativeIntent, loadProfileEvidence } = createService();
    const dbClient = { query: jest.fn() };

    const result = await service.getSummary({ dbClient, policyId: 42 });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.AVAILABLE,
      policyId: 42,
      nativeIntent: {
        authorityStateId: 'single_active_native_intent',
        authoritative: true,
        intentVersion: 3,
        purposeRuleCount: 1,
        validationStateId: 'valid',
      },
      readiness: expect.objectContaining({
        stateId: 'ready',
        ready: true,
        nextAction: {
          actionId: 'continue_automation',
          label: 'Continue automation',
        },
      }),
      sideEffects: {
        storedPolicyRead: true,
        storedNativeIntentRead: true,
        cachedProfileRead: true,
        routingConfigurationRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
        routingExecuted: false,
      },
      rawPayloadExposed: false,
    }));
    expect(fetchContext).toHaveBeenCalledWith(dbClient, 42);
    expect(fetchNativeIntent).toHaveBeenCalledWith(dbClient, 42);
    expect(loadProfileEvidence).toHaveBeenCalledWith({ libraryId: 7 });
    expect(dbClient.query).not.toHaveBeenCalled();
  });

  test('degrades an unavailable cached profile to a bounded refresh action', async () => {
    const { service } = createService({
      profileHandoff: {
        ok: false,
        statusId: 'profile_not_found',
        sideEffects: { libraryProfileRead: true },
      },
    });

    const result = await service.getSummary({ dbClient: { query: jest.fn() }, policyId: 42 });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.AVAILABLE,
      readiness: expect.objectContaining({
        stateId: 'stale_profile',
        ready: false,
        nextAction: {
          actionId: 'refresh_profile',
          label: 'Refresh profile',
        },
      }),
      sideEffects: expect.objectContaining({ cachedProfileRead: true }),
    }));
  });

  test('reports non-authoritative stored intent without falling back to legacy workflow state', async () => {
    const { service, loadProfileEvidence } = createService({
      nativeIntent: {
        authority: {
          stateId: 'single_non_authoritative_active_intent',
          activeIntentCount: 1,
          authoritative: false,
        },
        intent: null,
      },
    });

    const result = await service.getSummary({ dbClient: { query: jest.fn() }, policyId: 42 });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.NATIVE_INTENT_UNAVAILABLE,
      nativeIntent: expect.objectContaining({
        authoritative: false,
        validationStateId: 'unavailable',
      }),
      readiness: null,
    }));
    expect(loadProfileEvidence).not.toHaveBeenCalled();
  });

  test('preserves policy-not-found and unexpected-read failures as bounded result states', async () => {
    const missing = createService({ context: null });
    const missingResult = await missing.service.getSummary({ dbClient: { query: jest.fn() }, policyId: 42 });
    expect(missingResult.statusId).toBe(POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.POLICY_NOT_FOUND);

    const unavailable = createPolicyNativeReadinessSummaryService({
      fetchContext: jest.fn().mockRejectedValue(new Error('database unavailable')),
    });
    const unavailableResult = await unavailable.getSummary({
      dbClient: { query: jest.fn() },
      policyId: 42,
    });
    expect(unavailableResult.statusId).toBe(POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.READ_UNAVAILABLE);
    expect(JSON.stringify(unavailableResult)).not.toContain('database unavailable');
  });
});
