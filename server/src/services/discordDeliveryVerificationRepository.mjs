/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';

export function createDiscordDeliveryVerificationRepository(db) {
  const transaction = fn => db.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    return fn(client);
  });
  return {
    admit(classificationId) {
      return transaction(async client => {
        const { rows: [receipt] } = await client.query(
          'SELECT * FROM discord_notification_deliveries WHERE classification_id = $1', [classificationId]);
        if (!receipt) return { code: 'receipt_missing' };
        if (receipt.state === 'delivered') return { code: 'confirmed', messageId: receipt.message_id };
        if (receipt.correlation_version !== 1 || !['sending', 'uncertain'].includes(receipt.state)) return { code: 'not_eligible' };
        const { rows: [config] } = await client.query(`SELECT *, updated_at::text AS verification_revision
          FROM notification_config WHERE type = 'discord'`);
        if (!config?.enabled || !config.bot_token || config.channel_id !== receipt.channel_id) return { code: 'configuration_changed' };
        const operationId = randomUUID();
        const admitted = await client.query(`INSERT INTO discord_delivery_verification_guard
          (singleton, operation_id, classification_id, next_allowed_at, outcome)
          VALUES (true, $1, $2, clock_timestamp() + interval '60 seconds', 'started')
          ON CONFLICT (singleton) DO UPDATE SET operation_id = EXCLUDED.operation_id,
            classification_id = EXCLUDED.classification_id, next_allowed_at = EXCLUDED.next_allowed_at,
            outcome = 'started', updated_at = clock_timestamp()
          WHERE discord_delivery_verification_guard.next_allowed_at <= clock_timestamp()
          RETURNING operation_id`, [operationId, classificationId]);
        if (!admitted.rowCount) {
          const { rows: [guard] } = await client.query(`SELECT CASE WHEN isfinite(next_allowed_at)
            THEN greatest(1, ceil(extract(epoch FROM next_allowed_at - clock_timestamp())))::bigint
            ELSE NULL END AS seconds FROM discord_delivery_verification_guard WHERE singleton`);
          return { code: guard?.seconds == null ? 'verification_paused' : 'cooldown',
            retryAfterSeconds: guard?.seconds == null ? null : Number(guard.seconds) };
        }
        return { code: 'admitted', receipt, config, operationId };
      });
    },
    finish(operationId, code, retryAfterSeconds = 60) {
      return transaction(client => client.query(`UPDATE discord_delivery_verification_guard
        SET outcome = $2, updated_at = clock_timestamp(), next_allowed_at = greatest(next_allowed_at,
          CASE WHEN $3::double precision IS NULL THEN 'infinity'::timestamptz
            ELSE clock_timestamp() + $3 * interval '1 second' END)
        WHERE singleton AND operation_id = $1`, [operationId, code, retryAfterSeconds]));
    },
  };
}
