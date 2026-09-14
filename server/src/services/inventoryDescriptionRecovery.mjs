/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { diagnoseProviderResponse } from './providerResponseDiagnosis.mjs';

const MAX_DELAY_MS = 3_600_000;
const REMINDER_MS = 1_800_000;
const MAX_COUNT = 1_000_000;

/** Scheduling and diagnostics only. The existing cache is the durable work checkpoint. */
export function createInventoryDescriptionRecovery({ log, now = Date.now, random = Math.random } = {}) {
  let failures = 0, retryAt = 0;
  const issues = new Map();
  const emit = (level, message, data) => {
    try { Promise.resolve(log?.[level]?.(message, data)).catch(() => {}); } // swallow-error: Logging must not interrupt backfill or recursively log its own failure.
    catch { /* A synchronous logger failure must not interrupt backfill. */ }
  };
  const record = (diagnosis, delay, affectedDescriptions = 0) => {
    const time = now();
    const entry = issues.get(diagnosis.code) ?? { count: 0, reportedAt: null, committed: 0 };
    entry.count = Math.min(MAX_COUNT, entry.count + 1);
    issues.set(diagnosis.code, entry);
    if (entry.reportedAt === null || time - entry.reportedAt >= REMINDER_MS) {
      entry.reportedAt = time;
      const { slowRetry: _slowRetry, ...details } = diagnosis;
      emit('warn', 'Description provider data unavailable; automatic backfill scheduled', {
        ...details, occurrences: entry.count, retryAfterSeconds: Math.ceil(delay / 1000), affectedDescriptions,
        recovery: affectedDescriptions
          ? 'Retry affected descriptions individually when due; a failed batch does not identify the culprit. Other eligible work can continue unless provider-wide failures pause the worker. Only validated data is saved.'
          : 'Keep completed cache entries. Recheck the local model and retry missing current descriptions when due and foreground work is idle. Only validated batches are saved.',
        routingAffected: false,
      });
    }
  };
  return {
    isCoolingDown: () => now() < retryAt,
    failed(error) {
      const diagnosis = diagnoseProviderResponse(error);
      failures = Math.min(7, failures + 1);
      const base = diagnosis.slowRetry ? MAX_DELAY_MS : Math.min(MAX_DELAY_MS, 60_000 * 2 ** (failures - 1));
      const sample = random();
      const jitter = Number.isFinite(sample) ? Math.min(1, Math.max(0, sample)) : 0;
      const delay = Math.min(MAX_DELAY_MS, base + Math.floor(base * 0.25 * jitter));
      retryAt = now() + delay;
      record(diagnosis, delay);
      return { failureCode: diagnosis.code, retryAfterSeconds: Math.ceil(delay / 1000) };
    },
    isolated(error, count, delayMs) {
      if (!Number.isInteger(count) || count < 1 || count > 8 || !Number.isInteger(delayMs) || delayMs < 60_000 || delayMs > MAX_DELAY_MS) return;
      record(diagnoseProviderResponse(error), delayMs, count);
    },
    committed(count) {
      if (!Number.isSafeInteger(count) || count <= 0 || count > 8) return;
      for (const entry of issues.values()) entry.committed = Math.min(MAX_COUNT, entry.committed + count);
    },
    completed() {
      failures = 0; retryAt = 0;
      for (const [code, entry] of issues) emit('info', 'Description backfill caught up', {
        code, occurrences: entry.count, validatedDescriptionsCommitted: entry.committed,
        recovery: entry.committed > 0
          ? 'Validated descriptions were saved after model revalidation. All currently eligible descriptions are cached.'
          : 'All currently eligible descriptions are cached. No new provider response was validated by this recovery episode; the backlog or cache may have changed.',
        routingAffected: false,
      });
      issues.clear();
    },
  };
}
