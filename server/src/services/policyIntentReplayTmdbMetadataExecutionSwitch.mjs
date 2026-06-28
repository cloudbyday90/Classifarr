/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  createPolicyIntentReplayEnrichmentAdapterContext,
} from './policyIntentReplayEnrichmentAdapterContract.mjs';
import {
  POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE,
} from './policyIntentReplayTmdbMetadataAdapter.mjs';

export const POLICY_INTENT_REPLAY_TMDB_METADATA_EXECUTION_SWITCH_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_TMDB_METADATA_EXECUTION_SWITCH_MODE = 'replay_tmdb_metadata_execution_switch';
export const POLICY_INTENT_REPLAY_TMDB_METADATA_LIVE_PREVIEW_ENV = 'POLICY_INTENT_REPLAY_TMDB_METADATA_LIVE_PREVIEW_ENABLED';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function boundedString(value, fallback = null, maxLength = 120) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function parseBooleanFlag(value) {
  return TRUE_VALUES.has(String(value ?? '').trim().toLowerCase());
}

function findTmdbReadiness(providerReadiness = {}) {
  return asArray(providerReadiness.sources)
    .find(source => source?.source === POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE) || null;
}

function requestOptedIntoTmdbMetadata(requestBody = {}) {
  const body = asObject(requestBody);
  const preview = asObject(body.replay_enrichment_preview);

  if (body.replay_tmdb_metadata_live_preview === true) {
    return true;
  }

  if (body.replay_enrichment_preview === true) {
    return false;
  }

  if (preview.tmdb_metadata === true) {
    return true;
  }

  if (asObject(preview.tmdb_metadata).enabled === true) {
    return true;
  }

  if (
    preview.enabled === true
    && asArray(preview.sources).includes(POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE)
  ) {
    return true;
  }

  return asArray(body.replay_enrichment_sources)
    .includes(POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE);
}

function buildReasonCodes({
  requested,
  serverEnabled,
  providerReady,
  quotaSafe,
  cooldownActive,
} = {}) {
  return [
    requested ? 'request:tmdb_metadata_opted_in' : 'request:tmdb_metadata_not_opted_in',
    serverEnabled ? 'server:tmdb_live_preview_enabled' : 'server:tmdb_live_preview_disabled',
    providerReady ? 'provider:tmdb_ready' : 'provider:tmdb_unavailable',
    quotaSafe ? 'quota:tmdb_safe' : 'quota:tmdb_unavailable',
    cooldownActive ? 'cooldown:tmdb_active' : 'cooldown:tmdb_clear',
  ];
}

function publicSwitchStatus({
  requested,
  serverEnabled,
  providerReady,
  quotaSafe,
  cooldownActive,
} = {}) {
  if (!requested || !serverEnabled) {
    return 'blocked';
  }

  if (!providerReady || !quotaSafe || cooldownActive) {
    return 'unavailable';
  }

  return 'enabled';
}

export function buildPolicyIntentReplayTmdbMetadataExecutionSwitch({
  requestBody = {},
  providerReadiness = null,
  env = process.env,
} = {}) {
  const sourceReadiness = findTmdbReadiness(providerReadiness);
  const requested = requestOptedIntoTmdbMetadata(requestBody);
  const serverEnabled = parseBooleanFlag(env?.[POLICY_INTENT_REPLAY_TMDB_METADATA_LIVE_PREVIEW_ENV]);
  const providerReady = sourceReadiness?.status === 'ready' && sourceReadiness?.configured === true;
  const quotaSafe = providerReady && sourceReadiness?.quota_safe === true;
  const cooldownActive = sourceReadiness?.cooldown_active === true;
  const status = publicSwitchStatus({
    requested,
    serverEnabled,
    providerReady,
    quotaSafe,
    cooldownActive,
  });
  const enabled = status === 'enabled';
  const reasonCodes = buildReasonCodes({
    requested,
    serverEnabled,
    providerReady,
    quotaSafe,
    cooldownActive,
  });
  const adapterContext = createPolicyIntentReplayEnrichmentAdapterContext({
    enabledSources: enabled ? [POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE] : [],
    liveProviderCallsEnabled: enabled,
  });

  return {
    schema_version: POLICY_INTENT_REPLAY_TMDB_METADATA_EXECUTION_SWITCH_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_TMDB_METADATA_EXECUTION_SWITCH_MODE,
    source: POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE,
    enabled,
    status,
    requested,
    server_enabled: serverEnabled,
    provider_ready: providerReady,
    quota_safe: quotaSafe,
    cooldown_active: cooldownActive,
    selected_provider_key: boundedString(sourceReadiness?.selected_provider_key, null, 40),
    reason_codes: reasonCodes,
    adapterContext,
  };
}

export function sanitizePolicyIntentReplayTmdbMetadataExecutionSwitch(switchState = {}) {
  const value = asObject(switchState);
  const status = ['enabled', 'blocked', 'unavailable'].includes(value.status)
    ? value.status
    : 'blocked';

  return {
    schema_version: POLICY_INTENT_REPLAY_TMDB_METADATA_EXECUTION_SWITCH_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_TMDB_METADATA_EXECUTION_SWITCH_MODE,
    source: POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE,
    enabled: value.enabled === true,
    status,
    requested: value.requested === true,
    server_enabled: value.server_enabled === true,
    provider_ready: value.provider_ready === true,
    quota_safe: value.quota_safe === true,
    cooldown_active: value.cooldown_active === true,
    selected_provider_key: boundedString(value.selected_provider_key, null, 40),
    reason_codes: asArray(value.reason_codes)
      .filter(reason => typeof reason === 'string' && reason.length > 0)
      .map(reason => reason.slice(0, 120))
      .slice(0, 8),
  };
}
