/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { diagnoseProviderResponse } from './providerResponseDiagnosis.mjs';
import { representativeValidationIssue } from './representativeValidationDiagnostics.mjs';
import { descriptionRefreshDuration, descriptionRefreshSqlCategory, readDescriptionRefreshObservation } from './inventoryDescriptionRefreshObservation.mjs';
import { readRepresentativeRefreshObservation, representativeRefreshStage, representativeFailureProperty as read } from './inventoryRepresentativeRefreshObservation.mjs';
import { INVENTORY_REFRESH_DISK_FULL, INVENTORY_REFRESH_STORAGE_RETRY_MS, inventoryRefreshDatabaseDiagnosis, isInventoryRefreshDatabaseCategory } from './inventoryRefreshDatabaseFailure.mjs';

const taskFailures = new WeakMap();

function categoryOf(error) {
  const projected = Object.fromEntries(['code', 'message', 'providerResponseIssue', 'providerResponsePhase', 'embeddingIssue', 'representativeIssue']
    .map(key => [key, read(error, key)]));
  const issue = representativeValidationIssue(projected);
  return issue !== 'unknown_check' ? issue : diagnoseProviderResponse(projected).code;
}

function validCategory(category) {
  return typeof category === 'string' && (category === 'task_deadline' || isInventoryRefreshDatabaseCategory(category) ||
    representativeValidationIssue({ representativeIssue: category }) === category ||
    diagnoseProviderResponse({ code: 'PROVIDER_RESPONSE_INVALID', providerResponseIssue: category }).code === category);
}

/** Project first, then forget weak observations. No cause or raw message survives. */
export function createRepresentativeRefreshFailure(error, { deadlineExpired = false, origin = error } = {}) {
  const outer = readRepresentativeRefreshObservation(error, { consume: true });
  const inner = origin === error ? outer : readRepresentativeRefreshObservation(origin, { consume: true });
  const observation = inner.stage ? inner : outer;
  // State reads already use the description repository's genuine DB observer.
  const stateObservation = readDescriptionRefreshObservation(error, { consume: true });
  const originState = origin === error ? stateObservation : readDescriptionRefreshObservation(origin, { consume: true });
  const database = observation.databaseCategory ? observation : outer.databaseCategory ? outer : originState;
  const category = deadlineExpired ? 'task_deadline' : database.databaseCategory ?? categoryOf(error);
  return safeFailure({ incidentId: randomUUID(), stage: observation.stage, category,
    operationDurationMs: observation.operationDurationMs ?? null,
    ...(database.databaseCategory && !deadlineExpired ? { sqlState: database.sqlState, databaseDurationMs: database.databaseDurationMs } : {}) });
}

export function forgetRepresentativeRefreshFailure(error) {
  readRepresentativeRefreshObservation(error, { consume: true });
  readDescriptionRefreshObservation(error, { consume: true });
}

function safeFailure(value) {
  const incidentId = read(value, 'incidentId'), category = read(value, 'category');
  if (typeof incidentId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(incidentId) || !validCategory(category)) return null;
  const output = { incidentId, category, stage: representativeRefreshStage(read(value, 'stage')) };
  for (const key of ['operationDurationMs', 'databaseDurationMs']) {
    const duration = read(value, key);
    if (duration === null) output[key] = null;
    else if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) output[key] = descriptionRefreshDuration(duration);
  }
  const sqlState = read(value, 'sqlState');
  if (category === INVENTORY_REFRESH_DISK_FULL && sqlState !== '53100') return null;
  if (descriptionRefreshSqlCategory(sqlState) === category) output.sqlState = sqlState;
  return Object.freeze(output);
}

export function createRepresentativeRefreshTaskError(report) {
  const error = new Error('inventory_representative_refresh_unavailable');
  const failure = safeFailure(read(report, 'failure'));
  const diagnosis = failure?.category === INVENTORY_REFRESH_DISK_FULL ? inventoryRefreshDatabaseDiagnosis(failure.category) : null;
  taskFailures.set(error, Object.freeze(failure ? { failure, ...(diagnosis ? {
    problem: diagnosis.problem, steps: diagnosis.steps, retryAfterSeconds: INVENTORY_REFRESH_STORAGE_RETRY_MS / 1000,
  } : {}) } : {}));
  return error;
}

export function readRepresentativeRefreshTaskFailure(error) {
  return taskFailures.get(error) ?? null;
}
