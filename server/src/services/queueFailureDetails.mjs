/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeRetryLineageRefusalCategory, RETRY_LINEAGE_REFUSED } from './classificationRetryLineageContract.mjs';

export function projectFailedQueueTask({ retry_lineage_refusal_category: stored, ...task }) {
  if (task.status !== 'failed' || task.task_type !== 'classification' || task.error_message !== RETRY_LINEAGE_REFUSED) {
    return task;
  }
  const category = normalizeRetryLineageRefusalCategory(stored);
  return category === null ? task : { ...task, retry_lineage_refusal_category: category };
}
