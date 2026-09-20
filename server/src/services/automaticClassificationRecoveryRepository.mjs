/*
 * Classifarr - Copyright (C) 2024-2026 Classifarr Contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { createHash, randomUUID } from 'node:crypto';
import * as db from '../config/database.mjs';
import { acquireAiProviderConfigurationRevisionWriteLock } from './aiProviderConfigurationRevisionIntegrity.mjs';
import {
  AUTOMATIC_RECOVERY_BATCH_SIZE, AUTOMATIC_RECOVERY_COOLDOWN_MS,
  AUTOMATIC_RECOVERY_FAILURE_CODES, AUTOMATIC_RECOVERY_PROOF_MAX_AGE_MS,
} from './automaticClassificationRecoveryPolicy.mjs';

// Include effective endpoint and credential changes without retaining their values in a receipt/log.
const CONFIGURATION_FIELDS = [
  'configuration_revision', 'primary_provider', 'api_endpoint', 'api_key', 'model',
  'ollama_host', 'ollama_port', 'ollama_model', 'ollama_fallback_enabled',
  'ollama_for_budget_exhausted', 'ollama_for_basic_tasks', 'temperature', 'max_tokens',
];

export class AutomaticClassificationRecoveryRepository {
  constructor({ database = db, now = Date.now } = {}) {
    this.db = database;
    this.now = now;
  }

  async findDue() {
    const result = await this.db.query(
      `SELECT history.id FROM classification_history AS history
       WHERE history.status = 'failed' AND history.method = 'queued_for_retry' AND history.library_id IS NULL
         AND history.retry_after IS NULL AND history.retry_count >= history.max_retries AND history.max_retries > 0
         AND history.retry_recovery_attempts = 0 AND history.retry_failure_code = ANY($1::text[])
         AND history.pending_identity_key IS NOT NULL
         AND history.retry_exhausted_at <= NOW() - ($2 * interval '1 millisecond')
         AND NOT EXISTS (SELECT 1 FROM classification_history AS newer
           WHERE (newer.recorded_at, newer.id) > (history.recorded_at, history.id)
             AND (newer.pending_identity_key = history.pending_identity_key OR
               (newer.tmdb_id = history.tmdb_id AND newer.media_type = history.media_type)))
       ORDER BY history.retry_exhausted_at, history.id LIMIT $3`,
      [AUTOMATIC_RECOVERY_FAILURE_CODES, AUTOMATIC_RECOVERY_COOLDOWN_MS, AUTOMATIC_RECOVERY_BATCH_SIZE],
    );
    return result.rows;
  }

  async claimProbe() {
    const token = randomUUID();
    const result = await this.db.query(
      `INSERT INTO classification_recovery_probe_state (id, lease_token, next_probe_at)
       VALUES (true, $1, NOW() + ($2 * interval '1 millisecond') + (random() * interval '60 seconds'))
       ON CONFLICT (id) DO UPDATE SET lease_token = EXCLUDED.lease_token,
         next_probe_at = EXCLUDED.next_probe_at
       WHERE classification_recovery_probe_state.next_probe_at <= NOW() RETURNING lease_token`,
      [token, AUTOMATIC_RECOVERY_COOLDOWN_MS],
    );
    return result.rows[0]?.lease_token || null;
  }

  async loadConfiguration(client = this.db, { lock = false } = {}) {
    if (lock) {
      await acquireAiProviderConfigurationRevisionWriteLock(client);
      // Legacy Ollama settings have a separate writer and no configuration revision.
      // A short SHARE lock also covers its first-row/active-row replacement case.
      await client.query('LOCK TABLE ollama_config IN SHARE MODE');
    }
    const configurationQuery = lock
      ? 'SELECT * FROM ai_provider_config WHERE id = 1 FOR SHARE'
      : 'SELECT * FROM ai_provider_config WHERE id = 1';
    const [aiResult, localResult] = await Promise.all([
      client.query(configurationQuery),
      client.query('SELECT id, host, port, model FROM ollama_config WHERE is_active = true ORDER BY id LIMIT 1'),
    ]);
    const config = aiResult.rows[0] || { primary_provider: 'none' };
    const local = localResult.rows[0] || null;
    const fingerprint = createHash('sha256').update(JSON.stringify([
      CONFIGURATION_FIELDS.map((field) => config[field] ?? null), local,
    ])).digest('hex');
    return { config, local, fingerprint };
  }

  async checkReadiness(client, proof, leaseToken, classification) {
    if (!classification?.pending_identity_key) {
      return { eligible: false, reasonCode: 'recovery_identity_unavailable' };
    }
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [classification.pending_identity_key]);
    const newer = await client.query(
      `SELECT newer.id FROM classification_history AS newer
       JOIN classification_history AS current ON current.id = $1
       WHERE (newer.recorded_at, newer.id) > (current.recorded_at, current.id)
         AND (newer.pending_identity_key = current.pending_identity_key OR
           (newer.tmdb_id = current.tmdb_id AND newer.media_type = current.media_type)) LIMIT 1`,
      [classification.id],
    );
    if (newer.rows.length > 0) return { eligible: false, reasonCode: 'recovery_superseded' };
    const current = await this.loadConfiguration(client, { lock: true });
    const age = this.now() - proof.checkedAt;
    if (current.fingerprint !== proof.fingerprint) {
      return { eligible: false, reasonCode: 'recovery_configuration_changed' };
    }
    if (!Number.isFinite(age) || age < 0 || age > AUTOMATIC_RECOVERY_PROOF_MAX_AGE_MS) {
      return { eligible: false, reasonCode: 'recovery_readiness_expired' };
    }
    const lease = await client.query(
      `SELECT id FROM classification_recovery_probe_state
       WHERE id = true AND lease_token = $1 AND next_probe_at > clock_timestamp() FOR SHARE`,
      [leaseToken],
    );
    const eligible = lease.rows.length === 1;
    return { eligible, reasonCode: eligible ? null : 'recovery_lease_expired' };
  }

  async completeProbe(leaseToken, outcome) {
    await this.db.query(
      `UPDATE classification_recovery_probe_state SET checked_at = NOW(), last_outcome = $2
       WHERE id = true AND lease_token = $1`,
      [leaseToken, outcome],
    );
  }
}
