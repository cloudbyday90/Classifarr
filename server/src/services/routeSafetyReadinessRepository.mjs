/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  ROUTE_SAFETY_PRIMARY_GATE_IDS,
} from './routeSafetyReadiness.mjs';
import { CLASSIFICATION_ROUTE_SAFETY_VERSION } from './classificationRouteSafetyGate.mjs';

export const LOAD_ROUTE_SAFETY_READINESS_PRIMARY_GATE_COUNTS_SQL = `
  SELECT
    metadata #>> '{classification_details,route_safety,primary_gate,id}' AS primary_gate_id,
    COUNT(*)::bigint AS observation_count
  FROM classification_history
  WHERE created_at >= $1
    AND created_at < $2
    AND metadata #>> '{classification_details,route_safety,version}' = $3
    AND metadata #>> '{classification_details,route_safety,primary_gate,id}' = ANY($4::text[])
  GROUP BY 1
`;

function assertAggregateWindow({ start, end } = {}) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) ||
      !(end instanceof Date) || Number.isNaN(end.getTime()) || start >= end) {
    throw new TypeError('A valid route-safety readiness observation range is required.');
  }
}

/**
 * Reads only a fixed gate identifier and its aggregate count. It never selects
 * classification, policy, library, provider, prompt, response, actor, or
 * routing fields, and it creates no additional telemetry record.
 */
export async function loadRouteSafetyReadinessPrimaryGateCounts(db, window = {}) {
  if (!db || typeof db.query !== 'function') {
    throw new TypeError('Route-safety readiness requires a query-capable database.');
  }
  assertAggregateWindow(window);

  const result = await db.query(LOAD_ROUTE_SAFETY_READINESS_PRIMARY_GATE_COUNTS_SQL, [
    window.start.toISOString(),
    window.end.toISOString(),
    CLASSIFICATION_ROUTE_SAFETY_VERSION,
    ROUTE_SAFETY_PRIMARY_GATE_IDS,
  ]);

  return result?.rows || [];
}
