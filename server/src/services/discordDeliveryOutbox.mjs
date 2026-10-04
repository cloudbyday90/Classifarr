/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validRetainedDiscordBody } from './discordDeliveryBody.mjs';

/** Called inside receipt admission; never performs HTTP. Overflow is not queued. */
export async function retainDiscordDelivery(client, { nonce, classificationId, configId, body }) {
  if (!validRetainedDiscordBody(body, classificationId, nonce)) return false;
  const { rows: [lock] } = await client.query(
    "SELECT pg_try_advisory_xact_lock(hashtext('classifarr-discord-outbox-capacity'), 1) AS acquired");
  if (!lock.acquired) return false;
  const result = await client.query(`INSERT INTO discord_delivery_outbox (nonce, config_id, body)
    SELECT $1, $2, $3 WHERE (SELECT count(*) FROM discord_delivery_outbox) < 1000`, [nonce, configId, body]);
  return result.rowCount === 1;
}

export function createDiscordDeliveryOutbox(db) {
  const transaction = fn => db.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    return fn(client);
  });
  return {
    async cleanup() {
      return transaction(async client => {
        const result = await client.query(`DELETE FROM discord_delivery_outbox WHERE nonce IN (
          SELECT o.nonce FROM discord_delivery_outbox o JOIN discord_notification_deliveries d USING (nonce)
          WHERE o.expires_at <= clock_timestamp() OR d.state IN ('delivered', 'uncertain', 'rejected')
            OR d.attempt_count >= 3
          ORDER BY o.expires_at LIMIT 100)`);
        return result.rowCount;
      });
    },
    async candidates() {
      return transaction(async client => {
        const { rows } = await client.query(`SELECT d.classification_id AS "classificationId", d.nonce,
          d.notification_kind AS kind, d.desired_clarification_status AS "clarificationStatus",
          o.config_id AS "configId"
          FROM discord_delivery_outbox o JOIN discord_notification_deliveries d USING (nonce)
          WHERE d.state = 'deferred' AND d.attempt_count < 3 AND o.expires_at > clock_timestamp()
            AND NOT EXISTS (SELECT 1 FROM discord_provider_cooldown WHERE next_allowed_at > clock_timestamp())
          ORDER BY o.expires_at, o.nonce LIMIT 4`);
        return rows;
      });
    },
    discard(nonce) {
      return transaction(client => client.query('DELETE FROM discord_delivery_outbox WHERE nonce = $1', [nonce]));
    },
  };
}
