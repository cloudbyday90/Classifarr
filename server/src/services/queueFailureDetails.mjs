/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {
  isRetryLineageSource, normalizeRetryLineageRefusalCategory, RETRY_LINEAGE_REFUSED,
} from './classificationRetryLineageContract.mjs';

export function projectFailedQueueTask({
  retry_lineage_refusal_category: stored,
  retry_lineage_replacement_saved: replacementSaved,
  ...task
}) {
  if (task.status !== 'failed' || task.task_type !== 'classification' || task.error_message !== RETRY_LINEAGE_REFUSED) {
    return task;
  }
  const category = normalizeRetryLineageRefusalCategory(stored);
  if (category !== null) return { ...task, retry_lineage_refusal_category: category };
  if (stored == null && replacementSaved === true && isRetryLineageSource(task.source)) {
    return { ...task, retry_lineage_replacement_saved: true };
  }
  return task;
}
