/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export function createDiscordDeliveryReviewRepository(db) {
  return {
    async list(before) {
      return db.withTransaction(async client => {
        await client.query('SET TRANSACTION READ ONLY');
        await client.query("SET LOCAL statement_timeout = '3s'");
        await client.query("SET LOCAL lock_timeout = '1s'");
        // Limit before joining history; the existing primary key supports paging.
        const { rows } = await client.query(`
          SELECT d.classification_id::text AS "classificationId",
            left(h.title, 240) AS title, d.state, d.channel_id AS "channelId",
            d.message_id AS "messageId", d.notification_kind AS kind,
            d.created_at AS "createdAt", d.updated_at AS "updatedAt",
            (d.correlation_version = 1 AND d.state IN ('sending', 'uncertain')) AS "canVerify",
            (d.state = 'deferred' AND d.attempt_count < 3 AND EXISTS (
              SELECT 1 FROM discord_delivery_outbox o WHERE o.nonce = d.nonce
                AND o.expires_at > clock_timestamp())) AS "retryQueued"
          FROM (
            SELECT classification_id, state, channel_id, message_id,
              notification_kind, created_at, updated_at, correlation_version, nonce, attempt_count
            FROM discord_notification_deliveries
            WHERE classification_id < $1::bigint
            ORDER BY classification_id DESC LIMIT 26
          ) d
          JOIN classification_history h ON h.id = d.classification_id
          ORDER BY d.classification_id DESC`, [before]);
        const items = rows.slice(0, 25).map(row => ({
          classificationId: row.classificationId, title: row.title,
          state: row.state, channelId: row.channelId, messageId: row.messageId,
          kind: row.kind, createdAt: row.createdAt, updatedAt: row.updatedAt,
          canVerify: row.canVerify === true,
          retryQueued: row.retryQueued === true,
        }));
        return { items, nextBefore: rows.length > 25 ? items[24].classificationId : null };
      });
    },
  };
}
