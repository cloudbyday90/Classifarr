/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';

// Correlation only: never a lease, authentication token or installation identity.
export const pgvectorReporterId = randomUUID();
export const PGVECTOR_REPORT_KEY = 'avx_guard_selection_report_v1';
const REASONS = new Set(['unknown', 'staging_disabled', 'staging_invalid', 'generic_build',
  'cpu_unknown', 'cpu_no_avx', 'optimized_binary_unavailable', 'optimized_staged',
  'staging_target_unsafe', 'staging_failed', 'variant_binaries_missing']);
const VARIANTS = new Set(['generic', 'avx', 'avx2']);
const BUILDS = new Set([...VARIANTS, 'multi']);
const FLAGS = new Set(['true', 'false', 'unknown']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export function normalizePgvectorTimestamp(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value !== 'string' || (value.length !== 20 && value.length !== 24)) return null;
  const shape = value.length === 20 ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  if (!shape.test(value)) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const canonical = parsed.toISOString();
  return canonical === value || canonical.replace('.000Z', 'Z') === value ? canonical : null;
}

export function createPgvectorSelectionReport({ environment, cpu, databaseStartedAt,
  reporterId = pgvectorReporterId, now = new Date() }) {
  const selectedVariant = VARIANTS.has(environment.CLASSIFARR_PGVECTOR_VARIANT_SELECTED)
    ? environment.CLASSIFARR_PGVECTOR_VARIANT_SELECTED : 'unknown';
  const build = BUILDS.has(environment.CLASSIFARR_PGVECTOR_BUILD) ? environment.CLASSIFARR_PGVECTOR_BUILD : 'unknown';
  const selectedAt = normalizePgvectorTimestamp(environment.CLASSIFARR_PGVECTOR_SELECTION_AT);
  const embedded = environment.CLASSIFARR_PGVECTOR_SELECTION_SOURCE === 'embedded_entrypoint' && selectedAt !== null;
  let reason = embedded && REASONS.has(environment.CLASSIFARR_PGVECTOR_SELECTION_REASON)
    ? environment.CLASSIFARR_PGVECTOR_SELECTION_REASON : 'unknown';
  if (reason === 'optimized_staged' ? !['avx', 'avx2'].includes(selectedVariant) : selectedVariant !== 'generic') reason = 'unknown';
  return { schemaVersion: 1, reporterId, recordedAt: now.toISOString(), selectedAt: embedded ? selectedAt : null,
    databaseScope: embedded ? 'embedded_entrypoint' : 'unverified',
    databaseStartedAt: normalizePgvectorTimestamp(databaseStartedAt), reason, selectedVariant, build,
    cpuAvx: cpu.hasAvx === null ? 'unknown' : String(cpu.hasAvx),
    cpuAvx2: cpu.hasAvx2 === null ? 'unknown' : String(cpu.hasAvx2) };
}

/** Validate and copy only the supported fields; never expose arbitrary settings JSON. */
function parseReport(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const r = JSON.parse(raw);
    if (!r || r.schemaVersion !== 1 || typeof r.reporterId !== 'string' || !UUID.test(r.reporterId)
      || !REASONS.has(r.reason) || !['embedded_entrypoint', 'unverified'].includes(r.databaseScope)
      || ![...VARIANTS, 'unknown'].includes(r.selectedVariant) || ![...BUILDS, 'unknown'].includes(r.build)
      || !FLAGS.has(r.cpuAvx) || !FLAGS.has(r.cpuAvx2)) return null;
    const recordedAt = normalizePgvectorTimestamp(r.recordedAt);
    const selectedAt = normalizePgvectorTimestamp(r.selectedAt);
    const databaseStartedAt = normalizePgvectorTimestamp(r.databaseStartedAt);
    if (!recordedAt || (r.selectedAt !== null && !selectedAt)
      || (r.databaseStartedAt !== null && !databaseStartedAt)
      || (selectedAt && selectedAt > recordedAt)
      || (r.databaseScope === 'embedded_entrypoint' && !selectedAt)) return null;
    if (r.reason !== 'unknown' && (r.databaseScope !== 'embedded_entrypoint'
      || (r.reason === 'optimized_staged' ? !['avx', 'avx2'].includes(r.selectedVariant) : r.selectedVariant !== 'generic'))) return null;
    return { schemaVersion: 1, reporterId: r.reporterId, recordedAt, selectedAt,
      databaseScope: r.databaseScope, databaseStartedAt, reason: r.reason,
      selectedVariant: r.selectedVariant, build: r.build, cpuAvx: r.cpuAvx, cpuAvx2: r.cpuAvx2 };
  } catch { return null; }
}

export function presentPgvectorSelection(raw, { reporterId = pgvectorReporterId, databaseStartedAt = null,
  now = new Date() } = {}) {
  if (raw === undefined || raw === null) return { status: 'legacy', report: null };
  const report = parseReport(raw);
  if (!report || report.recordedAt > now.toISOString()) return { status: 'invalid', report: null };
  const currentDatabase = normalizePgvectorTimestamp(databaseStartedAt);
  const status = report.reporterId !== reporterId ? 'other_process'
    : !currentDatabase || !report.databaseStartedAt ? 'unavailable'
      : report.databaseStartedAt !== currentDatabase ? 'database_changed' : 'current_process';
  return { status, report };
}
