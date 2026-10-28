/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export async function pruneFeedbackReviewReferences(client) {
  return client.query(`DELETE FROM feedback_review_references WHERE id IN (
    SELECT id FROM feedback_review_references WHERE expires_at<=clock_timestamp()
    ORDER BY expires_at,id LIMIT 1000 FOR UPDATE SKIP LOCKED)`);
}
export async function resetFeedbackReviewReferences(client) {
  await client.query('DELETE FROM feedback_review_references');
}
