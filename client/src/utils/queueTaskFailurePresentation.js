/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const MESSAGES = Object.freeze({
  task_metadata_not_found: 'TMDb could not find the saved movie or series ID. Eligible tasks are rechecked automatically. Use Check saved TMDb ID for current details; replacing an ID requires verified evidence.',
  task_metadata_fetch_failed: 'Metadata could not be fetched. Check TMDb availability and the item’s ID before retrying. For older failures, the original cause may no longer be available in the logs.',
  task_retry_lineage_refused: 'This retry stopped because Classifarr could not verify its original request or webhook links. The links were left as found.',
})

export function queueTaskFailureMessage(reason) {
  return typeof reason === 'string' && Object.hasOwn(MESSAGES, reason) ? MESSAGES[reason] : null
}

export function canRetryTask(task) {
  return !task.payload?.identity_repair && task.error_message !== 'task_retry_lineage_refused'
}
