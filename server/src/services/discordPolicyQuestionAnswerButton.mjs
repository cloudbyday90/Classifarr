/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeDatabaseBigintId, parseCanonicalDatabaseInt32Id } from './databaseIntegerValues.mjs';
import {
  getPolicyRuntimeQuestionAnswerActionIdFromCode,
  POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION,
} from './policyRuntimeQuestionAnswerContract.mjs';

// The fingerprint is the final field and may itself contain underscores.
const ANSWER_BUTTON = /^ai_answer_([1-9][0-9]{0,18})_([a-z])_([1-9][0-9]{0,9})_([A-Za-z0-9_-]{22})$/;

export function parseDiscordPolicyQuestionAnswerButton(customId) {
  if (typeof customId !== 'string') return null;
  const match = ANSWER_BUTTON.exec(customId);
  if (!match || match[0] !== customId) return null;

  const [, historyId, actionCode, libraryId, contractFingerprint] = match;
  const classificationId = normalizeDatabaseBigintId(historyId);
  const destinationLibraryId = parseCanonicalDatabaseInt32Id(libraryId);
  const actionId = getPolicyRuntimeQuestionAnswerActionIdFromCode(actionCode);
  if (classificationId === null || destinationLibraryId === null || !actionId) return null;

  return { classificationId, destinationLibraryId, actionId, contractFingerprint,
    contractVersion: POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION };
}
