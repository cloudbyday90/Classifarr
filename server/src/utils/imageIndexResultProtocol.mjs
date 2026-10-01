/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { QUEUE_MAINTENANCE_RESULTS, queueMaintenanceResultByte } from './queueMaintenanceHandoffProtocol.mjs';

// Exit codes and response bytes are fixed, disjoint from C/D/E and never carry child output.
const failures = Object.freeze({
  70: 'image_index_maintenance_deadline',
  71: 'image_index_lock_contention',
  72: 'image_index_query_cancelled',
  73: 'image_index_definition_mismatch',
  74: 'image_index_verification_failed',
  76: 'image_index_database_unavailable',
});
const deferrals = Object.freeze({
  80: 'image_index_capacity_unknown',
  81: 'image_index_background_busy',
  82: 'image_index_memory_unknown',
  83: 'image_index_memory_pressure',
});
const categories = Object.freeze({ ...failures, ...deferrals });
export const IMAGE_INDEX_RESULTS = Object.freeze({ ...QUEUE_MAINTENANCE_RESULTS, ...categories });
export const IMAGE_INDEX_DEFERRED_REASONS = Object.freeze(Object.values(deferrals));

export function imageIndexResultCode(reason) {
  const entry = Object.entries(categories).find(([, value]) => value === reason);
  return entry ? Number(entry[0]) : null;
}

export function imageIndexFailureCode(error) {
  // Match only fixed internal reasons; never return a database message or SQL text.
  const known = imageIndexResultCode(error?.message);
  if (Object.hasOwn(failures, known)) return known;
  if (error?.code === '55P03') return 71;
  if (error?.code === '57014') return 72;
  if (['08000', '08001', '08003', '08004', '08006', '08007', '08P01', '53300', '57P01', '57P02', '57P03',
    'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(error?.code)) return 76;
  return 1;
}

export function imageIndexResultByte(result) {
  return result?.signal === null && typeof result.code === 'number' && Object.hasOwn(categories, result.code)
    ? Number(result.code) : queueMaintenanceResultByte(result);
}

/** Safe additive logger fields; queue failure IDs and retry accounting stay unchanged. */
export function imageIndexFailureLogFields(error) {
  const code = imageIndexFailureCode(error);
  return code === 1 ? {} : { maintenanceReason: failures[code] };
}
