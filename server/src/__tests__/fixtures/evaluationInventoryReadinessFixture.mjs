/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { EVALUATION_INVENTORY_READINESS_SQL } from '../../services/evaluationInventoryReadiness.mjs';

export const inventoryProgressFixture = () => ({ completedImports: 10, notStarted: 1, scanning: 2,
  completedHandoffs: 7, dueTasks: 0, processingTasks: 0, latestCheckpointAt: '2026-10-09T11:55:00Z' });
export function evaluationInventoryQueryFixture(sql) {
  if (sql === EVALUATION_INVENTORY_READINESS_SQL) return [{ readiness: 'backfilling', ...inventoryProgressFixture() }];
  return [];
}
