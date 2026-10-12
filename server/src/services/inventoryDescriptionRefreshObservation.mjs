/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const observations = new WeakMap();
const STAGES = new Set(['refresh', 'advisory_lock', 'cache_prune', 'isolation_prune',
  'state_read', 'corpus_read', 'admission_check', 'provider_creation',
  'representation_inspection', 'representation_checkpoint', 'backfill']);
const DATABASE_CODES = Object.freeze({
  '57014': 'database_query_cancelled', '55P03': 'database_lock_unavailable',
  '40P01': 'database_deadlock', '40001': 'database_serialization',
  '08000': 'database_connection', '08001': 'database_connection',
  '08003': 'database_connection', '08006': 'database_connection',
  '08007': 'database_connection', '08P01': 'database_connection',
  '53300': 'database_capacity', '57P01': 'database_shutdown',
  '57P02': 'database_shutdown', '57P03': 'database_shutdown',
  '42501': 'database_permission', '42P01': 'database_schema', '42703': 'database_schema',
});

export const descriptionRefreshStage = value => STAGES.has(value) ? value : 'refresh';
export const descriptionRefreshSqlCategory = value =>
  typeof value === 'string' && Object.hasOwn(DATABASE_CODES, value) ? DATABASE_CODES[value] : null;
export const descriptionRefreshDuration = value =>
  Number.isFinite(value) && value >= 0 ? Math.min(86_400_000, Math.round(value)) : null;

function tick(clock) {
  try { const value = clock(); return Number.isFinite(value) ? value : NaN; }
  catch { return NaN; }
}

function throwable(error) {
  return error !== null && (typeof error === 'object' || typeof error === 'function')
    ? error : new Error('inventory_description_operation_failed');
}

/** Internal weak metadata only: original errors remain usable by existing recovery logic. */
export function readDescriptionRefreshObservation(error, { consume = false } = {}) {
  const result = observations.get(error) ?? {};
  if (consume) observations.delete(error);
  return result;
}

export async function observeDescriptionRefreshStage(stage, operation, { clock = performance.now.bind(performance) } = {}) {
  const started = tick(clock);
  try { return await operation(); }
  catch (error) {
    const failure = throwable(error), prior = readDescriptionRefreshObservation(failure);
    if (!prior.stage) observations.set(failure, Object.freeze({ ...prior,
      stage: descriptionRefreshStage(stage), operationDurationMs: descriptionRefreshDuration(tick(clock) - started) }));
    throw failure;
  }
}

/** Call only around repository operations, never infer database origin from a provider's code. */
export async function observeDescriptionDatabaseOperation(operation, { clock = performance.now.bind(performance) } = {}) {
  const started = tick(clock);
  try { return await operation(); }
  catch (error) {
    const failure = throwable(error);
    let code;
    try { code = failure.code; } catch { /* Hostile getters are not diagnostic data. */ }
    const category = descriptionRefreshSqlCategory(code);
    observations.set(failure, Object.freeze({ ...readDescriptionRefreshObservation(failure),
      databaseCategory: category ?? 'database_unknown',
      ...(category ? { sqlState: code } : {}),
      databaseDurationMs: descriptionRefreshDuration(tick(clock) - started) }));
    throw failure;
  }
}
