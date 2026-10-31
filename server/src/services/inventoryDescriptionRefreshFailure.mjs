/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { diagnoseProviderResponse } from './providerResponseDiagnosis.mjs';
import { descriptionRefreshDuration, descriptionRefreshSqlCategory, descriptionRefreshStage, readDescriptionRefreshObservation } from './inventoryDescriptionRefreshObservation.mjs';
import { INVENTORY_REFRESH_DISK_FULL, inventoryRefreshDatabaseDiagnosis, isInventoryRefreshDatabaseCategory } from './inventoryRefreshDatabaseFailure.mjs';

const taskFailures = new WeakMap();
const UNKNOWN_STEPS = 'If this persists, open a Classifarr GitHub issue with this incident reference, time, stage and sanitized diagnostics. Exclude credentials, descriptions, SQL parameters and provider responses. Keep recovery safeguards enabled.';

export function diagnoseDescriptionRefreshFailure(error) {
  const observation = readDescriptionRefreshObservation(error, { consume: true });
  const code = observation.databaseCategory;
  const diagnosis = inventoryRefreshDatabaseDiagnosis(code) ?? diagnoseProviderResponse(error);
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
  if (typeof category !== 'string' || (!isInventoryRefreshDatabaseCategory(category) && providerCode !== category)) return null;
  const output = { incidentId, stage: descriptionRefreshStage(stage), category };
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
