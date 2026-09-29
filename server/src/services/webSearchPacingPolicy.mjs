/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const WEB_SEARCH_MAX_WAIT_SECONDS = 30 * 86400;
const HTTP_DATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

function header(headers, name) {
  const value = typeof headers?.get === 'function' ? headers.get(name)
    : headers?.[Object.keys(headers ?? {}).find(key => key.toLowerCase() === name)];
  return typeof value === 'string' && value.length <= 256 ? value.trim() : '';
}
function numbers(value) {
  const parts = value.split(',').map(part => part.trim());
  return parts.length <= 8 && parts.every(part => /^\d{1,10}$/.test(part)) ? parts.map(Number) : [];
}

/** Untrusted HTTP input becomes a bounded delay only; no raw metadata escapes. */
export function webSearchPacingDelay(provider, response, now = Date.now()) {
  const headers = response?.headers;
  const retry = header(headers, 'retry-after');
  let delay = /^\d{1,10}$/.test(retry) ? Number(retry)
    : HTTP_DATE.test(retry) ? Math.max(0, Math.ceil((Date.parse(retry) - now) / 1000)) : 0;
  if (!Number.isFinite(delay)) delay = 0;
  if (provider === 'brave') {
    const limits = numbers(header(headers, 'x-ratelimit-limit'));
    const remaining = numbers(header(headers, 'x-ratelimit-remaining'));
    const resets = numbers(header(headers, 'x-ratelimit-reset'));
    if (limits.length && limits.length === remaining.length && limits.length === resets.length) {
      for (let index = 0; index < limits.length; index += 1) {
        if (limits[index] > 0 && remaining[index] === 0) delay = Math.max(delay, resets[index]);
      }
    }
  }
  if (response?.status === 429 && delay === 0) delay = 60;
  return Math.min(WEB_SEARCH_MAX_WAIT_SECONDS, delay);
}

export async function observeWebSearchPacing(provider, response, observer) {
  if (typeof observer !== 'function') return;
  const delay = webSearchPacingDelay(provider, response);
  if (!delay) return;
  try { await observer(delay); } catch { /* Base admission remains durable; never retry HTTP here. */ }
}
