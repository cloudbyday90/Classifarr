/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const MESSAGES = Object.freeze({
  task_metadata_not_found: 'TMDb could not find the saved movie or series ID. Eligible tasks are rechecked automatically. Use Check saved TMDb ID for current details; replacing an ID requires verified evidence.',
  task_metadata_fetch_failed: 'Metadata could not be fetched. Check TMDb availability and the item’s ID before retrying. For older failures, the original cause may no longer be available in the logs.',
})

export function queueTaskFailureMessage(reason) {
  return typeof reason === 'string' && Object.hasOwn(MESSAGES, reason) ? MESSAGES[reason] : null
}
