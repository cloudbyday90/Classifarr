/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { PURPOSE_OUTCOME_COHORT_SQL } from './purposeOutcomeCohortRepository.mjs';

/** Caller owns a read-only repeatable-read transaction. Shared by optional tooling and automatic evaluation. */
export async function readPurposeOutcomeSnapshotInput(client, signal) {
  signal?.throwIfAborted();
  await client.query("SET LOCAL statement_timeout='12s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='15s'; SET LOCAL TIME ZONE 'UTC'");
  const clock = (await client.query("SELECT date_trunc('milliseconds',transaction_timestamp()) AS observed_at")).rows[0]?.observed_at;
  const observedAt = clock instanceof Date ? clock.toISOString() : clock, now = Date.parse(observedAt);
  if (!Number.isFinite(now)) throw new Error('purpose_cohort_invalid_clock');
  const window = { since: new Date(now - 30 * 86400000).toISOString(), until: observedAt };
  const result = await client.query(PURPOSE_OUTCOME_COHORT_SQL, [window.since, window.until]);
  const header = result.rows[0];
  if (!header || !Number.isSafeInteger(header.events) || header.events < 0 || !/^[0-9]{1,12}$/.test(header.payload_bytes) ||
      header.events > 5000 || Number(header.payload_bytes) > 67108864) throw new Error('purpose_cohort_input_budget');
  const rows = result.rows.filter(row => row.input !== null).map(row => row.input);
  if (rows.length !== header.events) throw new Error('purpose_cohort_invalid_input');
  signal?.throwIfAborted(); return { input: { rows, window, observedAt }, sourceBytes: Number(header.payload_bytes) };
}
