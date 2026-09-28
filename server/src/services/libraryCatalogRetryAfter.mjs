/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const MAX_SERVER_WAIT_MS = 7 * 24 * 60 * 60 * 1000;
const STANDARD_DATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;
const LEGACY_DATE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}:\d{2}:\d{2}) GMT$/;
const ASCTIME_DATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) {1,2}\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/;

function httpDate(text, now) {
  if (STANDARD_DATE.test(text)) return Date.parse(text);
  if (ASCTIME_DATE.test(text)) return Date.parse(`${text} GMT`);
  const legacy = LEGACY_DATE.exec(text);
  if (!legacy) return NaN;
  const currentYear = new Date(now).getUTCFullYear();
  let year = Math.floor(currentYear / 100) * 100 + Number(legacy[4]);
  if (year > currentYear + 50) year -= 100;
  return Date.parse(`${legacy[2]} ${legacy[3]} ${year} ${legacy[5]} GMT`);
}

/** Retain timing only. Excessive hints suspend automation, never shorten a wait. */
export function catalogRetryAfter(error, now = Date.now()) {
  const saved = error?.catalogRetryAfter;
  if (saved?.blocked === true) return { blocked: true };
  if (Number.isSafeInteger(saved?.delayMs) && saved.delayMs >= 0 && saved.delayMs <= MAX_SERVER_WAIT_MS) return { delayMs: saved.delayMs };
  if (![429, 503].includes(error?.response?.status)) return null;
  const value = error.response.headers?.['retry-after'];
  if (typeof value !== 'string') return null;
  if (value.length > 128) return { blocked: true };
  const text = value.trim();
  const milliseconds = /^\d+$/.test(text) ? Number(text) * 1000 : Math.max(0, httpDate(text, now) - now);
  if (milliseconds > MAX_SERVER_WAIT_MS) return { blocked: true };
  return Number.isSafeInteger(milliseconds) && milliseconds >= 0 ? { delayMs: milliseconds } : null;
}
