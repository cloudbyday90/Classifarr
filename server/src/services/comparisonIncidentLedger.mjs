/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes, randomUUID } from 'node:crypto';
import { createComparisonIncidentRepository, COMPARISON_WARNING, MAX_COMPARISON_INCIDENT_IDS } from './comparisonIncidentRepository.mjs';
import { sanitizeData } from '../utils/logging/sanitize.mjs';
import { getSystemContext } from '../utils/logging/requestContext.mjs';

/** All statements use the advisory-lock connection, never a pooled second session. */
export async function createComparisonIncidentLedger({ query, signal }, isCurrent) {
  const check = () => { signal.throwIfAborted(); if (!isCurrent()) throw new Error('Comparison incident owner changed'); };
  const transaction = async callback => {
    check();
    await query('BEGIN');
    try {
      await query("SET LOCAL statement_timeout = '3s'; SET LOCAL lock_timeout = '1s'; SET LOCAL transaction_timeout = '5s'");
      const result = await callback({ query });
      check(); await query('COMMIT'); return result;
    } catch (error) { try { await query('ROLLBACK'); } catch { /* Lost sessions cannot commit. */ } throw error; }
  };
  let ledger = await transaction(async () => (await query('SELECT * FROM comparison_incident_ledger WHERE singleton')).rows[0]);
  const secret = ledger?.secret ?? randomBytes(32);
  const save = async value => {
    await query(`INSERT INTO comparison_incident_ledger
      (singleton, secret, configuration, representation, scope_id, episode_id, error_ids)
      VALUES (true,$1,$2,$3,$4,$5,$6::uuid[])
      ON CONFLICT (singleton) DO UPDATE SET configuration=EXCLUDED.configuration,
        representation=EXCLUDED.representation, scope_id=EXCLUDED.scope_id,
        episode_id=EXCLUDED.episode_id, error_ids=EXCLUDED.error_ids`,
    [secret, value.configuration, value.representation, value.scope_id, value.episode_id, value.error_ids]);
  };
  const fresh = fingerprint => ({ ...fingerprint, scope_id: randomUUID(), episode_id: randomUUID(), error_ids: [] });
  let selected = null;
  return {
    secret,
    async prepare(fingerprint, disabled) {
      selected = null;
      if (disabled) {
        if (ledger) {
          // Retain the database key, but invalidate the old episode even if re-enabled unchanged.
          const value = fresh({ configuration: ledger.configuration, representation: null });
          await transaction(() => save(value)); ledger = value;
        }
        return;
      }
      if (!fingerprint) return;
      if (ledger && (ledger.configuration !== fingerprint.configuration ||
          (fingerprint.representation && ledger.representation !== fingerprint.representation))) {
        const value = fresh(fingerprint);
        await transaction(() => save(value)); ledger = value;
      }
      if (fingerprint.representation) selected = ledger ?? fresh(fingerprint);
    },
    async warn(diagnostic) {
      if (!selected || selected.error_ids.length >= MAX_COMPARISON_INCIDENT_IDS) return null;
      const comparisonIncident = { version: 2, episodeId: selected.episode_id, scopeId: selected.scope_id };
      const metadata = sanitizeData({ ...diagnostic, comparisonIncident });
      const next = await transaction(async () => {
        const { rows: [row] } = await query(`INSERT INTO error_log (level,module,message,system_context,metadata)
          VALUES ('WARN','LibraryComparisonContext',$1,$2,$3) RETURNING error_id`,
        [COMPARISON_WARNING, getSystemContext(), metadata]);
        const value = { ...selected, error_ids: [...selected.error_ids, row.error_id] };
        await save(value); return value;
      });
      ledger = selected = next;
      return metadata;
    },
    async recover(report) {
      if (!selected?.error_ids.length || !['ready', 'revalidated'].includes(report.status)) return null;
      const current = selected;
      const result = await transaction(async client => {
        const repository = createComparisonIncidentRepository({ withTransaction: callback => callback(client) });
        const resolved = await repository.resolve({ episodeId: current.episode_id, scopeId: current.scope_id,
          errorIds: current.error_ids, version: 2, status: report.status, isCurrent });
        const next = { ...current, episode_id: randomUUID(), error_ids: [] };
        await save(next);
        return { next, resolved };
      });
      ledger = selected = result.next;
      return { version: 2, episodeId: current.episode_id, scopeId: current.scope_id, resolvedCount: result.resolved.length };
    },
  };
}
