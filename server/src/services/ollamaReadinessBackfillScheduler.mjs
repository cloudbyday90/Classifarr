/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createOllamaReadinessBackfill } from './ollamaReadinessBackfill.mjs';

export const OLLAMA_READINESS_BACKFILL_TASK = 'ollama-readiness-backfill';
export function registerOllamaReadinessBackfillSchedule(scheduler, { worker = createOllamaReadinessBackfill() } = {}) {
  scheduler.ollamaReadinessBackfillWorker?.stop();
  scheduler.ollamaReadinessBackfillWorker = worker;
  const run = async () => {
    const result = await worker.run();
    if (result.status === 'failed') throw new Error('ollama_readiness_backfill_unavailable');
    return result;
  };
  // Avoid the usual second 0/30/45 discovery starts without bypassing admission.
  scheduler.schedule(OLLAMA_READINESS_BACKFILL_TASK, '17 * * * * *', run, null,
    { noOverlap: true, maxRandomDelay: 10000, quiet: true });
  scheduler.scheduleInitial(OLLAMA_READINESS_BACKFILL_TASK, 120000, run);
}
