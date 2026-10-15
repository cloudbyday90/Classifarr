/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { validateGatewayTaskSource } from '../ollamaGateway/taskSource.mjs';

const scope = new AsyncLocalStorage();

function taskSource(task) {
  try {
    const id = typeof task?.id === 'number' && Number.isSafeInteger(task.id) ? String(task.id) : task?.id;
    return validateGatewayTaskSource({ version: 1,kind: 'queue_task',taskId: id,
      taskType: task?.task_type,attempt: task?.attempts });
  } catch { return null; } // Diagnostics must not break otherwise processable legacy work.
}

export function getOllamaTaskSource() {
  const current = scope.getStore();
  return current?.active ? current.source : null;
}

/** No payload fields, HTTP headers or claim tokens enter this diagnostic context. */
export async function runOllamaTaskScope(task,callback) {
  const current = { source: taskSource(task),active: true };
  try { return await scope.run(current,callback); }
  finally { current.active = false; }
}
