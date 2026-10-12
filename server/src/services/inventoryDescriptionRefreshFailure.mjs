/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { diagnoseProviderResponse } from './providerResponseDiagnosis.mjs';
import { descriptionRefreshDuration, descriptionRefreshSqlCategory, descriptionRefreshStage, readDescriptionRefreshObservation } from './inventoryDescriptionRefreshObservation.mjs';

const taskFailures = new WeakMap();
const DATABASE_PROBLEMS = Object.freeze({
  database_query_cancelled: 'PostgreSQL cancelled the operation. This code alone does not distinguish a statement timeout from another cancellation.',
  database_lock_unavailable: 'The database operation could not acquire its required lock.',
  database_deadlock: 'PostgreSQL detected a deadlock and cancelled the transaction.',
  database_serialization: 'The database transaction could not be serialized with concurrent work.',
  database_connection: 'The database connection or protocol failed.',
  database_capacity: 'PostgreSQL could not admit another connection.',
  database_shutdown: 'PostgreSQL was stopping, recovering, or not ready for a connection.',
  database_permission: 'The database rejected the operation for insufficient privileges.',
  database_schema: 'The database operation referenced an unavailable table or column.',
  database_unknown: 'A database operation failed without an allowlisted SQLSTATE.',
});
const DATABASE_STEPS = 'Keep completed cache entries and safeguards. If this persists, correlate this incident and time with PostgreSQL logs and database diagnostics. Do not reset imports or increase deadlines without evidence.';
const UNKNOWN_STEPS = 'If this persists, open a Classifarr GitHub issue with this incident reference, time, stage and sanitized diagnostics. Exclude credentials, descriptions, SQL parameters and provider responses. Keep recovery safeguards enabled.';

export function diagnoseDescriptionRefreshFailure(error) {
  const observation = readDescriptionRefreshObservation(error, { consume: true });
  const code = observation.databaseCategory;
  const diagnosis = code ? { code, phase: 'refresh', problem: DATABASE_PROBLEMS[code], steps: DATABASE_STEPS, slowRetry: false }
    : diagnoseProviderResponse(error);
  if (['unknown', 'database_unknown'].includes(diagnosis.code)) diagnosis.steps = UNKNOWN_STEPS;
  return { diagnosis, observation };
}

function read(object, key) {
  try { return object?.[key]; } catch { return undefined; }
}

function safeFailure(value) {
  const incidentId = read(value, 'incidentId'), stage = read(value, 'stage'), category = read(value, 'category');
  if (typeof incidentId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(incidentId)) return null;
  const providerCode = diagnoseProviderResponse({ code: 'PROVIDER_RESPONSE_INVALID', providerResponseIssue: category }).code;
  if (typeof category !== 'string' || (!Object.hasOwn(DATABASE_PROBLEMS, category) && providerCode !== category)) return null;
  const output = { incidentId, stage: descriptionRefreshStage(stage), category };
  for (const key of ['operationDurationMs', 'databaseDurationMs']) {
    const duration = read(value, key);
    if (duration === null) output[key] = null;
    else if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) output[key] = descriptionRefreshDuration(duration);
  }
  const sqlState = read(value, 'sqlState');
  if (descriptionRefreshSqlCategory(sqlState) === category) output.sqlState = sqlState;
  return Object.freeze(output);
}

/** No raw causes or arbitrary error properties cross this scheduler boundary. */
export function createDescriptionRefreshTaskError(report) {
  const error = new Error('inventory_description_refresh_unavailable');
  const details = {}, failure = safeFailure(read(report, 'failure'));
  if (failure) details.failure = failure;
  const retryAfterSeconds = read(report, 'retryAfterSeconds');
  if (Number.isInteger(retryAfterSeconds) && retryAfterSeconds >= 1 && retryAfterSeconds <= 3600) details.retryAfterSeconds = retryAfterSeconds;
  taskFailures.set(error, Object.freeze(details));
  return error;
}

export function readDescriptionRefreshTaskFailure(error) {
  return taskFailures.get(error) ?? null;
}
