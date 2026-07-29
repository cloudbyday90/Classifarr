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
  activeProfileRefresh = null,
  profileRefreshCandidate = null,
  profileRefreshCircuit = null,
  profileRefreshCircuitError = null,
} = {}) {
  const fetchContext = jest.fn().mockResolvedValue(context);
  const fetchNativeIntent = jest.fn().mockResolvedValue(nativeIntent);
  const loadProfileEvidence = jest.fn().mockResolvedValue(profileHandoff);
  const findActiveProfileRefresh = jest.fn().mockResolvedValue(activeProfileRefresh);
  const findProfileRefreshCandidate = jest.fn().mockResolvedValue(profileRefreshCandidate);
  const findProfileRefreshCircuit = profileRefreshCircuitError
    ? jest.fn().mockRejectedValue(profileRefreshCircuitError)
    : jest.fn().mockResolvedValue(profileRefreshCircuit);
  const service = createPolicyNativeReadinessSummaryService({
    fetchContext,
    fetchNativeIntent,
    loadProfileEvidence,
    findActiveProfileRefresh,
    findProfileRefreshCandidate,
    findProfileRefreshCircuit,
  });

  return {
    fetchContext,
    fetchNativeIntent,
    loadProfileEvidence,
    findActiveProfileRefresh,
    findProfileRefreshCandidate,
    findProfileRefreshCircuit,
    service,
  };
}

describe('policyNativeReadinessSummaryService', () => {
  test('reads authoritative native intent, cached profile freshness, and routing without side effects', async () => {
    const {
      service,
      fetchContext,
      fetchNativeIntent,
      loadProfileEvidence,
      findActiveProfileRefresh,
      findProfileRefreshCandidate,
      findProfileRefreshCircuit,
    } = createService();
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
        profileRefreshOutboxRead: false,
        profileRefreshCircuitRead: false,
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
    expect(findActiveProfileRefresh).not.toHaveBeenCalled();
    expect(findProfileRefreshCandidate).not.toHaveBeenCalled();
    expect(findProfileRefreshCircuit).not.toHaveBeenCalled();
    expect(dbClient.query).not.toHaveBeenCalled();
  });

  test('reports automatic recovery instead of a browser-facing refresh action for an unavailable cached profile', async () => {
    const { service, findActiveProfileRefresh } = createService({
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
          actionId: 'await_automatic_profile_recovery',
          label: 'Profile recovery is automatic',
        },
      }),
      profileRecovery: {
        stateId: 'scheduled',
        label: 'Recovery scheduled',
        message: 'Classifarr will refresh this library profile automatically in the background. No action is needed.',
      },
      sideEffects: expect.objectContaining({ cachedProfileRead: true }),
    }));
    expect(findActiveProfileRefresh).toHaveBeenCalledWith({
      client: expect.any(Object),
      libraryId: 7,
    });
  });

  test('projects queued background recovery from the persisted refresh outbox', async () => {
    const { service, findProfileRefreshCandidate, findProfileRefreshCircuit } = createService({
      profileHandoff: {
        ok: false,
        statusId: 'profile_not_found',
        sideEffects: { libraryProfileRead: true },
      },
      activeProfileRefresh: { id: 88, processingState: 'pending' },
    });

    const result = await service.getSummary({ dbClient: { query: jest.fn() }, policyId: 42 });

    expect(result).toEqual(expect.objectContaining({
      profileRecovery: {
        stateId: 'queued',
        label: 'Recovery queued',
        message: 'Classifarr has queued an automatic library-profile refresh. No action is needed.',
      },
      sideEffects: expect.objectContaining({ profileRefreshOutboxRead: true }),
    }));
    expect(findProfileRefreshCandidate).not.toHaveBeenCalled();
    expect(findProfileRefreshCircuit).not.toHaveBeenCalled();
  });

  test('projects only the current circuit state without exposing circuit internals', async () => {
    const { service, findProfileRefreshCandidate, findProfileRefreshCircuit } = createService({
      profileHandoff: {
        ok: false,
        statusId: 'profile_not_found',
        sideEffects: { libraryProfileRead: true },
      },
      profileRefreshCandidate: {
        libraryId: 7,
        profileState: 'missing_profile',
        profileGeneratedAt: null,
        observedItemCount: 12,
        observedItemHighWaterMark: 91,
      },
      profileRefreshCircuit: {
        valid: true,
        circuitState: 'open',
        consecutiveFailureCount: 3,
        lastTerminalOutboxId: 93,
        lastFailureCode: 'profile_refresh_unknown_failed',
        nextProbeAt: '2026-07-28T14:00:00.000Z',
      },
    });

    const result = await service.getSummary({ dbClient: { query: jest.fn() }, policyId: 42 });

    expect(result).toEqual(expect.objectContaining({
      readiness: expect.objectContaining({
        nextAction: {
          actionId: 'await_automatic_profile_recovery',
          label: 'Profile recovery is automatic',
        },
      }),
      profileRecovery: {
        stateId: 'awaiting_automatic_probe',
        label: 'Recovery awaiting automatic probe',
        message: 'Classifarr is waiting before its next automatic profile recovery check. No action is needed.',
      },
      sideEffects: expect.objectContaining({ profileRefreshCircuitRead: true }),
    }));
    expect(findProfileRefreshCandidate).toHaveBeenCalledWith({
      client: expect.any(Object),
      libraryId: 7,
    });
    expect(findProfileRefreshCircuit).toHaveBeenCalledWith({
      client: expect.any(Object),
      libraryId: 7,
      sourceEventId: 'library-profile:7:missing_profile:items:12:high-water:91',
    });
    expect(JSON.stringify(result)).not.toMatch(/profile_refresh_unknown_failed|2026-07-28|outboxId/i);
  });

  test('reads the current circuit when the outbox lookup finds no persisted active row', async () => {
    const { service, findProfileRefreshCandidate, findProfileRefreshCircuit } = createService({
      profileHandoff: {
        ok: false,
        statusId: 'profile_not_found',
        sideEffects: { libraryProfileRead: true },
      },
      // Repository normalization preserves its stable empty-record shape.
      activeProfileRefresh: { id: null, processingState: null },
      profileRefreshCandidate: {
        libraryId: 7,
        profileState: 'missing_profile',
        observedItemCount: 12,
        observedItemHighWaterMark: 91,
      },
      profileRefreshCircuit: {
        valid: true,
        circuitState: 'open',
      },
    });

    const result = await service.getSummary({ dbClient: { query: jest.fn() }, policyId: 42 });

    expect(result.profileRecovery.stateId).toBe('awaiting_automatic_probe');
    expect(findProfileRefreshCandidate).toHaveBeenCalledTimes(1);
    expect(findProfileRefreshCircuit).toHaveBeenCalledTimes(1);
  });

  test('falls back to scheduled recovery when optional circuit status cannot be read', async () => {
    const { service } = createService({
      profileHandoff: {
        ok: false,
        statusId: 'profile_not_found',
        sideEffects: { libraryProfileRead: true },
      },
      profileRefreshCandidate: {
        libraryId: 7,
        profileState: 'missing_profile',
        observedItemCount: 12,
        observedItemHighWaterMark: 91,
      },
      profileRefreshCircuitError: new Error('database temporarily unavailable'),
    });

    const result = await service.getSummary({ dbClient: { query: jest.fn() }, policyId: 42 });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.AVAILABLE,
      profileRecovery: expect.objectContaining({ stateId: 'scheduled' }),
      sideEffects: expect.objectContaining({ profileRefreshCircuitRead: false }),
    }));
    expect(JSON.stringify(result)).not.toContain('database temporarily unavailable');
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
