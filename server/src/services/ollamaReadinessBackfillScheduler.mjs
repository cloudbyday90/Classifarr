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
  scheduler.schedule(OLLAMA_READINESS_BACKFILL_TASK, '*/5 * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial(OLLAMA_READINESS_BACKFILL_TASK, 120000, run);
}
