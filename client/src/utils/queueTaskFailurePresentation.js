/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const MESSAGES = Object.freeze({
  task_metadata_not_found: 'TMDb could not find this item’s movie or series record. Verify the TMDb ID; retry only if that same record is available again. If the ID needs replacing, open a GitHub issue with this task reference. A similar title is not proof of a replacement.',
  task_metadata_fetch_failed: 'Metadata could not be fetched. Check TMDb availability and the item’s ID before retrying. For older failures, the original cause may no longer be available in the logs.',
})

export function queueTaskFailureMessage(reason) {
  return typeof reason === 'string' && Object.hasOwn(MESSAGES, reason) ? MESSAGES[reason] : null
}
