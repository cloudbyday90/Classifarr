/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CONSENSUS_ROUTE_METHOD } from './policyCandidateConsensusReceipt.mjs';

/** An expired grant must return to the normal review queue, not look completed. */
export async function restoreConsensusReview({ classificationId, metadata, result }, { db, ensureDecisionQuestion }) {
  if (result?.method !== CONSENSUS_ROUTE_METHOD || result.needs_clarification) return;
  result.needs_clarification = true;
  await ensureDecisionQuestion({ metadata, result, policyResult: result.policyResult,
    libraries: result.libraries || [], ragContext: result.ragContext || null });
  if (!classificationId) return;
  await db.query(`
    UPDATE classification_history
    SET status = 'awaiting_decision', library_id = NULL, library_name = NULL,
        pending_reason = $1, policy_question = $2::jsonb
    WHERE id = $3 AND method = $4 AND status = 'completed'
  `, [result.pending_reason || 'Fresh comparison required',
    JSON.stringify(result.policy_question || result.clarification || null), classificationId, CONSENSUS_ROUTE_METHOD]);
}
