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
  WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLD_DEFAULTS,
  normalizeWebSearchProviderGuardrailThresholds,
} from './webSearchProviderGuardrailThresholds.mjs';

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function findPreviewSelectedCandidate(preview = {}) {
  const selectedProviderKey = preview.selectedProviderKeyAfter;
  if (!selectedProviderKey) return null;
  return preview.preview?.candidates?.find((candidate) => candidate.providerKey === selectedProviderKey) || null;
}

function findCurrentSelectedCandidate(preview = {}) {
  const selectedProviderKey = preview.selectedProviderKeyBefore;
  if (!selectedProviderKey) return null;
  return preview.current?.candidates?.find((candidate) => candidate.providerKey === selectedProviderKey) || null;
}

function createGuardrail({
  code,
  severity,
  providerKey = null,
  displayName = null,
  message,
  details = {},
}) {
  return Object.freeze({
    code,
    severity,
    providerKey,
    displayName,
    message,
    details: Object.freeze(details),
  });
}

function isDisabledSeverity(severity) {
  return severity === 'disabled';
}

function buildNoProviderGuardrail(preview = {}, thresholds = WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLD_DEFAULTS) {
  if (preview.selectedProviderKeyAfter) return null;
  if (isDisabledSeverity(thresholds.noProviderSeverity)) return null;
  return createGuardrail({
    code: 'no_preview_provider',
    severity: thresholds.noProviderSeverity,
    message: 'No provider would be eligible after this calibration change.',
    details: {
      candidateCount: toNumber(preview.candidateCount, 0),
    },
  });
}

function buildSelectionChangedGuardrail(preview = {}, thresholds = WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLD_DEFAULTS) {
  if (!preview.selectedProviderChanged) return null;
  if (isDisabledSeverity(thresholds.selectionChangeSeverity)) return null;
  const current = findCurrentSelectedCandidate(preview);
  const selected = findPreviewSelectedCandidate(preview);
  return createGuardrail({
    code: 'selected_provider_changed',
    severity: thresholds.selectionChangeSeverity,
    providerKey: selected?.providerKey || preview.selectedProviderKeyAfter || null,
    displayName: selected?.displayName || preview.selectedProviderKeyAfter || null,
    message: 'This calibration change would select a different provider.',
    details: {
      beforeProviderKey: preview.selectedProviderKeyBefore,
      afterProviderKey: preview.selectedProviderKeyAfter,
      beforeDisplayName: current?.displayName || preview.selectedProviderKeyBefore || null,
      afterDisplayName: selected?.displayName || preview.selectedProviderKeyAfter || null,
    },
  });
}

function buildLowSampleGuardrail(preview = {}, thresholds = WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLD_DEFAULTS) {
  const selected = findPreviewSelectedCandidate(preview);
  if (!selected) return null;
  if (isDisabledSeverity(thresholds.lowSampleSeverity)) return null;
  const sampleCount = toNumber(selected.quality?.sampleCount, 0);
  const minimumSamples = toNumber(selected.quality?.minimumSamples, 0);
  const thresholdSampleCount = Math.ceil(minimumSamples * thresholds.lowSampleMultiplier);
  const insufficient = selected.quality?.status === 'insufficient_data'
    || (thresholdSampleCount > 0 && sampleCount < thresholdSampleCount);
  if (!insufficient) return null;

  return createGuardrail({
    code: 'selected_provider_low_samples',
    severity: thresholds.lowSampleSeverity,
    providerKey: selected.providerKey,
    displayName: selected.displayName,
    message: 'The preview-selected provider has too few samples for strong calibration confidence.',
    details: {
      sampleCount,
      minimumSamples,
      thresholdSampleCount,
      lowSampleMultiplier: thresholds.lowSampleMultiplier,
      qualityStatus: selected.quality?.status || 'unknown',
    },
  });
}

function isHealthIssue(event = {}) {
  return event.eventType === 'cooldown_started'
    || event.healthStatus === 'cooldown'
    || event.healthStatus === 'degraded'
    || Boolean(event.errorCode);
}

function buildRecentHealthGuardrail(
  preview = {},
  recentHealthEvents = [],
  thresholds = WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLD_DEFAULTS
) {
  const selected = findPreviewSelectedCandidate(preview);
  if (!selected) return null;
  if (thresholds.recentHealthLookbackCount <= 0) return null;
  const selectedIssues = recentHealthEvents
    .filter((event) => event.providerKey === selected.providerKey)
    .filter(isHealthIssue)
    .slice(0, thresholds.recentHealthLookbackCount);
  if (selectedIssues.length === 0) return null;

  const latestIssue = selectedIssues[0];
  const severity = latestIssue.healthStatus === 'cooldown'
    ? thresholds.cooldownSeverity
    : thresholds.healthIssueSeverity;
  if (isDisabledSeverity(severity)) return null;

  return createGuardrail({
    code: 'selected_provider_recent_health_issue',
    severity,
    providerKey: selected.providerKey,
    displayName: selected.displayName,
    message: 'The preview-selected provider has recent health or cooldown signals.',
    details: {
      recentIssueCount: selectedIssues.length,
      latestEventType: latestIssue.eventType || null,
      latestHealthStatus: latestIssue.healthStatus || null,
      latestErrorCode: latestIssue.errorCode || null,
      latestCooldownUntil: toIsoTimestamp(latestIssue.cooldownUntil),
      latestCreatedAt: toIsoTimestamp(latestIssue.createdAt),
    },
  });
}

export function buildWebSearchProviderCalibrationGuardrails(preview = {}, {
  recentHealthEvents = [],
  thresholds = WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLD_DEFAULTS,
} = {}) {
  const normalizedThresholds = normalizeWebSearchProviderGuardrailThresholds(thresholds);
  if (!normalizedThresholds.enabled) return [];

  return [
    buildNoProviderGuardrail(preview, normalizedThresholds),
    buildSelectionChangedGuardrail(preview, normalizedThresholds),
    buildLowSampleGuardrail(preview, normalizedThresholds),
    buildRecentHealthGuardrail(preview, recentHealthEvents, normalizedThresholds),
  ].filter(Boolean);
}
