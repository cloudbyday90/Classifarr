/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { safeParseJsonObject } from '../utils/classificationRetryPayloads.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';

/** Called only on a new resolution, inside its existing transaction. Never on answer replay. */
export async function captureRuntimeOutcomeEvaluationTime(client) {
  const clock = (await client.query('SELECT transaction_timestamp() AS evaluation_observed_at'))?.rows?.[0]?.evaluation_observed_at;
  return clock instanceof Date && Number.isFinite(clock.getTime()) ? clock.toISOString() : null;
}

/** A later learning receipt cannot reset the resolution's evaluation age. */
export function readRuntimeOutcomeEvaluationTime(classification, resolution) {
  const answer = safeParseJsonObject(classification.metadata).classification_details?.outcome_link?.runtime_question_answer;
  const value = answer?.evaluation_observed_at;
  const now = classification.evaluation_now;
  if (answer?.contract_fingerprint !== resolution.contractFingerprint || answer?.action_id !== resolution.actionId ||
      answer?.contract_version !== resolution.contractVersion ||
      positiveDatabaseInteger(answer?.destination_library_id) === null ||
      positiveDatabaseInteger(answer?.destination_library_id) !== positiveDatabaseInteger(resolution.finalDestinationLibraryId) ||
      typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) return null;
  const observed = new Date(value);
  if (!Number.isFinite(observed.getTime()) || observed.toISOString() !== value ||
      observed > now || now.getTime() - observed.getTime() >= 30 * 86400000) return null;
  return value;
}
