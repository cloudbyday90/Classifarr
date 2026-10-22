/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { descriptionRefreshDuration, descriptionRefreshSqlCategory } from './inventoryDescriptionRefreshObservation.mjs';

const observations = new WeakMap();
const STAGES = new Set(['refresh', 'state_read', 'admission', 'provider_creation', 'representation_inspection',
  'candidate_preparation', 'warm_preparation', 'snapshot_read', 'fit', 'consumer_preparation',
  'verification_read', 'representation_checkpoint', 'final_state_read', 'publication']);
export const representativeRefreshStage = value => STAGES.has(value) ? value : 'refresh';

/** Read data properties only; untrusted getters/proxies are not diagnostic input. */
export function representativeFailureProperty(object, key) {
  try { return Object.getOwnPropertyDescriptor(object, key)?.value; } catch { return undefined; }
}

function tick(clock) {
  try { const value = clock(); return Number.isFinite(value) ? value : NaN; } catch { return NaN; }
}

function throwable(error) {
  return error !== null && (typeof error === 'object' || typeof error === 'function')
    ? error : new Error('inventory_representative_operation_failed');
}

export function readRepresentativeRefreshObservation(error, { consume = false } = {}) {
  const result = observations.get(error) ?? {};
  if (consume) observations.delete(error);
  return result;
}

export async function observeRepresentativeStage(stage, operation, { clock = performance.now.bind(performance) } = {}) {
  const started = tick(clock);
  try { return await operation(); }
  catch (error) {
    const failure = throwable(error), prior = readRepresentativeRefreshObservation(failure);
    if (!prior.stage) observations.set(failure, Object.freeze({ ...prior, stage: representativeRefreshStage(stage),
      operationDurationMs: descriptionRefreshDuration(tick(clock) - started) }));
    throw failure;
  }
}

function databaseFailure(error, duration) {
  const failure = throwable(error), prior = readRepresentativeRefreshObservation(failure);
  if (!prior.databaseCategory) {
    const code = representativeFailureProperty(failure, 'code'), category = descriptionRefreshSqlCategory(code);
    observations.set(failure, Object.freeze({ ...prior, databaseCategory: category ?? 'database_unknown',
      ...(category ? { sqlState: code } : {}), databaseDurationMs: duration }));
  }
  return failure;
}

/** Wrap actual client.query calls, not application callbacks in the same transaction. */
export async function observeRepresentativeDatabaseOperation(operation, { clock = performance.now.bind(performance) } = {}) {
  const started = tick(clock);
  try { return await operation(); }
  catch (error) { throw databaseFailure(error, descriptionRefreshDuration(tick(clock) - started)); }
}

/** Acquisition/BEGIN/COMMIT are database operations; unfinished callbacks need their own attribution. */
export async function observeRepresentativeTransaction(withTransaction, operation, { clock = performance.now.bind(performance) } = {}) {
  const started = tick(clock);
  let entered = false, completed = false;
  try {
    return await withTransaction(async client => {
      entered = true;
      const result = await operation(client);
      completed = true;
      return result;
    });
  } catch (error) {
    if (!entered || completed) throw databaseFailure(error, descriptionRefreshDuration(tick(clock) - started));
    throw error;
  }
}
