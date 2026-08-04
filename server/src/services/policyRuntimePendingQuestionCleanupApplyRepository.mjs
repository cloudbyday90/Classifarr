/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_AUDIT_TABLE =
  'policy_runtime_pending_question_cleanup_audits';
const FRESH_RUNTIME_EVALUATION_PENDING_REASON =
  'policy_runtime_pending_question_cleanup_fresh_runtime_evaluation';

function requireTransactionClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Pending-question cleanup apply requires a transaction client.');
  }
}

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

async function lockPendingQuestionCleanupClassification({ client, classificationId } = {}) {
  requireTransactionClient(client);
  const result = await client.query(
    `SELECT
       ch.id,
       ch.status,
       ch.title,
       ch.year,
       ch.media_type,
       ch.library_id,
       ch.library_name,
       ch.policy_question,
       ch.metadata,
       ch.clarification_response
     FROM classification_history AS ch
     WHERE ch.id = $1
     FOR UPDATE`,
    [classificationId],
  );

  return firstRow(result);
}

async function queuePendingQuestionCleanupFreshRuntimeEvaluation({
  client,
  classificationId,
} = {}) {
  requireTransactionClient(client);
  await client.query(
    'DELETE FROM clarification_responses WHERE classification_id = $1',
    [classificationId],
  );
  await client.query(
    `UPDATE classification_history
     SET status = 'pending_retry',
         policy_question = NULL,
         clarification_response = NULL,
         pending_reason = $2,
         retry_after = NOW(),
         retry_count = 0,
         max_retries = GREATEST(COALESCE(max_retries, 3), 1)
     WHERE id = $1`,
    [classificationId, FRESH_RUNTIME_EVALUATION_PENDING_REASON],
  );
}

async function insertPendingQuestionCleanupAuditRecord({
  client,
  classificationId,
  actionId,
  reasonIds,
  sourceVersion,
  actorId,
  resultStatusId,
  replayReceipt,
} = {}) {
  requireTransactionClient(client);
  const result = await client.query(
    `INSERT INTO ${POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_AUDIT_TABLE} (
       classification_id,
       action_id,
       reason_ids,
       source_version,
       actor_id,
       result_status_id,
       replay_receipt
     )
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::uuid)
     RETURNING id, replay_receipt, created_at`,
    [
      classificationId,
      actionId,
      JSON.stringify(reasonIds),
      sourceVersion,
      actorId,
      resultStatusId,
      replayReceipt,
    ],
  );

  return firstRow(result);
}

export {
  FRESH_RUNTIME_EVALUATION_PENDING_REASON,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_AUDIT_TABLE,
  insertPendingQuestionCleanupAuditRecord,
  lockPendingQuestionCleanupClassification,
  queuePendingQuestionCleanupFreshRuntimeEvaluation,
};
