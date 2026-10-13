/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function queueIdentityRepairError(action, status, code) {
  if (status === 403) return 'An active administrator session is required.'
  if (status === 429) return 'Wait a minute before checking again.'
  if (status === 409 && code === 'queue_identity_repair_unsupported') {
    return 'This request format cannot be repaired safely here. Open a GitHub issue with the task reference and saved-ID check details; do not replace IDs by hand.'
  }
  if (status === 409 && code === 'queue_identity_repair_budget') {
    return 'This task has no eligible repair retry budget. Review its failed attempts; do not reset the counter. Open a GitHub issue if the failure needs a new recovery path.'
  }
  if (status === 409 && code === 'queue_identity_repair_prior_work') {
    return 'Another task or a classification decision already covers one of these IDs. Check Queue and History before taking further action; this repair cannot replay that work.'
  }
  if (action === 'confirm' || action === 'retry') {
    return 'The action was not confirmed here. Check saved repair before doing anything else; a lost response may still have committed.'
  }
  if (status === 409) return 'No current repair can be reviewed. Evidence may be missing, expired or changed, or other work is already recorded. Check the saved TMDb ID for details.'
  return 'The repair check is unavailable. No outcome can be assumed; try checking the saved repair again.'
}
