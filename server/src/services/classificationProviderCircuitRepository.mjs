/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { AUTOMATIC_RECOVERY_COOLDOWN_MS } from './automaticClassificationRecoveryPolicy.mjs';

export class ClassificationProviderCircuitRepository {
  constructor({ database = db } = {}) { this.db = database; }

  async admit(key) {
    const trial = await this.db.query(
      `UPDATE classification_provider_circuits SET trial_remaining = trial_remaining - 1
       WHERE dependency_key = $1 AND state = 'half_open' AND trial_remaining > 0
         AND ready_until > clock_timestamp() RETURNING epoch`, [key],
    );
    if (trial.rows.length) return { key, epoch: trial.rows[0].epoch };
    const result = await this.db.query(
      'SELECT state, epoch FROM classification_provider_circuits WHERE dependency_key = $1', [key],
    );
    const row = result.rows[0];
    return !row || row.state === 'closed' ? { key, epoch: row?.epoch ?? 0 } : null;
  }

  async open(ticket, failureCode) {
    return this.db.withTransaction(async (client) => {
      // Match recovery's lock order: shared probe state, then provider circuit.
      await client.query('INSERT INTO classification_recovery_probe_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING');
      await client.query('SELECT id FROM classification_recovery_probe_state WHERE id = true FOR UPDATE');
      const result = await client.query(
        `INSERT INTO classification_provider_circuits (dependency_key, state, failure_code)
         SELECT $1, 'open', $2 WHERE $3::bigint = 0
         ON CONFLICT (dependency_key) DO UPDATE SET state = 'open',
           epoch = classification_provider_circuits.epoch + 1, trial_remaining = 0,
           ready_until = NULL, failure_code = EXCLUDED.failure_code, updated_at = NOW()
         WHERE classification_provider_circuits.epoch = $3 RETURNING dependency_key`,
        [ticket.key, failureCode, ticket.epoch],
      );
      // Existing rows with a nonzero epoch need an update, not the first-insert path.
      const changed = result.rows.length ? result : await client.query(
        `UPDATE classification_provider_circuits SET state = 'open', epoch = epoch + 1,
           trial_remaining = 0, ready_until = NULL, failure_code = $2, updated_at = NOW()
         WHERE dependency_key = $1 AND epoch = $3 RETURNING dependency_key`,
        [ticket.key, failureCode, ticket.epoch],
      );
      if (!changed.rows.length) return false;
      // Invalidate any older recovery proof and start the shared, durable cooldown.
      await client.query(
        `INSERT INTO classification_recovery_probe_state (id, next_probe_at, last_outcome)
         VALUES (true, NOW() + ($1 * interval '1 millisecond') + random() * interval '60 seconds', 'unavailable')
         ON CONFLICT (id) DO UPDATE SET next_probe_at = GREATEST(
           classification_recovery_probe_state.next_probe_at, EXCLUDED.next_probe_at),
           lease_token = NULL, last_outcome = 'unavailable'`, [AUTOMATIC_RECOVERY_COOLDOWN_MS],
      );
      return true;
    });
  }

  async grantTrial(client, key, leaseToken) {
    // The caller holds the current configuration and shared probe lease locks.
    await client.query(
      `UPDATE classification_provider_circuits SET state = 'half_open', epoch = epoch + 1,
         trial_remaining = 5, ready_until = clock_timestamp() + interval '60 seconds',
         last_probe_token = $2, updated_at = NOW()
       WHERE dependency_key = $1 AND state <> 'closed' AND last_probe_token IS DISTINCT FROM $2::uuid`,
      [key, leaseToken],
    );
  }

  async close(ticket) {
    const result = await this.db.query(
      `UPDATE classification_provider_circuits SET state = 'closed', epoch = epoch + 1,
         trial_remaining = 0, ready_until = NULL, updated_at = NOW()
       WHERE dependency_key = $1 AND epoch = $2 AND state = 'half_open' RETURNING dependency_key`,
      [ticket.key, ticket.epoch],
    );
    return result.rows.length > 0;
  }
}
