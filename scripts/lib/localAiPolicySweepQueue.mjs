/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as sleep } from 'node:timers/promises';
import { validateClassificationQueueDecisionWitness } from '../../server/src/services/classificationQueueDecisionWitness.mjs';
import { normalizeDatabaseBigintId } from '../../server/src/services/databaseIntegerValues.mjs';

function isBoundWitness(result, queueTaskId) {
  if (result?.available !== true || normalizeDatabaseBigintId(result.queueTaskId) !== queueTaskId) {
    return false;
  }
  const classificationId = normalizeDatabaseBigintId(result.classificationId);
  return classificationId !== null && classificationId === normalizeDatabaseBigintId(result.history?.id) &&
    validateClassificationQueueDecisionWitness(result.decisionWitness, { queueTaskId }).ok;
}

export async function waitForQueueDecisionWitness(api, taskId, timeoutMs, pollMs) {
  const queueTaskId = normalizeDatabaseBigintId(taskId);
  if (queueTaskId === null) return null;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await api.requestJson(`/api/queue/tasks/${queueTaskId}/decision-witness`);
    if (isBoundWitness(result, queueTaskId)) return result;
    await sleep(pollMs);
  }
  return null;
}

export async function fetchQueueTaskSnapshot(api, taskId) {
  const queueTaskId = normalizeDatabaseBigintId(taskId);
  if (queueTaskId === null) return { status: null, source: null, error: null };

  try {
    const [pendingTasks, failedTasks] = await Promise.all([
      api.requestJson('/api/queue/pending?limit=100'),
      api.requestJson('/api/queue/failed?limit=100'),
    ]);
    const matchesTask = task => normalizeDatabaseBigintId(task?.id) === queueTaskId;
    const pendingMatch = Array.isArray(pendingTasks) ? pendingTasks.find(matchesTask) : null;
    if (pendingMatch) {
      return { status: pendingMatch.status || 'pending', source: 'task_queue', error: null };
    }
    const failedMatch = Array.isArray(failedTasks) ? failedTasks.find(matchesTask) : null;
    if (failedMatch) {
      return { status: failedMatch.status || 'failed', source: 'task_queue', error: failedMatch.error_message || null };
    }
    return { status: null, source: null, error: null };
  } catch (error) {
    return { status: null, source: 'task_queue', error: error.message };
  }
}
