/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inspectRuntimeMemory } from './runtimeMemoryBudget.mjs';
import { INVENTORY_MAINTENANCE_IDLE_SQL } from './inventoryBackgroundReadiness.mjs';

const MIB = 1024 * 1024;
const baseline = Object.freeze({ status: 'admitted', workMemMiB: 64 });

/** Only trusted colocated-worker composition supplies readMemory, never a task payload. */
export async function admitImageIndexCapacity(query, task, plan, readMemory) {
  if (!readMemory || !plan.some(({ index, action }) => index.accessMethod === 'hnsw' && action !== 'preserve')) return baseline;
  const row = (await query(`SELECT count(*)::integer AS vector_count FROM
    (SELECT 1 FROM public.classification_embeddings WHERE image_embedding IS NOT NULL LIMIT 10001) AS cohort`)).rows[0];
  if (!Number.isInteger(row?.vector_count) || row.vector_count < 0 || row.vector_count > 10001) {
    return { status: 'deferred', reason: 'image_index_capacity_unknown' };
  }
  if (row.vector_count <= 10000) return baseline;
  const readiness = (await query(INVENTORY_MAINTENANCE_IDLE_SQL, [task.id])).rows[0]?.readiness;
  if (readiness !== 'ready') return { status: 'deferred', reason: 'image_index_background_busy' };
  let memory;
  try { memory = inspectRuntimeMemory(readMemory()); } catch { /* Unknown headroom never grants a larger workspace. */ }
  if (!memory) return { status: 'deferred', reason: 'image_index_memory_unknown' };
  if (memory.available < (512 + 256) * MIB + memory.reserve) {
    return { status: 'deferred', reason: 'image_index_memory_pressure' };
  }
  return { status: 'admitted', workMemMiB: 512 };
}
