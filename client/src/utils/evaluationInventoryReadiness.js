/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const inventoryReadinessText = Object.freeze({
  disabled: 'Evaluation is waiting for RAG to be enabled.',
  waiting_for_libraries: 'Evaluation is waiting for an active movie or TV library.',
  ingesting: 'Evaluation is waiting for library imports to finish. Check Libraries for import or recovery details.',
  waiting_for_inventory: 'Evaluation is waiting for imported movie or TV items.',
  backfilling: 'Evaluation is waiting for backfill scans or queued work.',
  ready: 'The inventory check passed. Other worker safeguards still apply.',
})
const keys = ['completedImports', 'notStarted', 'scanning', 'completedHandoffs', 'dueTasks', 'processingTasks']

export function normalizeEvaluationInventoryReadiness(value, checkedAt) {
  if (value?.version !== 'evaluation_inventory_readiness.v1' || !Object.hasOwn(inventoryReadinessText, value.status) ||
    !keys.every(key => Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 2147483647) ||
    value.notStarted + value.scanning + value.completedHandoffs !== value.completedImports ||
    !Number.isFinite(Date.parse(checkedAt)) || !(value.latestCheckpointAt === null ||
      typeof value.latestCheckpointAt === 'string' && Number.isFinite(Date.parse(value.latestCheckpointAt)) &&
      Date.parse(value.latestCheckpointAt) <= Date.parse(checkedAt) && value.scanning > 0) ||
    value.status === 'ready' && value.notStarted + value.scanning + value.dueTasks + value.processingTasks > 0) return null
  return { status: value.status, ...Object.fromEntries(keys.map(key => [key, value[key]])), latestCheckpointAt: value.latestCheckpointAt }
}
