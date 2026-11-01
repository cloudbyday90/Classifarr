/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_BACKGROUND_READINESS_SQL } from './inventoryBackgroundReadiness.mjs';

export const INVENTORY_READINESS_PROBE_MS = 3000;

/** Opt-in fixed SELECT; the signaled read runner owns setup and cancellation. */
export function readBoundedInventoryReadiness(database, { signal, scope }) {
  return database.withTransaction(async client =>
    (await client.query(INVENTORY_BACKGROUND_READINESS_SQL)).rows[0]?.readiness ?? 'unavailable',
  { signal, readOnly: true, timeoutMs: INVENTORY_READINESS_PROBE_MS, readinessScope: scope });
}
