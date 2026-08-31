/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { CLASSIFICATION_ROUTE_SAFETY_VERSION } from './classificationRouteSafetyGate.mjs';
import { ROUTE_SAFETY_PRIMARY_GATE_IDS } from './routeSafetyReadiness.mjs';

export const LOAD_ROUTE_SAFETY_MAINTENANCE_HANDOFF_GATE_COUNTS_SQL = `
  SELECT
    CASE WHEN created_at >= $3 THEN 'current' ELSE 'previous' END AS window_id,
    metadata #>> '{classification_details,route_safety,primary_gate,id}' AS primary_gate_id,
    COUNT(*)::bigint AS observation_count
  FROM classification_history
  WHERE created_at >= $1
    AND created_at < $2
    AND metadata #>> '{classification_details,route_safety,version}' = $4
    AND metadata #>> '{classification_details,route_safety,primary_gate,id}' = ANY($5::text[])
  GROUP BY 1, 2
`;

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function assertAdjacentObservationWindows({ previous, current } = {}) {
  if (!isValidDate(previous?.start) || !isValidDate(previous?.end) ||
      !isValidDate(current?.start) || !isValidDate(current?.end) ||
      previous.start >= previous.end || current.start >= current.end ||
      previous.end.getTime() !== current.start.getTime()) {
    throw new TypeError('Valid adjacent route-safety maintenance observation windows are required.');
  }
}

/**
 * Reads only a fixed window marker, primary gate identifier, and aggregate
 * count. No caller controls the time range, gate vocabulary, selected fields,
 * or the policy-review target.
 */
export async function loadRouteSafetyMaintenanceHandoffGateCounts(db, windows = {}) {
  if (!db || typeof db.query !== 'function') {
    throw new TypeError('Route-safety maintenance handoff requires a query-capable database.');
  }
  assertAdjacentObservationWindows(windows);

  const result = await db.query(LOAD_ROUTE_SAFETY_MAINTENANCE_HANDOFF_GATE_COUNTS_SQL, [
    windows.previous.start.toISOString(),
    windows.current.end.toISOString(),
    windows.current.start.toISOString(),
    CLASSIFICATION_ROUTE_SAFETY_VERSION,
    ROUTE_SAFETY_PRIMARY_GATE_IDS,
  ]);

  return result?.rows || [];
}
