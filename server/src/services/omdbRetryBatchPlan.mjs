/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readEnrichmentRetryPage } from './enrichmentRetryCandidates.mjs';
import { readOmdbQuota } from './omdbQuotaStore.mjs';
import { readOmdbPacingReadiness } from './omdbPacingStore.mjs';

/** Scheduling hints only. Claims and per-request quota reservations remain authoritative. */
export async function prepareOmdbRetryBatch({ db, logger, scheduleProcessing, isRetryWakeCurrent = () => true }, limit) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError('invalid_retry_limit');
  const size = Math.min(limit, 50);
  const items = await readEnrichmentRetryPage(db, 'omdb', null, size);
  let index = 0, waiting = false, finished = false;
  let waitSeconds = 0;
  return {
    get waiting() { return waiting; },
    async next() {
      if (finished || waiting || !isRetryWakeCurrent() || index >= items.length) return null;
      // No quota read for empty/ineligible queues; no cached dashboard authority.
      let status;
      try {
        status = (await readOmdbQuota(db)).status;
        if (status === 'available') {
          waitSeconds = (await readOmdbPacingReadiness(db)).wait;
          if (waitSeconds > 0) status = 'paced';
        }
      }
      catch { status = 'quota_observation_unavailable'; }
      if (!isRetryWakeCurrent()) return null;
      if (status !== 'available') {
        waiting = true;
        logger.debug('OMDb retries waiting before claim', { reason: status });
        return null;
      }
      return items[index++].queue_id;
    },
    finish() {
      if (finished) return;
      finished = true;
      // The existing minute scheduler rechecks blocked work, including after restart.
      // Use the existing coalesced wake, never a new per-item timer or cursor.
      if (isRetryWakeCurrent() && waiting && waitSeconds > 0) scheduleProcessing(waitSeconds * 1000);
      if (isRetryWakeCurrent() && !waiting && index === size) scheduleProcessing(1000);
    },
  };
}
