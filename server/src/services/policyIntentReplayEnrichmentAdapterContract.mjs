/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_MODE = 'replay_enrichment_adapter_contract';

export const POLICY_INTENT_REPLAY_ENRICHMENT_SOURCES = Object.freeze([
  'tmdb_metadata',
  'omdb_rating',
  'web_search_metadata',
]);

export const POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_STATUS = Object.freeze({
  BLOCKED: 'blocked',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
});

export class PolicyIntentReplayEnrichmentAdapterBlockedError extends Error {
  constructor(source, details = {}) {
    super(`Policy intent replay enrichment adapter is blocked: ${source}`);
    this.name = 'PolicyIntentReplayEnrichmentAdapterBlockedError';
    this.code = 'POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_BLOCKED';
    this.source = source;
    this.details = {
      reason: 'replay_enrichment_adapter_not_enabled',
      ...details,
    };
  }
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

function normalizeSource(source) {
  const normalized = boundedString(source, null, 80);
  return POLICY_INTENT_REPLAY_ENRICHMENT_SOURCES.includes(normalized)
    ? normalized
    : null;
}

function buildSourceDemand(enrichmentEligibility = {}) {
  const demand = new Map(POLICY_INTENT_REPLAY_ENRICHMENT_SOURCES.map(source => [source, 0]));

  for (const item of asArray(enrichmentEligibility.items)) {
    for (const source of asArray(item?.eligible_sources)) {
      const normalizedSource = normalizeSource(source);
      if (normalizedSource) {
        demand.set(normalizedSource, demand.get(normalizedSource) + 1);
      }
    }
  }

  return demand;
}

function readinessBySource(providerReadiness = {}) {
  return asArray(providerReadiness.sources).reduce((lookup, sourceReadiness) => {
    const source = normalizeSource(sourceReadiness?.source);
    if (!source) return lookup;
    lookup.set(source, {
      status: sourceReadiness.status === 'ready' ? 'ready' : 'unavailable',
      configured: sourceReadiness.configured === true,
      quota_safe: sourceReadiness.quota_safe === true,
      cooldown_active: sourceReadiness.cooldown_active === true,
      selected_provider_key: boundedString(sourceReadiness.selected_provider_key, null, 40),
      available_provider_count: Number.isFinite(Number(sourceReadiness.available_provider_count))
        ? Math.max(0, Number.parseInt(sourceReadiness.available_provider_count, 10))
        : 0,
    });
    return lookup;
  }, new Map());
}

export function createPolicyIntentReplayEnrichmentAdapterContext({
  enabledSources = [],
  liveProviderCallsEnabled = false,
  aiCallsEnabled = false,
  persistenceEnabled = false,
  arrWritesEnabled = false,
} = {}) {
  const enabledSourceSet = new Set(
    asArray(enabledSources)
      .map(normalizeSource)
      .filter(Boolean)
  );

  const context = {
    schema_version: POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_MODE,
    live_provider_calls_enabled: liveProviderCallsEnabled === true,
    ai_calls_enabled: aiCallsEnabled === true,
    persistence_enabled: persistenceEnabled === true,
    arr_writes_enabled: arrWritesEnabled === true,
    enabled_sources: Object.freeze([...enabledSourceSet]),
    assertSourceAllowed(source, details = {}) {
      const normalizedSource = normalizeSource(source);
      if (!normalizedSource || !enabledSourceSet.has(normalizedSource)) {
        throw new PolicyIntentReplayEnrichmentAdapterBlockedError(
          normalizedSource || 'unknown_source',
          details
        );
      }

      if (!context.live_provider_calls_enabled) {
        throw new PolicyIntentReplayEnrichmentAdapterBlockedError(normalizedSource, {
          reason: 'live_provider_calls_disabled',
          ...details,
        });
      }

      return true;
    },
  };

  return Object.freeze(context);
}

function buildAdapterSource(source, {
  context,
  demand,
  readiness,
} = {}) {
  const eligibleSampleCount = demand.get(source) || 0;
  const providerState = readiness.get(source) || {
    status: 'unavailable',
    configured: false,
    quota_safe: false,
    cooldown_active: false,
    selected_provider_key: null,
    available_provider_count: 0,
  };
  const sourceEnabled = context.enabled_sources.includes(source);
  const providerReady = providerState.status === 'ready';
  const status = sourceEnabled && context.live_provider_calls_enabled
    ? (providerReady ? POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_STATUS.READY : POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_STATUS.UNAVAILABLE)
    : POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_STATUS.BLOCKED;

  const reasonCodes = [
    `source:${source}`,
    sourceEnabled ? 'adapter:source_enabled' : 'adapter:source_not_enabled',
    context.live_provider_calls_enabled ? 'execution:live_provider_calls_enabled' : 'execution:live_provider_calls_disabled',
    providerReady ? 'provider:ready' : 'provider:unavailable',
  ];
  if (eligibleSampleCount > 0) reasonCodes.push('demand:eligible_samples');
  if (providerState.cooldown_active) reasonCodes.push('provider:cooldown_active');
  if (!providerState.quota_safe) reasonCodes.push('provider:quota_unavailable');

  return {
    source,
    status,
    enabled: sourceEnabled,
    provider_ready: providerReady,
    configured: providerState.configured,
    quota_safe: providerState.quota_safe,
    cooldown_active: providerState.cooldown_active,
    eligible_sample_count: eligibleSampleCount,
    selected_provider_key: providerState.selected_provider_key,
    available_provider_count: providerState.available_provider_count,
    reason_codes: reasonCodes.slice(0, 10),
  };
}

export function buildPolicyIntentReplayEnrichmentAdapterContract({
  enrichmentEligibility = null,
  providerReadiness = null,
  context = createPolicyIntentReplayEnrichmentAdapterContext(),
} = {}) {
  const normalizedContext = context || createPolicyIntentReplayEnrichmentAdapterContext();
  const demand = buildSourceDemand(enrichmentEligibility);
  const readiness = readinessBySource(providerReadiness);
  const sources = POLICY_INTENT_REPLAY_ENRICHMENT_SOURCES.map(source => buildAdapterSource(source, {
    context: normalizedContext,
    demand,
    readiness,
  }));
  const enabledAdapterCount = sources.filter(source => source.enabled).length;
  const readyAdapterCount = sources.filter(source => source.status === POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_STATUS.READY).length;
  const demandedAdapterCount = sources.filter(source => source.eligible_sample_count > 0).length;
  const demandedReadyCount = sources.filter(source => (
    source.eligible_sample_count > 0
    && source.status === POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_STATUS.READY
  )).length;

  return {
    schema_version: POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_MODE,
    enabled: true,
    live_provider_calls_enabled: normalizedContext.live_provider_calls_enabled,
    ai_calls_enabled: normalizedContext.ai_calls_enabled,
    persistence_enabled: normalizedContext.persistence_enabled,
    arr_writes_enabled: normalizedContext.arr_writes_enabled,
    adapter_count: sources.length,
    enabled_adapter_count: enabledAdapterCount,
    ready_adapter_count: readyAdapterCount,
    blocked_adapter_count: sources.filter(source => source.status === POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_STATUS.BLOCKED).length,
    unavailable_adapter_count: sources.filter(source => source.status === POLICY_INTENT_REPLAY_ENRICHMENT_ADAPTER_STATUS.UNAVAILABLE).length,
    demanded_adapter_count: demandedAdapterCount,
    readiness: demandedAdapterCount === 0
      ? 'not_needed'
      : (demandedReadyCount === demandedAdapterCount ? 'ready' : (demandedReadyCount > 0 ? 'partial' : 'blocked')),
    sources,
  };
}
