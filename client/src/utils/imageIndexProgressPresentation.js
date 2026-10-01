/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const reasons = {
  disabled: ['Image search is off.', 'No repair is needed while image search is off.'],
  not_configured: ['Image search has no configured provider.', 'Configure an image embedding provider in Settings.'],
  schema_unavailable: ['Required database objects are unavailable.', 'Review database startup and migration errors in Logs.'],
  restore_verification_required: ['Restore verification has not finished.', 'Complete restore verification before maintenance resumes.'],
  definition_mismatch: ['An index does not match the expected definition.', 'Review image-index maintenance errors in Logs; do not force a rebuild.'],
  repair_unverified: ['The previous repair could not be verified.', 'Review image-index maintenance errors in Logs; keep the retry limit unchanged.'],
  attempt_limit: ['Automatic repair needs review.', 'Review image-index maintenance errors in Logs; keep the retry limit unchanged.'],
  worker_claimed: ['A worker has claimed the repair; no live build was observed.', 'Refresh this snapshot to check for a build or verification.'],
  claim_recovery: ['The previous worker claim has expired.', 'Allow the queue to reclaim the job, then refresh.'],
  cooldown: ['Automatic repair is cooling down.', 'Wait until the earliest eligibility time, then refresh.'],
  queue_delay: ['The queued repair is waiting for its retry time.', 'Allow the queued retry to become due, then refresh.'],
  queued: ['Repair is queued.', 'Let the worker run, then refresh to verify the result.'],
  awaiting_check: ['Repair is needed; no active job was observed.', 'Allow the scheduled maintenance check to queue a repair, then refresh.'],
  waiting_for_libraries: ['No active movie or TV library is ready.', 'Configure an active movie or TV library.'],
  waiting_for_inventory: ['Media inventory has not arrived yet.', 'Let the first library import finish.'],
  ingesting: ['Library import is incomplete.', 'Check library import progress; resolve blocked imports first.'],
  backfilling: ['Backfill or other queued work takes priority.', 'Let background work finish before checking again.'],
  waiting_for_database: ['A live index build is waiting for database transactions.', 'Let the bounded worker finish, then refresh.'],
  validating: ['PostgreSQL is validating an index.', 'Let validation finish, then refresh.'],
  building: ['PostgreSQL is building an index.', 'Let the bounded worker finish, then refresh.'],
  healthy: ['All three index definitions and readiness flags match.', 'No action needed.'],
}
const states = {
  waiting: ['Waiting', 'text-amber-200'], running: ['Running', 'text-sky-200'],
  verified: ['Verified', 'text-emerald-200'], needs_review: ['Needs review', 'text-amber-200'],
  not_needed: ['Not needed', 'text-gray-200'],
}
export const imageIndexLabels = {
  idx_embeddings_image_hnsw: 'Similarity search',
  idx_embeddings_image_present: 'Image lookup',
  idx_embeddings_image_hash: 'Duplicate lookup',
}
export function presentImageIndexProgress(report) {
  const [label, color] = states[report?.status] || ['Unavailable', 'text-gray-200']
  const [description, action] = reasons[report?.reason] ||
    ['Repair status could not be checked.', 'Refresh this snapshot; if unavailable again, review database health.']
  return { label, color, description, action }
}
