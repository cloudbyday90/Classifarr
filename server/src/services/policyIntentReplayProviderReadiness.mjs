/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import { WebSearchProviderRouter } from './webSearchProviderRouter.mjs';
import { webSearchProviderStorage } from './webSearchProviderStorage.mjs';
import { WEB_SEARCH_PROVIDER_ROUTE_STATUS } from './webSearchProviderQuotaPolicy.mjs';
import { WEB_SEARCH_PURPOSES } from './webSearchProviderContract.mjs';

export const POLICY_INTENT_REPLAY_PROVIDER_READINESS_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_PROVIDER_READINESS_MODE = 'representative_replay_provider_readiness';

const SOURCE_CATEGORIES = Object.freeze([
  'tmdb_metadata',
  'omdb_rating',
  'web_search_metadata',
]);
const WEB_SEARCH_PURPOSE = WEB_SEARCH_PURPOSES.includes('metadata_enrichment')
  ? 'metadata_enrichment'
  : 'classification';

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

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sourceDemandFromEligibility(enrichmentEligibility = {}) {
  const demand = new Map(SOURCE_CATEGORIES.map(source => [source, 0]));

  for (const item of asArray(enrichmentEligibility.items)) {
    for (const source of asArray(item?.eligible_sources)) {
      if (demand.has(source)) {
        demand.set(source, demand.get(source) + 1);
      }
    }
  }

  return demand;
}

function buildUnavailableSource(source, reasonCode = 'readiness:not_checked', eligibleSampleCount = 0) {
  return {
    source,
    status: 'unavailable',
    configured: false,
    quota_safe: false,
    cooldown_active: false,
    eligible_sample_count: eligibleSampleCount,
    selected_provider_key: null,
    available_provider_count: 0,
    reason_codes: [reasonCode],
  };
}

function buildTmdbSource(row = {}, eligibleSampleCount = 0) {
  const configured = row.is_active === true && Boolean(boundedString(row.api_key, null, 1));

  return {
    source: 'tmdb_metadata',
    status: configured ? 'ready' : 'unavailable',
    configured,
    quota_safe: configured,
    cooldown_active: false,
    eligible_sample_count: eligibleSampleCount,
    selected_provider_key: configured ? 'tmdb' : null,
    available_provider_count: configured ? 1 : 0,
    reason_codes: configured
      ? ['source:tmdb_metadata', 'provider:tmdb_configured']
      : ['source:tmdb_metadata', 'provider:tmdb_unconfigured'],
  };
}

function buildOmdbSource(row = {}, eligibleSampleCount = 0, now = new Date()) {
  const configured = row.is_active === true && Boolean(boundedString(row.api_key, null, 1));
  const dailyLimit = toInteger(row.daily_limit, 0);
  const lastResetDate = row.last_reset_date ? new Date(row.last_reset_date) : null;
  const sameDay = lastResetDate
    ? lastResetDate.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
    : false;
  const requestsToday = sameDay ? toInteger(row.requests_today, 0) : 0;
  const quotaSafe = configured && (dailyLimit <= 0 || requestsToday < dailyLimit);

  return {
    source: 'omdb_rating',
    status: quotaSafe ? 'ready' : 'unavailable',
    configured,
    quota_safe: quotaSafe,
    cooldown_active: false,
    eligible_sample_count: eligibleSampleCount,
    selected_provider_key: configured ? 'omdb' : null,
    available_provider_count: quotaSafe ? 1 : 0,
    reason_codes: [
      'source:omdb_rating',
      configured ? 'provider:omdb_configured' : 'provider:omdb_unconfigured',
      quotaSafe ? 'quota:omdb_safe' : 'quota:omdb_unavailable',
    ],
  };
}

