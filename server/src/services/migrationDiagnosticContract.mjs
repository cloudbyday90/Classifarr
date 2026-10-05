/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const MAX_DIAGNOSTIC_BYTES = 128 * 1024;
export const DIAGNOSTIC_STEPS = [
  'attempt_started', 'database_connect', 'maintenance_lock', 'session_limits',
  'preflight', 'ledger_probe', 'snapshot_read', 'snapshot_execute', 'snapshot_complete',
  'snapshot_failed', 'ledger_ensure', 'migration_discovery', 'migration_read',
  'migration_execute', 'migration_ledger', 'migration_committed', 'migration_failed',
  'transaction_rollback', 'transaction_rollback_failed', 'postflight', 'attempt_failed', 'attempt_complete',
];
const SAFE_REASONS = [
  'unknown', 'schema_migration_files_unavailable', 'schema_version_not_supported',
  'schema_maintenance_incomplete', 'schema_restore_verification_required',
];
const SYSTEM_CODES = new Set(['EACCES', 'EPERM', 'ENOENT', 'ENOSPC', 'EIO', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const migration = z.string().max(255).regex(/^(?:[0-9]+_[A-Za-z0-9_-]+\.sql|current\.sql)$/);
const errorSchema = z.object({
  parent: z.number().int().min(0).max(7).nullable(), relation: z.enum(['root', 'cause', 'aggregate']),
  code: z.string().refine(value => value === 'unknown' || SYSTEM_CODES.has(value) || /^[0-9A-Z]{5}$/.test(value)),
  reason: z.enum(SAFE_REASONS),
  frames: z.array(z.string().max(180).regex(/^(?:src\/[A-Za-z0-9_./-]+\.(?:mjs|js)|node:[A-Za-z0-9_/-]+):[0-9]+:[0-9]+$/)).max(12),
}).strict();
export const diagnosticSchema = z.object({
  version: z.literal(1), attemptId: z.string().uuid(), targetHash: digest,
  startedAt: z.string().datetime(), finishedAt: z.string().datetime(),
  outcome: z.enum(['failed', 'recovered']),
  runtime: z.object({ node: z.string().regex(/^v\d+\.\d+\.\d+$/), platform: z.enum(['linux', 'win32', 'darwin', 'other']), arch: z.enum(['x64', 'arm64', 'other']), sourceRevision: z.string().regex(/^(?:[a-f0-9]{40}|unknown)$/) }).strict(),
  events: z.array(z.object({
    sequence: z.number().int().nonnegative(), at: z.string().datetime(), step: z.enum(DIAGNOSTIC_STEPS),
    migration: migration.optional(), contentHash: digest.optional(),
    errors: z.array(errorSchema).max(8).optional(), errorChainTruncated: z.boolean().optional(),
  }).strict()).min(1).max(512),
  omittedEvents: z.number().int().nonnegative(),
  limitations: z.literal('Sanitized migration trace only. SQL, row values, raw error messages and absolute paths are omitted. Stack locations are restricted to application/Node frames. Process termination or storage failure may leave no report. This is not a complete server log.'),
}).strict();
export const DIAGNOSTIC_LIMITATIONS = diagnosticSchema.shape.limitations.value;

export function migrationTargetHash(environment = process.env) {
  return createHash('sha256').update(JSON.stringify([
    environment.POSTGRES_HOST || 'localhost', environment.POSTGRES_PORT || '5432',
    environment.POSTGRES_DB || 'classifarr',
  ])).digest('hex');
}

export function sanitizeMigrationError(error) {
  const errors = [];
  const seen = new Set();
  const pending = [{ error, parent: null, relation: 'root' }];
  const read = (value, key) => { try { return value?.[key]; } catch { return undefined; } };
  let truncated = false;
  while (pending.length && errors.length < 8) {
    const { error: current, parent, relation } = pending.shift();
    if (seen.has(current)) { truncated = true; continue; }
    seen.add(current);
    const rawCode = read(current, 'code');
    const code = typeof rawCode === 'string' && (SYSTEM_CODES.has(rawCode) || /^[0-9A-Z]{5}$/.test(rawCode)) ? rawCode : 'unknown';
    const frames = [];
    // Never include the first line: PostgreSQL exception messages can contain row values.
    const stack = read(current, 'stack');
    for (const line of (typeof stack === 'string' ? stack : '').slice(0, 16384).split('\n').slice(1, 40)) {
      const normalized = line.replaceAll('\\', '/');
      const match = normalized.match(/(?:\/(src\/[A-Za-z0-9_./-]+\.(?:mjs|js))|(node:[A-Za-z0-9_/-]+)):(\d+):(\d+)\)?$/);
      const frame = match && `${match[1] || match[2]}:${match[3]}:${match[4]}`;
      if (frame && frame.length <= 180 && frames.length < 12) frames.push(frame);
    }
    const index = errors.length, message = read(current, 'message');
    errors.push({ parent, relation, code, reason: SAFE_REASONS.includes(message) ? message : 'unknown', frames });
    const cause = read(current, 'cause');
    if (cause !== undefined) pending.push({ error: cause, parent: index, relation: 'cause' });
    const aggregate = read(current, 'errors');
    if (Array.isArray(aggregate)) {
      truncated ||= aggregate.length > 8;
      for (const child of aggregate.slice(0, 8)) pending.push({ error: child, parent: index, relation: 'aggregate' });
    }
  }
  return { errors, errorChainTruncated: truncated || pending.length > 0 };
}

export function migrationDiagnosticKind(report) {
  if (report.outcome === 'recovered') return 'recovered';
  const codes = (report.events.findLast(event => event.errors?.length)?.errors || []).map(error => error.code);
  if (codes.includes('42501') || codes.includes('EACCES') || codes.includes('EPERM')) return 'permissions';
  if (codes.includes('55P03') || codes.includes('57014')) return 'timeout';
  if (codes.includes('53100') || codes.includes('ENOSPC')) return 'storage';
  if (codes.some(code => code.startsWith('08') || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(code))) return 'connection';
  return 'unknown';
}

export function migrationDiagnosticGuidance(report) {
  const kind = migrationDiagnosticKind(report);
  if (kind === 'recovered') return 'This attempt completed after an earlier failure. Do not repair or replay a migration solely because this historical report exists. Check current library guidance separately.';
  if (kind === 'permissions') return 'Check the maintenance database role and app-data permissions. Do not grant the web process superuser access. Save this report before changing deployment settings.';
  if (kind === 'timeout') return 'The operation encountered a lock or timeout. Check database activity for this database, stop the conflicting maintenance operation if confirmed, and retry the normal container startup. Do not delete migration history.';
  if (kind === 'storage') return 'Check free space on the database and app-data volumes, preserve a backup, then retry normal startup after resolving the storage problem.';
  if (kind === 'connection') return 'Check PostgreSQL availability and the configured connection target, then retry normal startup. Do not reset the database.';
  return 'Open a GitHub issue so the maintainers can investigate this unknown failure and provide a proper fix. Attach the sanitized report and image version. Review attachments first; do not include credentials or raw database logs. Do not replay migrations or weaken safeguards.';
}
