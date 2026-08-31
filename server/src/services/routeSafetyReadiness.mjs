/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CLASSIFICATION_ROUTE_SAFETY_GATE_IDS,
  CLASSIFICATION_ROUTE_SAFETY_VERSION,
} from './classificationRouteSafetyGate.mjs';
import { buildCompletedUtcDayMetricsWindow } from './completedUtcDayMetricsWindow.mjs';

export const ROUTE_SAFETY_READINESS_VERSION = 'classification.route_safety_readiness.v1';
export const ROUTE_SAFETY_READINESS_WINDOW_DAYS = 7;
export const ROUTE_SAFETY_READINESS_MAX_PRIMARY_GATES = 3;

/**
 * This is deliberately a fixed public vocabulary. A report never carries a
 * database-supplied label, policy term, destination, item, or provider value.
 */
export const ROUTE_SAFETY_PRIMARY_GATE_DESCRIPTORS = Object.freeze([
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_CONFIRMATION_REQUIRED,
    label: 'Policy confirmation',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_DESTINATION_SELECTION_REQUIRED,
    label: 'Destination selection',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.MANUAL_POLICY_EVIDENCE_REVIEW_REQUIRED,
    label: 'Policy evidence review',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_SCORE_BELOW_AUTOMATIC_THRESHOLD,
    label: 'Below automatic threshold',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_THRESHOLD_UNAVAILABLE,
    label: 'Policy threshold unavailable',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.AI_ADVISORY_CANNOT_ROUTE,
    label: 'AI advisory cannot route',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.PROVIDER_RECOVERY_REVIEW_REQUIRED,
    label: 'Provider recovery review',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_AUTO_PROVENANCE_REQUIRED,
    label: 'Policy route provenance review',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.ADMINISTRATIVE_CONFIRMATION_REQUIRED,
    label: 'Administrative confirmation',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.FALLBACK_RESULT_REVIEW_REQUIRED,
    label: 'Fallback result review',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.LOW_CONFIDENCE_REVIEW_REQUIRED,
    label: 'Low-confidence review',
  }),
  Object.freeze({
    id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.CLARIFICATION_REQUESTED,
    label: 'Clarification requested',
  }),
]);

export const ROUTE_SAFETY_PRIMARY_GATE_IDS = Object.freeze(
  ROUTE_SAFETY_PRIMARY_GATE_DESCRIPTORS.map(({ id }) => id),
);

const GATE_DESCRIPTOR_BY_ID = new Map(
  ROUTE_SAFETY_PRIMARY_GATE_DESCRIPTORS.map((descriptor, order) => [
    descriptor.id,
    Object.freeze({ ...descriptor, order }),
  ]),
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

function buildReadinessStatus(observationCount) {
  if (observationCount > 0) {
    return Object.freeze({
      id: 'safeguards_observed',
      label: 'Route safeguards observed',
      message: 'Recent decisions were retained behind deterministic route safeguards. This is descriptive and does not change policy or routing.',
      guidance: Object.freeze([
        'Resolve a pending decision in Command Center before changing a policy.',
        'Review a policy only when its deterministic evidence repeatedly conflicts with operator decisions.',
      ]),
    });
  }

  return Object.freeze({
    id: 'no_recent_safeguard_decisions',
    label: 'No recent safeguard decisions',
    message: 'No persisted route-safety decision was observed in the completed reporting window. This is not a policy-health or AI-readiness verdict.',
    guidance: Object.freeze([
      'Current classifications will still show their deterministic safeguard when one applies.',
    ]),
  });
}

/**
 * Builds a content-free report from a fixed database aggregate. Rows with an
 * unknown gate, malformed count, or no count are discarded before they reach
 * the HTTP boundary.
 */
export function buildRouteSafetyReadinessReport({ rows = [], window = null } = {}) {
  const countsByGateId = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const gateId = row?.primary_gate_id ?? row?.primaryGateId;
    const descriptor = GATE_DESCRIPTOR_BY_ID.get(gateId);
    const count = nonnegativeCount(row?.observation_count ?? row?.observationCount);

    if (!descriptor || count === 0) continue;
    countsByGateId.set(gateId, Math.min(
      Number.MAX_SAFE_INTEGER,
      (countsByGateId.get(gateId) || 0) + count,
    ));
  }

  const primaryGates = [...countsByGateId.entries()]
    .map(([id, count]) => ({ ...GATE_DESCRIPTOR_BY_ID.get(id), count }))
    .sort((left, right) => right.count - left.count || left.order - right.order)
    .slice(0, ROUTE_SAFETY_READINESS_MAX_PRIMARY_GATES)
    .map(({ id, label, count }) => Object.freeze({ id, label, count }));
  const observationCount = [...countsByGateId.values()].reduce(
    (sum, count) => Math.min(Number.MAX_SAFE_INTEGER, sum + count),
    0,
  );

  return Object.freeze({
    version: ROUTE_SAFETY_READINESS_VERSION,
    routeSafetyVersion: CLASSIFICATION_ROUTE_SAFETY_VERSION,
    window: Object.freeze({
      days: window?.days === ROUTE_SAFETY_READINESS_WINDOW_DAYS
        ? window.days
        : ROUTE_SAFETY_READINESS_WINDOW_DAYS,
      startDate: dateOnly(window?.start),
      endDate: dateOnly(window?.end),
    }),
    observationCount,
    primaryGates: Object.freeze(primaryGates),
    status: buildReadinessStatus(observationCount),
  });
}

/**
 * A fixed completed-day window avoids a partially written UTC day producing a
 * misleading refresh difference. Callers cannot select a range or dimension.
 */
export function buildRouteSafetyReadinessWindow({ now = new Date() } = {}) {
  return buildCompletedUtcDayMetricsWindow({
    windowDays: ROUTE_SAFETY_READINESS_WINDOW_DAYS,
    now,
  });
}