function buildWebSearchSource(candidates = [], eligibleSampleCount = 0) {
  const available = candidates.filter(candidate => (
    candidate.status === WEB_SEARCH_PROVIDER_ROUTE_STATUS.AVAILABLE
  ));
  const selected = available[0] || null;
  const hasConfiguredProvider = candidates.some(candidate => candidate?.config?.configured);
  const cooldownActive = candidates.some(candidate => candidate?.skipReason === 'cooldown_active');
  const quotaExhausted = candidates.some(candidate => (
    candidate?.skipReason === 'daily_quota_exhausted'
    || candidate?.skipReason === 'monthly_quota_exhausted'
  ));

  const reasonCodes = [
    'source:web_search_metadata',
    selected ? 'route:web_search_available' : 'route:web_search_unavailable',
  ];
  if (!hasConfiguredProvider) reasonCodes.push('provider:web_search_unconfigured');
  if (cooldownActive) reasonCodes.push('cooldown:web_search_active');
  if (quotaExhausted) reasonCodes.push('quota:web_search_exhausted');

  return {
    source: 'web_search_metadata',
    status: selected ? 'ready' : 'unavailable',
    configured: hasConfiguredProvider,
    quota_safe: Boolean(selected),
    cooldown_active: cooldownActive,
    eligible_sample_count: eligibleSampleCount,
    selected_provider_key: boundedString(selected?.providerKey, null, 40),
    available_provider_count: available.length,
    reason_codes: reasonCodes.slice(0, 8),
  };
}

async function getTmdbConfig(db) {
  const result = await db.query(`
    SELECT api_key, is_active
    FROM tmdb_config
    ORDER BY id DESC
    LIMIT 1
  `);
  return result.rows?.[0] || null;
}

async function getOmdbConfig(db) {
  const result = await db.query(`
    SELECT api_key, is_active, daily_limit, requests_today, last_reset_date
    FROM omdb_config
    ORDER BY id DESC
    LIMIT 1
  `);
  return result.rows?.[0] || null;
}

function buildSummary(sources = []) {
  const readyCount = sources.filter(source => source.status === 'ready').length;
  const demandedCount = sources.filter(source => source.eligible_sample_count > 0).length;
  const demandedReadyCount = sources.filter(source => (
    source.eligible_sample_count > 0 && source.status === 'ready'
  )).length;

  return {
    ready_source_count: readyCount,
    unavailable_source_count: sources.length - readyCount,
    demanded_source_count: demandedCount,
    readiness: demandedCount === 0
      ? 'not_needed'
      : (demandedReadyCount === demandedCount ? 'ready' : (demandedReadyCount > 0 ? 'partial' : 'unavailable')),
  };
}

export async function buildPolicyIntentReplayProviderReadiness({
  db = defaultDb,
  enrichmentEligibility = null,
  router = null,
  now = new Date(),
} = {}) {
  const demand = sourceDemandFromEligibility(enrichmentEligibility);
  const tmdbConfig = await getTmdbConfig(db);
  const omdbConfig = await getOmdbConfig(db);
  const providerRouter = router || new WebSearchProviderRouter({
    storage: webSearchProviderStorage.withDb(db),
    nowFn: () => now,
  });
  const candidates = await providerRouter.getRouteCandidates({
    purpose: WEB_SEARCH_PURPOSE,
  });

  const sources = [
    tmdbConfig
      ? buildTmdbSource(tmdbConfig, demand.get('tmdb_metadata') || 0)
      : buildUnavailableSource('tmdb_metadata', 'provider:tmdb_unconfigured', demand.get('tmdb_metadata') || 0),
    omdbConfig
      ? buildOmdbSource(omdbConfig, demand.get('omdb_rating') || 0, now)
      : buildUnavailableSource('omdb_rating', 'provider:omdb_unconfigured', demand.get('omdb_rating') || 0),
    buildWebSearchSource(candidates, demand.get('web_search_metadata') || 0),
  ];

  return {
    schema_version: POLICY_INTENT_REPLAY_PROVIDER_READINESS_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_PROVIDER_READINESS_MODE,
    enabled: true,
    live_provider_calls_enabled: false,
    ai_calls_enabled: false,
    persistence_enabled: false,
    arr_writes_enabled: false,
    source_count: sources.length,
    ...buildSummary(sources),
    sources,
  };
}
