/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { archiveUuid } from './archiveRetentionContract.mjs';
import { ARCHIVE_CATEGORIES } from './archiveContract.mjs';

export const RETENTION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
export const RETENTION_BINDING_LIMIT = 100000;
export const RETENTION_WARNING_COUNT = 80000;

export function gatewayRetentionDays(value = 90) {
  if (!Number.isInteger(value) || value < 1 || value > 3650) throw gatewayError('gateway_config_invalid');
  return value;
}

/** Deterministic capacity assessment, not deletion or recovery authority. */
export function assessGatewayRetention(row, retentionDays) {
  const counts = row?.categories;
  if (!archiveUuid(row?.reference) || !(row.observed_at instanceof Date) || !Number.isFinite(row.observed_at.getTime()) ||
      !(row.cutoff instanceof Date) || !Number.isFinite(row.cutoff.getTime()) || row.cutoff >= row.observed_at ||
      !Number.isInteger(row.binding_count) || row.binding_count < 0 || row.binding_count > RETENTION_BINDING_LIMIT ||
      typeof row.legacy_active !== 'boolean' || !counts || Object.keys(counts).length !== ARCHIVE_CATEGORIES.length ||
      ARCHIVE_CATEGORIES.some(key => !Number.isSafeInteger(counts[key]) || counts[key] < 0)) {
    throw gatewayError('gateway_retention_unavailable');
  }
  const total = Object.values(counts).reduce((sum, count) => sum + Number(count), 0);
  if (total > RETENTION_BINDING_LIMIT) throw gatewayError('gateway_retention_unavailable');
  const inconsistent = total !== row.binding_count || row.legacy_active;
  const capacity = row.binding_count >= RETENTION_BINDING_LIMIT ? 'full' : row.binding_count >= RETENTION_WARNING_COUNT ? 'approaching' : 'normal';
  const candidates = counts.older_terminal_review, protectedCount = total - candidates;
  const decision = inconsistent ? 'assessment_blocked' : capacity === 'normal' ? 'not_needed' : candidates ? 'cleanup_needed' : 'protected_history';
  const reason = inconsistent ? 'history_inconsistent' : capacity === 'normal' ? 'history_within_capacity' :
    !candidates ? 'no_safe_candidates' : capacity === 'full' ? 'history_capacity_reached' : 'history_nearing_capacity';
  return { version: 1, reference: row.reference, observedAt: row.observed_at.toISOString(), cutoff: row.cutoff.toISOString(),
    retentionDays: gatewayRetentionDays(retentionDays), capacity, decision, reason,
    bindingCount: row.binding_count, bindingLimit: RETENTION_BINDING_LIMIT, warningCount: RETENTION_WARNING_COUNT,
    candidates, protectedCount, categories: { ...counts },
    projectedCount: inconsistent ? null : protectedCount,
    sufficientHeadroom: !inconsistent && protectedCount < RETENTION_WARNING_COUNT,
    purgeAuthorized: false };
}
