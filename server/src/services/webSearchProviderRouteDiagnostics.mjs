/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WEB_SEARCH_PROVIDER_ROUTE_STATUS } from './webSearchProviderQuotaPolicy.mjs';

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function serializeQuota(quota = {}) {
  return Object.freeze({
    dailyLimit: toNullableNumber(quota.dailyLimit),
    monthlyLimit: toNullableNumber(quota.monthlyLimit),
    dailyCostUnits: toNullableNumber(quota.dailyCostUnits) ?? 0,
    monthlyCostUnits: toNullableNumber(quota.monthlyCostUnits) ?? 0,
    dailyRemaining: toNullableNumber(quota.dailyRemaining),
    monthlyRemaining: toNullableNumber(quota.monthlyRemaining),
  });
}

function serializeUsage(usageSummary = {}) {
  return Object.freeze({
    dailyRequestCount: toNullableNumber(usageSummary.dailyRequestCount) ?? 0,
    monthlyRequestCount: toNullableNumber(usageSummary.monthlyRequestCount) ?? 0,
    dailyCacheHits: toNullableNumber(usageSummary.dailyCacheHits) ?? 0,
    monthlyCacheHits: toNullableNumber(usageSummary.monthlyCacheHits) ?? 0,
  });
}

function serializeQualityCalibration(qualityCalibration = {}) {
  return Object.freeze({
    score: toNullableNumber(qualityCalibration.score) ?? 100,
    priorityPenalty: toNullableNumber(qualityCalibration.priorityPenalty) ?? 0,
    sampleCount: toNullableNumber(qualityCalibration.sampleCount) ?? 0,
    status: qualityCalibration.status || 'insufficient_data',
    successRate: toNullableNumber(qualityCalibration.successRate),
    nonEmptyResultRate: toNullableNumber(qualityCalibration.nonEmptyResultRate),
    latencyScore: toNullableNumber(qualityCalibration.latencyScore),
    lookbackDays: toNullableNumber(qualityCalibration.lookbackDays),
    minimumSamples: toNullableNumber(qualityCalibration.minimumSamples),
  });
}

/**
 * Projects an internal route candidate into the minimum diagnostic model safe
 * for the authenticated settings UI. Configuration, credentials, query data,
 * cache identities, and provider error bodies never cross this boundary.
 */
export function serializeWebSearchProviderRouteCandidate(candidate = {}) {
  return Object.freeze({
    providerKey: candidate.providerKey || 'unknown',
    displayName: candidate.displayName || candidate.providerKey || 'Unknown provider',
    priority: toNullableNumber(candidate.priority) ?? 100,
    effectivePriority: toNullableNumber(candidate.effectivePriority) ?? toNullableNumber(candidate.priority) ?? 100,
    status: candidate.status || WEB_SEARCH_PROVIDER_ROUTE_STATUS.SKIPPED,
    skipReason: candidate.skipReason || null,
    isEnabled: Boolean(candidate.config?.isEnabled),
    configured: Boolean(candidate.config?.configured),
    adapterAvailable: Boolean(candidate.adapter),
    cooldownUntil: toNullableTimestamp(candidate.config?.cooldownUntil),
    quota: serializeQuota(candidate.quota),
    usage: serializeUsage(candidate.usageSummary),
    quality: serializeQualityCalibration(candidate.qualityCalibration),
  });
}

export function buildWebSearchProviderRouteDiagnostics(candidates = [], { now = new Date() } = {}) {
  const serializedCandidates = candidates.map(serializeWebSearchProviderRouteCandidate);
  const selected = serializedCandidates.find((candidate) => (
    candidate.status === WEB_SEARCH_PROVIDER_ROUTE_STATUS.AVAILABLE
  ));

  return Object.freeze({
    evaluatedAt: toNullableTimestamp(now) || new Date().toISOString(),
    selectedProviderKey: selected?.providerKey || null,
    candidates: serializedCandidates,
  });
}
