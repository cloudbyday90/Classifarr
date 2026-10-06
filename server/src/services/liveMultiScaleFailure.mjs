/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { diagnoseProviderResponse, providerResponseError } from './providerResponseDiagnosis.mjs';

const stages = new Set(['clock', 'readiness', 'state_read', 'admission', 'provider_inspection',
  'snapshot_read', 'source_validation', 'profile_build', 'snapshot_verify', 'provider_verify', 'state_verify', 'publication']);
const databaseStages = new Set(['readiness', 'state_read', 'admission', 'snapshot_read', 'snapshot_verify', 'state_verify']);
const providerStages = new Set(['provider_inspection', 'provider_verify']);
const providerIssues = new Set(['transport', 'timeout', 'http_auth', 'http_missing', 'http_rejected', 'http_busy',
  'body_limit', 'encoding', 'json', 'model', 'batch', 'shape', 'dimensions', 'nonfinite', 'float32', 'zero', 'representation', 'model_changed']);
const databaseCodes = new Map([
  ...['08000', '08001', '08003', '08004', '08006', '08007', '08P01', '57P01', '57P02', '57P03',
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].map(code => [code, 'database_connection']),
  ['57014', 'database_query_cancelled'], ['55P03', 'database_lock_unavailable'],
  ['42501', 'database_permissions'], ['42P01', 'database_schema'], ['42703', 'database_schema'],
  ...['53100', '53200', '53300', '53400'].map(code => [code, 'database_capacity']),
  ['40001', 'database_conflict'], ['40P01', 'database_conflict'],
]);
const internalCodes = new Map([
  ['multi_scale_complete_cache_required', 'cached_vectors_incomplete'],
  ...['inventory_representative_library_budget', 'inventory_representative_identity_budget',
    'inventory_representative_vector_budget', 'inventory_representative_profile_input_budget'].map(code => [code, 'source_budget_or_shape']),
  ...['multi_scale_source_invalid', 'multi_scale_unscoped_source', 'inventory_description_cache_scope_invalid'].map(code => [code, 'source_invalid']),
]);
const guidance = new Map([
  ['unknown', 'The cause was not classified. If this persists, open a GitHub issue with the reviewed bug report and image version; omit credentials and raw database or provider logs.'],
  ['clock_invalid', 'The runtime clock could not be read. Check host time and report the fixed code if this persists.'],
  ['attempt_timeout', 'Comparison preparation exceeded its deadline. It will retry with existing limits; review competing work if this persists.'],
  ['operation_timeout', 'A preparation step timed out. It will retry automatically; check the reported step before changing configuration.'],
  ['database_connection', 'Check PostgreSQL health and connectivity for this installation. Preparation will retry; do not reset the database.'],
  ['database_query_cancelled', 'A database query was cancelled or exceeded its deadline. Check database activity and slow-query timings; do not disable timeouts.'],
  ['database_lock_unavailable', 'A database lock was unavailable. Check competing database work if retries persist; do not remove ownership safeguards.'],
  ['database_permissions', 'Check the configured database role permissions. Do not grant the web process superuser access.'],
  ['database_schema', 'A required database table or column was unavailable. Review migration diagnostics and image compatibility; do not replay SQL manually.'],
  ['database_capacity', 'PostgreSQL reported a resource limit. Check database disk, memory and connection usage before changing limits.'],
  ['database_conflict', 'Database work conflicted with another transaction. Automatic retry remains enabled; investigate competing work if persistent.'],
  ['cached_vectors_incomplete', 'Description-vector backfill is not complete for the current model. Open Libraries, select a library, and check Library evidence coverage. Import completion does not include optional vectors. If coverage stops advancing, review description-backfill diagnostics; do not reset imports or disable memory safeguards.'],
  ['cached_vector_invalid', 'A cached vector failed validation. Review description-cache diagnostics and report persistent failures; do not pad, truncate or edit vectors.'],
  ['source_budget_or_shape', 'The inventory snapshot failed a size or structure check. Report persistent failures with this fixed code; do not bypass snapshot limits.'],
  ['source_invalid', 'The inventory snapshot failed scope or identity validation. It will be re-read; report persistent failures without exporting media data.'],
]);
const read = (value, key) => { try { return value?.[key]; } catch { return undefined; } };
const incompleteCoverage = value => {
  const eligibleDescriptions = read(value, 'eligibleDescriptions');
  const cachedDescriptions = read(value, 'cachedDescriptions');
  const missingDescriptions = read(value, 'missingDescriptions');
  if (![eligibleDescriptions, cachedDescriptions, missingDescriptions].every(Number.isInteger) ||
      eligibleDescriptions < 1 || eligibleDescriptions > 10000 || cachedDescriptions < 0 ||
      cachedDescriptions >= eligibleDescriptions || missingDescriptions !== eligibleDescriptions - cachedDescriptions) return {};
  return { coverage: { eligibleDescriptions, cachedDescriptions, missingDescriptions } };
};

/** Bounded cause traversal. Stage is supplied by the worker, never by an exception. */
export function diagnoseLiveMultiScaleFailure(stage, error, { deadlineExpired = false } = {}) {
  const safeStage = stages.has(stage) ? stage : 'unknown';
  if (deadlineExpired) return { stage: safeStage, code: 'attempt_timeout' };
  const seen = new Set();
  for (let current = error, count = 0; current != null && count < 4 && !seen.has(current); current = read(current, 'cause'), count++) {
    seen.add(current);
    const code = read(current, 'code');
    if (databaseStages.has(safeStage) && databaseCodes.has(code)) return { stage: safeStage, code: databaseCodes.get(code) };
    if (providerStages.has(safeStage)) {
      const provider = diagnoseProviderResponse(current);
      if (providerIssues.has(provider.code)) return { stage: safeStage, code: `provider_${provider.code}` };
    } else if (['snapshot_read', 'snapshot_verify', 'source_validation', 'profile_build'].includes(safeStage) && code === 'INVALID_EMBEDDING') {
      return { stage: safeStage, code: 'cached_vector_invalid' };
    }
    if (['snapshot_read', 'snapshot_verify', 'source_validation', 'profile_build'].includes(safeStage)) {
      const mapped = internalCodes.get(read(current, 'message'));
      if (mapped) return { stage: safeStage, code: mapped,
        ...(mapped === 'cached_vectors_incomplete' ? incompleteCoverage(read(current, 'coverage')) : {}) };
    }
    if (read(current, 'name') === 'TimeoutError') return { stage: safeStage, code: 'operation_timeout' };
  }
  return { stage: safeStage, code: safeStage === 'clock' ? 'clock_invalid' : 'unknown' };
}

/** Revalidate at the log boundary; only finite categories and fixed prose escape. */
export function describeLiveMultiScaleFailure(failure) {
  const stage = read(failure, 'stage'), code = read(failure, 'code');
  const safeStage = stages.has(stage) ? stage : 'unknown';
  const providerIssue = typeof code === 'string' && code.length <= 50 && code.startsWith('provider_') ? code.slice(9) : null;
  if (providerStages.has(safeStage) && providerIssues.has(providerIssue)) {
    const provider = diagnoseProviderResponse(providerResponseError(providerIssue, 'inspection'));
    return { stage: safeStage, code, recovery: `${provider.problem} ${provider.steps}` };
  }
  const safeCode = guidance.has(code) ? code : 'unknown';
  return { stage: safeStage, code: safeCode, recovery: guidance.get(safeCode),
    ...(safeCode === 'cached_vectors_incomplete' ? incompleteCoverage(read(failure, 'coverage')) : {}) };
}
