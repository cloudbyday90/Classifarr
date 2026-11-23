/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { MAX_COHORT_ROWS } from './feedbackAnalysisCohortContract.mjs';

export const SUGGESTION_ANALYSIS_SUMMARY_FORMAT = 'summary-v1';
export const SUGGESTION_ANALYSIS_INSUFFICIENT_FEEDBACK = 'Insufficient feedback for meaningful analysis';
const POLICY_BATCH_SIZE = 24;
const MAX_SUMMARY_BYTES = 4096;

function unconfirmed(policyId) {
  return { policyId, status: 'unconfirmed', feedbackCount: null, suggestionsCreated: null };
}

function summarizePolicy(policyId, result) {
  if (result?.policyId !== policyId || !Number.isInteger(result.feedbackCount) || result.feedbackCount < 0 ||
      result.feedbackCount > MAX_COHORT_ROWS || !Array.isArray(result.suggestions)) {
    return unconfirmed(policyId);
  }

  const { feedbackCount } = result;
  const suggestionsCreated = result.suggestions.length;
  if (result.analysis && typeof result.analysis === 'object' && !Array.isArray(result.analysis)) {
    return { policyId, status: 'completed', feedbackCount, suggestionsCreated };
  }
  if (result.analysis === undefined && suggestionsCreated === 0 && result.message === SUGGESTION_ANALYSIS_INSUFFICIENT_FEEDBACK) {
    return { policyId, status: 'insufficient_feedback', feedbackCount, suggestionsCreated };
  }
  return unconfirmed(policyId);
}

export async function runManualSuggestionAnalysisSummary(db, analyzePolicy, afterPolicyId) {
  const { rows } = await db.query(`SELECT id FROM library_policies
    WHERE enabled IS TRUE AND id > $1 ORDER BY id LIMIT $2`, [afterPolicyId, POLICY_BATCH_SIZE + 1]);
  const results = [];
  const counts = { completed: 0, insufficient_feedback: 0, unconfirmed: 0 };

  for (const { id } of rows.slice(0, POLICY_BATCH_SIZE)) {
    let outcome;
    try {
      outcome = summarizePolicy(id, await analyzePolicy(id));
    } catch {
      // A rejected operation can include a lost commit acknowledgement.
      outcome = unconfirmed(id);
    }
    counts[outcome.status]++;
    results.push(outcome);
  }

  return {
    format: SUGGESTION_ANALYSIS_SUMMARY_FORMAT,
    policiesAttempted: results.length,
    counts,
    nextAfterPolicyId: rows.length > POLICY_BATCH_SIZE ? results.at(-1).policyId : null,
    results,
  };
}

export function serializeSuggestionAnalysisSummary(result) {
  const body = JSON.stringify({ success: true, ...result });
  if (Buffer.byteLength(body) > MAX_SUMMARY_BYTES) throw new Error('Suggestion analysis summary exceeded its response limit');
  return body;
}
