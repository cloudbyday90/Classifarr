/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { deferOmdbPacing } from './omdbPacingStore.mjs';
import { omdbPacingDelay } from './omdbPacingPolicy.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('OmdbPacing');

/** A response observation never retries HTTP, rejects successful evidence or logs raw headers. */
export async function observeOmdbPacing(response, context, persist = deferOmdbPacing) {
  const delay = omdbPacingDelay(response);
  if (!delay) return 0;
  try { await persist(db, context, delay); }
  catch {
    logger.warn('OMDb shared wait could not be saved; base request pacing remains active', {}, {
      dedupeKey: 'omdb_pacing_observation_unavailable', dedupeWindowMs: 30 * 60 * 1000,
    });
  }
  return delay;
}
