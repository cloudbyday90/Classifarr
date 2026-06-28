/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyIntentReplayEnrichmentAdapterContract,
  createPolicyIntentReplayEnrichmentAdapterContext,
  POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_MODE,
  PolicyIntentReplayEnrichmentAdapterBlockedError,
} from '../services/policyIntentReplayEnrichmentAdapterContract.mjs';

describe('policyIntentReplayEnrichmentAdapterContract', () => {
  test('builds a blocked-by-default adapter contract from eligibility and provider readiness', () => {
    const contract = buildPolicyIntentReplayEnrichmentAdapterContract({
      enrichmentEligibility: {
        items: [
          { eligible_sources: ['tmdb_metadata', 'web_search_metadata'] },
          { eligible_sources: ['web_search_metadata'] },
        ],
      },
      providerReadiness: {
        sources: [
          {
            source: 'tmdb_metadata',
            status: 'ready',
            configured: true,
            quota_safe: true,
            cooldown_active: false,
            selected_provider_key: 'tmdb',
            available_provider_count: 1,
          },
          {
            source: 'web_search_metadata',
            status: 'ready',
            configured: true,
            quota_safe: true,
            cooldown_active: false,
            selected_provider_key: 'tavily',
            available_provider_count: 1,
            api_key: 'should-not-leak',
          },
        ],
      },
    });

    expect(contract).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_MODE,
      enabled: true,
      live_provider_calls_enabled: false,
      ai_calls_enabled: false,
      persistence_enabled: false,
      arr_writes_enabled: false,
      adapter_count: 3,
      enabled_adapter_count: 0,
      ready_adapter_count: 0,
      blocked_adapter_count: 3,
      demanded_adapter_count: 2,
      readiness: 'blocked',
    }));
    expect(contract.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'tmdb_metadata',
        status: 'blocked',
        provider_ready: true,
        eligible_sample_count: 1,
        selected_provider_key: 'tmdb',
        reason_codes: expect.arrayContaining([
          'adapter:source_not_enabled',
          'execution:live_provider_calls_disabled',
          'provider:ready',
        ]),
      }),
      expect.objectContaining({
        source: 'web_search_metadata',
        status: 'blocked',
        provider_ready: true,
        eligible_sample_count: 2,
        selected_provider_key: 'tavily',
      }),
    ]));
    expect(JSON.stringify(contract)).not.toContain('should-not-leak');
  });

  test('requires both source enablement and live provider capability before allowing an adapter', () => {
    const blockedContext = createPolicyIntentReplayEnrichmentAdapterContext({
      enabledSources: ['tmdb_metadata'],
    });

    expect(() => blockedContext.assertSourceAllowed('tmdb_metadata'))
      .toThrow(PolicyIntentReplayEnrichmentAdapterBlockedError);
    expect(() => blockedContext.assertSourceAllowed('unknown_source'))
      .toThrow(PolicyIntentReplayEnrichmentAdapterBlockedError);

    const enabledContext = createPolicyIntentReplayEnrichmentAdapterContext({
      enabledSources: ['tmdb_metadata'],
      liveProviderCallsEnabled: true,
    });

    expect(enabledContext.assertSourceAllowed('tmdb_metadata')).toBe(true);
    expect(() => enabledContext.assertSourceAllowed('web_search_metadata'))
      .toThrow(PolicyIntentReplayEnrichmentAdapterBlockedError);
  });
});
