/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildAdjacentCompletedUtcDayMetricsWindows } from './completedUtcDayMetricsWindow.mjs';
import { ROUTE_SAFETY_PRIMARY_GATE_IDS } from './routeSafetyReadiness.mjs';

export const ROUTE_SAFETY_MAINTENANCE_HANDOFF_VERSION = 'classification.route_safety_maintenance_handoff.v1';
export const ROUTE_SAFETY_MAINTENANCE_HANDOFF_WINDOW_DAYS = 7;
export const ROUTE_SAFETY_MAINTENANCE_HANDOFF_MIN_WINDOW_OBSERVATIONS = 6;
export const ROUTE_SAFETY_MAINTENANCE_HANDOFF_MIN_GATE_OBSERVATIONS = 4;
export const ROUTE_SAFETY_MAINTENANCE_HANDOFF_MIN_DOMINANT_SHARE = 0.6;

/**
 * A stable pattern should lead only to the normal policy-review surface. AI
 * availability, provider recovery, fallback, and clarification gates are
 * intentionally excluded because they have different operators and remedies.
 */
export const ROUTE_SAFETY_MAINTENANCE_HANDOFF_GATE_IDS = Object.freeze([
  'policy_confirmation_required',
  'policy_destination_selection_required',
  'manual_policy_evidence_review_required',
  'policy_score_below_automatic_threshold',
  'policy_threshold_unavailable',
  'policy_auto_provenance_required',
  'low_confidence_review_required',
]);

const PRIMARY_GATE_IDS = new Set(ROUTE_SAFETY_PRIMARY_GATE_IDS);
const HANDOFF_GATE_IDS = new Set(ROUTE_SAFETY_MAINTENANCE_HANDOFF_GATE_IDS);
const HANDOFF_GATE_ORDER = new Map(
  ROUTE_SAFETY_MAINTENANCE_HANDOFF_GATE_IDS.map((gateId, index) => [gateId, index]),
);
const NON_NEGATIVE_INTEGER_PATTERN = /^\d+$/;

function nonnegativeCount(value) {
  const normalized = String(value ?? '').trim();
  if (!NON_NEGATIVE_INTEGER_PATTERN.test(normalized)) return 0;

  const numericValue = Number(normalized);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function dateOnly(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : null;
}

function buildCountsByWindow(rows) {
  const countsByWindow = new Map([
    ['current', new Map()],
    ['previous', new Map()],
  ]);

  for (const row of Array.isArray(rows) ? rows : []) {
    const windowId = row?.window_id ?? row?.windowId;
    const gateId = row?.primary_gate_id ?? row?.primaryGateId;
    const count = nonnegativeCount(row?.observation_count ?? row?.observationCount);
    const counts = countsByWindow.get(windowId);

    if (!counts || !PRIMARY_GATE_IDS.has(gateId) || count === 0) continue;
    counts.set(gateId, Math.min(Number.MAX_SAFE_INTEGER, (counts.get(gateId) || 0) + count));
  }

  return countsByWindow;
}

function totalObservations(counts) {
  return [...counts.values()].reduce(
    (sum, count) => Math.min(Number.MAX_SAFE_INTEGER, sum + count),
    0,
  );
}

function dominantGateId(counts) {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] ||
      (HANDOFF_GATE_ORDER.get(left[0]) ?? Number.MAX_SAFE_INTEGER) -
      (HANDOFF_GATE_ORDER.get(right[0]) ?? Number.MAX_SAFE_INTEGER) ||
      left[0].localeCompare(right[0]))
    .at(0)?.[0] || null;
}

function isRepresentativeDominantGate({ gateId, counts, total }) {
  const count = counts.get(gateId) || 0;
  return total >= ROUTE_SAFETY_MAINTENANCE_HANDOFF_MIN_WINDOW_OBSERVATIONS &&
    count >= ROUTE_SAFETY_MAINTENANCE_HANDOFF_MIN_GATE_OBSERVATIONS &&
    count / total >= ROUTE_SAFETY_MAINTENANCE_HANDOFF_MIN_DOMINANT_SHARE;
}

function buildWindowSummary(window) {
  return Object.freeze({
    days: window?.days === ROUTE_SAFETY_MAINTENANCE_HANDOFF_WINDOW_DAYS
      ? window.days
      : ROUTE_SAFETY_MAINTENANCE_HANDOFF_WINDOW_DAYS,
    startDate: dateOnly(window?.start),
    endDate: dateOnly(window?.end),
  });
}

function buildNotRecommendedReport(windows) {
  return Object.freeze({
    version: ROUTE_SAFETY_MAINTENANCE_HANDOFF_VERSION,
    status: Object.freeze({ id: 'not_recommended' }),
    windows: Object.freeze({
      current: buildWindowSummary(windows?.current),
      previous: buildWindowSummary(windows?.previous),
    }),
    handoff: null,
  });
}

/**
 * Converts two fixed, aggregate-only windows into a deliberately conservative
 * policy-maintenance handoff. It cannot identify media, libraries, policies,
 * providers, operators, or the content of an individual decision.
 */
export function buildRouteSafetyMaintenanceHandoffReport({ rows = [], windows = null } = {}) {
  const countsByWindow = buildCountsByWindow(rows);
  const currentCounts = countsByWindow.get('current');
  const previousCounts = countsByWindow.get('previous');
  const currentTotal = totalObservations(currentCounts);
  const previousTotal = totalObservations(previousCounts);
  const currentGateId = dominantGateId(currentCounts);
  const previousGateId = dominantGateId(previousCounts);

  if (!currentGateId || currentGateId !== previousGateId || !HANDOFF_GATE_IDS.has(currentGateId) ||
      !isRepresentativeDominantGate({ gateId: currentGateId, counts: currentCounts, total: currentTotal }) ||
      !isRepresentativeDominantGate({ gateId: previousGateId, counts: previousCounts, total: previousTotal })) {
    return buildNotRecommendedReport(windows);
  }

  return Object.freeze({
    version: ROUTE_SAFETY_MAINTENANCE_HANDOFF_VERSION,
    status: Object.freeze({ id: 'review_recommended' }),
    windows: Object.freeze({
      current: buildWindowSummary(windows?.current),
      previous: buildWindowSummary(windows?.previous),
    }),
    handoff: Object.freeze({
      gateId: currentGateId,
      currentCount: currentCounts.get(currentGateId) || 0,
      previousCount: previousCounts.get(previousGateId) || 0,
      currentObservationCount: currentTotal,
      previousObservationCount: previousTotal,
    }),
  });
}

/**
 * Two adjacent completed UTC-day windows avoid partial-day churn and prevent
 * an overlapping sample from masquerading as a repeated operating pattern.
 */
export function buildRouteSafetyMaintenanceHandoffWindows({ now = new Date() } = {}) {
  return buildAdjacentCompletedUtcDayMetricsWindows({
    windowDays: ROUTE_SAFETY_MAINTENANCE_HANDOFF_WINDOW_DAYS,
    now,
  });
}
