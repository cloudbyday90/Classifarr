/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readInventoryProspectiveSnapshot } from './inventoryProspectiveSnapshot.mjs';
import { buildInventoryDisagreementReport } from './inventoryDisagreementReport.mjs';

/** An explicit local read, not a background job or a saved report. */
export async function readInventoryDisagreements(runtime, { signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const stopSignals = ['SIGINT', 'SIGTERM'];
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  for (const name of stopSignals) process.once(name, abort);
  try {
    controller.signal.throwIfAborted();
    const snapshot = await runtime.withTransaction(async client => {
      controller.signal.throwIfAborted();
      await client.query("SET LOCAL statement_timeout='12s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='15s'; SET LOCAL TIME ZONE 'UTC'");
      const result = await readInventoryProspectiveSnapshot(client);
      controller.signal.throwIfAborted(); return result;
    }, { signal: controller.signal, readOnly: true, isolationLevel: 'repeatable_read', timeoutMs: 15000 });
    controller.signal.throwIfAborted();
    const report = buildInventoryDisagreementReport(snapshot.inputs);
    controller.signal.throwIfAborted(); return report;
  } finally {
    signal?.removeEventListener('abort', abort);
    for (const name of stopSignals) process.removeListener(name, abort);
  }
}
