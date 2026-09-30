/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ServiceUnavailableError } from '../utils/appError.mjs';

export const OMDB_MAX_WAIT_SECONDS = 30 * 86400;
const HTTP_DATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/** Only Retry-After has defined meaning here; never interpret arbitrary reset headers. */
export function omdbPacingDelay(response, now = Date.now()) {
  const headers = response?.headers;
  const raw = typeof headers?.get === 'function' ? headers.get('retry-after')
    : headers?.[Object.keys(headers ?? {}).find(key => key.toLowerCase() === 'retry-after')];
  const value = typeof raw === 'string' && raw.length <= 256 ? raw.trim() : '';
  let delay = /^\d{1,10}$/.test(value) ? Number(value)
    : HTTP_DATE.test(value) ? Math.max(0, Math.ceil((Date.parse(value) - now) / 1000)) : 0;
  if (!Number.isFinite(delay)) delay = 0;
  if (!delay && response?.status === 429) delay = 60;
  return Math.min(OMDB_MAX_WAIT_SECONDS, delay);
}

export class OmdbAdmissionWaitError extends ServiceUnavailableError {
  constructor(seconds) {
    super('OMDb requests are paced; retry when admission is available');
    this.code = 'OMDB_ADMISSION_WAIT';
    this.retryAfterSeconds = Number.isSafeInteger(seconds) && seconds > 0
      ? Math.min(seconds, OMDB_MAX_WAIT_SECONDS) : 1;
  }
}
