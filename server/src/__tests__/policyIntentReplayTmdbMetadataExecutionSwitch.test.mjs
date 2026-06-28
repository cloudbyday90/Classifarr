/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyIntentReplayTmdbMetadataExecutionSwitch,
  POLICY_INTENT_REPLAY_TMDB_METADATA_LIVE_PREVIEW_ENV,
  sanitizePolicyIntentReplayTmdbMetadataExecutionSwitch,
} from '../services/policyIntentReplayTmdbMetadataExecutionSwitch.mjs';

const READY_PROVIDER_READINESS = {
  sources: [{
    source: 'tmdb_metadata',
    status: 'ready',
    configured: true,
    quota_safe: true,
    cooldown_active: false,
    selected_provider_key: 'tmdb',
  }],
};

describe('policyIntentReplayTmdbMetadataExecutionSwitch', () => {
  test('blocks by default even when TMDB readiness is safe', () => {
    const switchState = buildPolicyIntentReplayTmdbMetadataExecutionSwitch({
      requestBody: {},
      providerReadiness: READY_PROVIDER_READINESS,
      env: {},
    });

    expect(switchState).toEqual(expect.objectContaining({
      enabled: false,
      status: 'blocked',
      requested: false,
      server_enabled: false,
      provider_ready: true,
      quota_safe: true,
      cooldown_active: false,
      selected_provider_key: 'tmdb',
    }));
    expect(switchState.adapterContext.live_provider_calls_enabled).toBe(false);
    expect(switchState.adapterContext.enabled_sources).toEqual([]);
  });

  test('enables only with request opt-in, server opt-in, ready provider, safe quota, and clear cooldown', () => {
    const switchState = buildPolicyIntentReplayTmdbMetadataExecutionSwitch({
      requestBody: {
        replay_enrichment_preview: {
          enabled: true,
          sources: ['tmdb_metadata'],
        },
      },
      providerReadiness: READY_PROVIDER_READINESS,
      env: {
        [POLICY_INTENT_REPLAY_TMDB_METADATA_LIVE_PREVIEW_ENV]: 'true',
      },
    });

    expect(switchState).toEqual(expect.objectContaining({
      enabled: true,
      status: 'enabled',
      requested: true,
      server_enabled: true,
      provider_ready: true,
      quota_safe: true,
      cooldown_active: false,
    }));
    expect(switchState.adapterContext.live_provider_calls_enabled).toBe(true);
    expect(switchState.adapterContext.enabled_sources).toEqual(['tmdb_metadata']);
  });

  test('marks unsafe quota or cooldown as unavailable and keeps context blocked', () => {
    const switchState = buildPolicyIntentReplayTmdbMetadataExecutionSwitch({
      requestBody: { replay_enrichment_preview: { tmdb_metadata: true } },
      providerReadiness: {
        sources: [{
          source: 'tmdb_metadata',
          status: 'ready',
          configured: true,
          quota_safe: false,
          cooldown_active: true,
          selected_provider_key: 'tmdb',
        }],
      },
      env: {
        [POLICY_INTENT_REPLAY_TMDB_METADATA_LIVE_PREVIEW_ENV]: '1',
      },
    });

    expect(switchState).toEqual(expect.objectContaining({
      enabled: false,
      status: 'unavailable',
      requested: true,
      server_enabled: true,
      provider_ready: true,
      quota_safe: false,
      cooldown_active: true,
    }));
    expect(switchState.adapterContext.live_provider_calls_enabled).toBe(false);
    expect(switchState.adapterContext.enabled_sources).toEqual([]);
  });

  test('sanitizes switch state without leaking unexpected fields', () => {
    const sanitized = sanitizePolicyIntentReplayTmdbMetadataExecutionSwitch({
      status: 'enabled',
      enabled: true,
      requested: true,
      server_enabled: true,
      provider_ready: true,
      quota_safe: true,
      cooldown_active: false,
      selected_provider_key: 'tmdb',
      reason_codes: ['ok'],
      api_key: 'nope',
      raw_payload: { leaked: true },
    });

    expect(sanitized).toEqual({
      schema_version: 1,
      mode: 'replay_tmdb_metadata_execution_switch',
      source: 'tmdb_metadata',
      enabled: true,
      status: 'enabled',
      requested: true,
      server_enabled: true,
      provider_ready: true,
      quota_safe: true,
      cooldown_active: false,
      selected_provider_key: 'tmdb',
      reason_codes: ['ok'],
    });
    expect(JSON.stringify(sanitized)).not.toContain('nope');
    expect(JSON.stringify(sanitized)).not.toContain('raw_payload');
  });
});
