/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readEnrichmentRetryPage } from './enrichmentRetryCandidates.mjs';

/** One bounded page per wake-up. Cursor is a hint; restart safely rescans from the head. */
export async function prepareEnrichmentRetryBatch(service, type, limit) {
  if (type === 'omdb' || typeof service.webSearchEnrichmentService.createRetryInspector !== 'function') return null;
  const state = service.retryScanState.get(type) ?? { cursor: null, waitUntil: Infinity };
  const wakeEpoch = service.retryWakeEpoch;
  const size = Math.min(limit, 50);
  const items = await readEnrichmentRetryPage(service.db, type, state.cursor, size);
  const inspect = items.length ? await service.webSearchEnrichmentService.createRetryInspector(items) : null;
  let index = 0, waitUntil = state.waitUntil, last = state.cursor;
  return {
    async next() {
      while (index < items.length) {
        const item = items[index++]; last = item;
        const result = await inspect(item);
        if (result.ready) return item.queue_id;
        const delay = Number.isFinite(result.delayMs) && result.delayMs > 0 ? result.delayMs : 300_000;
        waitUntil = Math.min(waitUntil, Date.now() + delay);
      }
      return null;
    },
    finish() {
      if (wakeEpoch !== service.retryWakeEpoch) return;
      if (items.length && (index < items.length || items.length === size)) {
        service.retryScanState.set(type, { cursor: last, waitUntil });
        service.scheduleProcessing(1000);
      } else {
        service.retryScanState.delete(type);
        if (Number.isFinite(waitUntil)) service.scheduleProcessing(Math.max(1000, waitUntil - Date.now()));
      }
    },
  };
}
