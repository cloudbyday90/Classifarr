/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { diagnoseProviderResponse, providerResponseError } from './providerResponseDiagnosis.mjs';

export const DESCRIPTION_ISOLATION_CODES = Object.freeze(['http_rejected', 'batch', 'shape', 'dimensions', 'nonfinite', 'float32', 'zero']);

/** Call only around embedding receipt/validation, never database or admission work. */
export function markDescriptionInputFailure(error) {
  const diagnosis = diagnoseProviderResponse(error);
  if (diagnosis.phase !== 'embedding' || !DESCRIPTION_ISOLATION_CODES.includes(diagnosis.code)) return error;
  return Object.assign(providerResponseError(diagnosis.code, 'embedding'), { descriptionInputIssue: diagnosis.code });
}

export function descriptionIsolationCode(error) {
  try {
    const code = error?.descriptionInputIssue;
    return DESCRIPTION_ISOLATION_CODES.includes(code) ? code : null;
  } catch { return null; }
}

/** Eight calls total; fresh work and oldest due singleton retries share that budget. */
export function planDescriptionBackfill(pending, journal, priority = []) {
  const pendingSet = new Set(pending);
  const preferred = [...new Set(priority)].filter(hash => pendingSet.has(hash) && !journal.has(hash));
  const preferredSet = new Set(preferred);
  const ordinary = pending.filter(hash => !journal.has(hash) && !preferredSet.has(hash));
  // Reserve half of fresh capacity for ordinary work; borrow unused capacity both ways.
  const fresh = [];
  for (let offset = 0; offset < Math.max(preferred.length, ordinary.length); offset += 4) {
    fresh.push(...preferred.slice(offset, offset + 4), ...ordinary.slice(offset, offset + 4));
  }
  const due = [...journal].filter(([, state]) => state.due).map(([hash]) => hash);
  const plan = [];
  let freshOffset = 0, dueOffset = 0;
  for (let slot = 0; slot < 8; slot++) {
    if (dueOffset < due.length && (slot % 4 === 1 || freshOffset >= fresh.length)) {
      plan.push([due[dueOffset++]]);
    } else if (freshOffset < fresh.length) {
      plan.push(fresh.slice(freshOffset, freshOffset + 8)); freshOffset += 8;
    } else break;
  }
  return plan;
}

export function descriptionIsolationDelay(attempts, random = Math.random) {
  if (!Number.isInteger(attempts) || attempts < 0 || attempts > 7) throw new Error('description_isolation_attempts_invalid');
  const base = Math.min(3_600_000, 60_000 * 2 ** Math.max(0, attempts - 1));
  const sample = random();
  return Math.min(3_600_000, base + Math.floor(base * 0.25 * (Number.isFinite(sample) ? Math.min(1, Math.max(0, sample)) : 0)));
}
