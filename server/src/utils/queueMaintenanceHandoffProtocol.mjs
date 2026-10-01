/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const QUEUE_MAINTENANCE_REQUEST = 0x51;
export const QUEUE_MAINTENANCE_INTERVAL_MS = 300_000;
export const QUEUE_MAINTENANCE_RESULTS = Object.freeze({ 0x43: 'complete', 0x44: 'deferred', 0x45: 'unavailable' });
export const queueMaintenanceResultByte = result => result?.signal !== null ? 0x45
  : result.code === 0 ? 0x43 : result.code === 75 ? 0x44 : 0x45;
