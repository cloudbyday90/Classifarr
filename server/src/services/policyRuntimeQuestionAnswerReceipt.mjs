/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeDatabaseBigintId } from './databaseIntegerValues.mjs';
import { buildPolicyRuntimeQuestionAnswerOutcome } from './policyRuntimeQuestionAnswerContract.mjs';

export function buildPolicyRuntimeQuestionAnswerReceipt(classificationId, answer) {
  const id = normalizeDatabaseBigintId(classificationId);
  if (id === null) throw new TypeError('Runtime answer receipt requires an exact History ID.');

  return { ...buildPolicyRuntimeQuestionAnswerOutcome(answer), classification_id: id };
}

export function isPolicyRuntimeQuestionAnswerReceiptForClassification(receipt, classificationId) {
  const id = normalizeDatabaseBigintId(classificationId);
  if (id === null || !receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;

  if (!Object.hasOwn(receipt, 'classification_id')) return typeof id === 'number';

  return normalizeDatabaseBigintId(receipt.classification_id) === id;
}
