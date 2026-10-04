/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../utils/appError.mjs';
import { normalizePresetSavePayload } from './customPresetSavePayload.mjs';
import { buildCustomPresetKey } from '../utils/customPresetKey.mjs';

const receipt = row => ({ requestId: row.id, state: row.state, presetId: row.preset_id,
  resolved: row.resolved_at !== null });

export function createCustomPresetSaveService({ db }) {
  async function transaction(run) {
    return db.withTransaction(async client => {
      await client.query("SET LOCAL statement_timeout = '5s'");
      await client.query("SET LOCAL lock_timeout = '2s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
      return run(client);
    });
  }

  async function lock(client, userId, requestId) {
    const { rows } = await client.query(`SELECT id, state, preset_id, resolved_at, fingerprint
      FROM custom_preset_save_requests WHERE id = $1 AND user_id = $2 FOR UPDATE`, [requestId, userId]);
    if (!rows[0]) throw new NotFoundError('Save request not found or expired');
    return rows[0];
  }

  return {
    async pending(userId) {
      return transaction(async client => {
        const { rows } = await client.query(`SELECT id, state, preset_id, resolved_at FROM custom_preset_save_requests
          WHERE user_id = $1 AND resolved_at IS NULL`, [userId]);
        return rows[0] ? receipt(rows[0]) : null;
      });
    },
    async begin(userId) {
      return transaction(async client => {
        await client.query(`DELETE FROM custom_preset_save_requests WHERE id IN (
          SELECT id FROM custom_preset_save_requests WHERE user_id = $1
            AND resolved_at < NOW() - INTERVAL '30 days'
          ORDER BY resolved_at LIMIT 100 FOR UPDATE SKIP LOCKED)`, [userId]);
        const { rows } = await client.query(`INSERT INTO custom_preset_save_requests (id, user_id)
          VALUES ($1, $2) ON CONFLICT (user_id) WHERE resolved_at IS NULL DO NOTHING
          RETURNING id, state, preset_id, resolved_at`, [randomUUID(), userId]);
        if (!rows[0]) throw new ConflictError('Check the previous save before creating another preset');
        return receipt(rows[0]);
      });
    },
    async complete(userId, requestId, body) {
      const { payload, fingerprint } = normalizePresetSavePayload(body);
      return transaction(async client => {
        const row = await lock(client, userId, requestId);
        if (row.state === 'cancelled') throw new ConflictError('This save attempt was closed');
        if (row.state === 'saved') {
          if (row.fingerprint !== fingerprint) throw new ConflictError('This save request belongs to a different preset draft');
          return receipt(row);
        }
        const { rows: [{ id }] } = await client.query("SELECT nextval('content_presets_id_seq') AS id");
        await client.query(`INSERT INTO content_presets
          (id, key, name, description, icon, category, signals, is_system, user_id, is_public, display_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, false, 0)`,
        [id, buildCustomPresetKey(id, payload.name), payload.name, payload.description,
          payload.icon, payload.category, JSON.stringify(payload.signals), userId]);
        const { rows } = await client.query(`UPDATE custom_preset_save_requests
          SET state = 'saved', preset_id = $2, fingerprint = $3 WHERE id = $1 RETURNING id, state, preset_id, resolved_at`,
        [requestId, id, fingerprint]);
        return receipt(rows[0]);
      });
    },
    async resolve(userId, requestId) {
      return transaction(async client => {
        await lock(client, userId, requestId);
        const { rows } = await client.query(`UPDATE custom_preset_save_requests
          SET state = CASE WHEN state = 'pending' THEN 'cancelled' ELSE state END,
              resolved_at = COALESCE(resolved_at, NOW()) WHERE id = $1 RETURNING id, state, preset_id, resolved_at`, [requestId]);
        return receipt(rows[0]);
      });
    },
  };
}
