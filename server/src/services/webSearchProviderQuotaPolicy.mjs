/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const WEB_SEARCH_PROVIDER_ROUTE_STATUS = Object.freeze({
  AVAILABLE: 'available',
  SKIPPED: 'skipped',
});

export const WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS = Object.freeze({
  DISABLED: 'disabled',
  UNCONFIGURED: 'unconfigured',
  ADAPTER_UNAVAILABLE: 'adapter_unavailable',
  COOLDOWN_ACTIVE: 'cooldown_active',
  DAILY_QUOTA_EXHAUSTED: 'daily_quota_exhausted',
  MONTHLY_QUOTA_EXHAUSTED: 'monthly_quota_exhausted',
});

const DEFAULT_SUMMARY = Object.freeze({
  dailyCostUnits: 0,
  monthlyCostUnits: 0,
  dailyRequestCount: 0,
  monthlyRequestCount: 0,
  dailyCacheHits: 0,
  monthlyCacheHits: 0,
});

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export function isWebSearchProviderCooldownActive(config = {}, now = new Date()) {
  const cooldownTimestamp = toTimestamp(config.cooldownUntil);
  if (cooldownTimestamp == null) return false;
  return cooldownTimestamp > now.getTime();
}

export function getWebSearchProviderQuotaState(config = {}, usageSummary = DEFAULT_SUMMARY) {
  const dailyLimit = config.softDailyLimit == null ? null : toInteger(config.softDailyLimit, null);
  const monthlyLimit = config.softMonthlyLimit == null ? null : toInteger(config.softMonthlyLimit, null);
  const dailyCostUnits = toInteger(usageSummary.dailyCostUnits);
  const monthlyCostUnits = toInteger(usageSummary.monthlyCostUnits);

  return Object.freeze({
    dailyLimit,
    monthlyLimit,
    dailyCostUnits,
    monthlyCostUnits,
    dailyRemaining: dailyLimit == null ? null : Math.max(0, dailyLimit - dailyCostUnits),
    monthlyRemaining: monthlyLimit == null ? null : Math.max(0, monthlyLimit - monthlyCostUnits),
    dailyExhausted: dailyLimit != null && dailyCostUnits >= dailyLimit,
    monthlyExhausted: monthlyLimit != null && monthlyCostUnits >= monthlyLimit,
  });
}

export function evaluateWebSearchProviderRouteCandidate({
  config,
  adapter = null,
  usageSummary = DEFAULT_SUMMARY,
  now = new Date(),
} = {}) {
  const quota = getWebSearchProviderQuotaState(config, usageSummary);
  const baseCandidate = {
    providerKey: config?.providerKey || 'unknown',
    displayName: config?.displayName || config?.providerKey || 'Unknown provider',
    priority: toInteger(config?.priority, 100),
    config,
    adapter,
    usageSummary: {
      ...DEFAULT_SUMMARY,
      ...usageSummary,
    },
    quota,
  };

  if (!config?.isEnabled) {
    return Object.freeze({
      ...baseCandidate,
      status: WEB_SEARCH_PROVIDER_ROUTE_STATUS.SKIPPED,
      skipReason: WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.DISABLED,
    });
  }

  if (!config?.configured) {
    return Object.freeze({
      ...baseCandidate,
      status: WEB_SEARCH_PROVIDER_ROUTE_STATUS.SKIPPED,
      skipReason: WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.UNCONFIGURED,
    });
  }

  if (!adapter) {
    return Object.freeze({
      ...baseCandidate,
      status: WEB_SEARCH_PROVIDER_ROUTE_STATUS.SKIPPED,
      skipReason: WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.ADAPTER_UNAVAILABLE,
    });
  }

  if (isWebSearchProviderCooldownActive(config, now)) {
    return Object.freeze({
      ...baseCandidate,
      status: WEB_SEARCH_PROVIDER_ROUTE_STATUS.SKIPPED,
      skipReason: WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.COOLDOWN_ACTIVE,
    });
  }

  if (quota.dailyExhausted) {
    return Object.freeze({
      ...baseCandidate,
      status: WEB_SEARCH_PROVIDER_ROUTE_STATUS.SKIPPED,
      skipReason: WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.DAILY_QUOTA_EXHAUSTED,
    });
  }

  if (quota.monthlyExhausted) {
    return Object.freeze({
      ...baseCandidate,
      status: WEB_SEARCH_PROVIDER_ROUTE_STATUS.SKIPPED,
      skipReason: WEB_SEARCH_PROVIDER_ROUTE_SKIP_REASONS.MONTHLY_QUOTA_EXHAUSTED,
    });
  }

  return Object.freeze({
    ...baseCandidate,
    status: WEB_SEARCH_PROVIDER_ROUTE_STATUS.AVAILABLE,
    skipReason: null,
  });
}

export function sortWebSearchProviderRouteCandidates(candidates = []) {
  return [...candidates].sort((left, right) => (
    left.priority - right.priority
    || left.providerKey.localeCompare(right.providerKey)
  ));
}
