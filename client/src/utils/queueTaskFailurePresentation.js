/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const MESSAGES = Object.freeze({
  task_metadata_not_found: 'TMDb could not find the saved movie or series ID. Eligible tasks are rechecked automatically. Use Check saved TMDb ID for current details; replacing an ID requires verified evidence.',
  task_metadata_fetch_failed: 'Metadata could not be fetched. Check TMDb availability and the item’s ID before retrying. For older failures, the original cause may no longer be available in the logs.',
  task_retry_lineage_refused: 'This retry stopped because Classifarr could not verify its original links or saved result.',
})

const RETRY_LINEAGE_DETAILS = Object.freeze({
  proof_unavailable: 'Classifarr could not verify the saved record of the retry’s original links.',
  source_relationship: 'Classifarr could not verify that the original classification still pointed to this retry.',
  item_identity: 'Classifarr could not verify that the retry and its saved record referred to the same item.',
  media_request_links: 'Classifarr could not verify the original media request links during this retry.',
  webhook_links: 'Classifarr could not verify the original webhook links during this retry.',
})

export function queueTaskFailureMessage(reason) {
  return typeof reason === 'string' && Object.hasOwn(MESSAGES, reason) ? MESSAGES[reason] : null
}

export function canRetryTask(task) {
  return !task.payload?.identity_repair && task.error_message !== 'task_retry_lineage_refused'
}

export function retryLineageFailureDetail(task) {
  if (task.task_type !== 'classification' || task.error_message !== 'task_retry_lineage_refused') return null
  const category = task.retry_lineage_refusal_category
  return typeof category === 'string' && Object.hasOwn(RETRY_LINEAGE_DETAILS, category)
    ? RETRY_LINEAGE_DETAILS[category]
    : null
}
