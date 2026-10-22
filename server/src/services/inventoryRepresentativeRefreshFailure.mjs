/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { diagnoseProviderResponse } from './providerResponseDiagnosis.mjs';
import { representativeValidationIssue } from './representativeValidationDiagnostics.mjs';
import { descriptionRefreshDuration, descriptionRefreshSqlCategory, readDescriptionRefreshObservation } from './inventoryDescriptionRefreshObservation.mjs';
import { readRepresentativeRefreshObservation, representativeRefreshStage, representativeFailureProperty as read } from './inventoryRepresentativeRefreshObservation.mjs';

const taskFailures = new WeakMap();
const DATABASE_CATEGORIES = new Set(['database_query_cancelled', 'database_lock_unavailable', 'database_deadlock',
  'database_serialization', 'database_connection', 'database_capacity', 'database_shutdown', 'database_permission',
  'database_schema', 'database_unknown']);

function categoryOf(error) {
  const projected = Object.fromEntries(['code', 'message', 'providerResponseIssue', 'providerResponsePhase', 'embeddingIssue', 'representativeIssue']
    .map(key => [key, read(error, key)]));
  const issue = representativeValidationIssue(projected);
  return issue !== 'unknown_check' ? issue : diagnoseProviderResponse(projected).code;
}

function validCategory(category) {
  return typeof category === 'string' && (category === 'task_deadline' || DATABASE_CATEGORIES.has(category) ||
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
  if (descriptionRefreshSqlCategory(sqlState) === category) output.sqlState = sqlState;
  return Object.freeze(output);
}

export function createRepresentativeRefreshTaskError(report) {
  const error = new Error('inventory_representative_refresh_unavailable');
  const failure = safeFailure(read(report, 'failure'));
  taskFailures.set(error, Object.freeze(failure ? { failure } : {}));
  return error;
}

export function readRepresentativeRefreshTaskFailure(error) {
  return taskFailures.get(error) ?? null;
}
