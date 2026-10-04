/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { configAllowsDelivery, deliveryConfigFingerprint, deliveryResult } from './discordDeliveryContract.mjs';
import { readDiscordProviderCooldown } from './discordProviderCooldown.mjs';
import { DELIVERY_CORRELATION_VERSION } from './discordDeliveryMarker.mjs';
import { verificationConfigMatches } from './discordDeliveryVerificationContract.mjs';
import { retainDiscordDelivery } from './discordDeliveryOutbox.mjs';
import { validRetainedDiscordBody } from './discordDeliveryBody.mjs';

export function createDiscordDeliveryRepository(db) {
  const transaction = fn => db.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    return fn(client);
  });
  return {
    claim(input) {
      return transaction(async client => {
        const { rows: [history] } = await client.query(
          'SELECT status, clarification_status, discord_message_id, metadata FROM classification_history WHERE id = $1 FOR UPDATE',
          [input.classificationId]);
        if (!history) return { sent: false, reason: 'classification_missing' };
        const { rows: [existing] } = await client.query(
          'SELECT * FROM discord_notification_deliveries WHERE classification_id = $1', [input.classificationId]);
        if (existing && existing.state !== 'deferred') return deliveryResult(existing);
        if (input.dispatchNonce && existing?.nonce !== input.dispatchNonce) return { sent: false, reason: 'delivery_not_retained' };
        if (history.discord_message_id || history.metadata?.discord_message_id) {
          return { sent: false, reason: 'already_notified' };
        }
        if (['corrected', 'verified', 'reclassified'].includes(history.status)
          || (input.kind === 'pending' && !['awaiting_decision', 'pending_retry'].includes(history.status))) {
          return { sent: false, reason: 'classification_changed' };
        }
        const { rows: [saved] } = await client.query(
          'SELECT * FROM notification_config WHERE id = $1 AND type = $2 FOR SHARE', [input.config.id, 'discord']);
        if (!configAllowsDelivery(saved, input)) return { sent: false, reason: 'configuration_changed' };
        const fingerprint = deliveryConfigFingerprint(saved);
        if (existing && (existing.config_fingerprint !== fingerprint || existing.bot_user_id !== input.client.user.id
          || existing.channel_id !== input.channelId || existing.notification_kind !== input.kind
          || existing.previous_status !== history.status
          || existing.previous_clarification_status !== history.clarification_status
          || existing.desired_clarification_status !== (input.clarificationStatus ?? null))) {
          return { sent: false, reason: 'configuration_changed' };
        }
        if (existing?.attempt_count >= 3) return { sent: false, reason: 'delivery_attempts_exhausted' };
        let body;
        if (existing) {
          const { rows: [retained] } = await client.query(`SELECT body FROM discord_delivery_outbox
            WHERE nonce = $1 AND config_id = $2 AND expires_at > clock_timestamp()`, [existing.nonce, saved.id]);
          body = retained?.body;
          if (body && !validRetainedDiscordBody(body, input.classificationId, existing.nonce)) {
            return { sent: false, reason: 'delivery_not_retained' };
          }
          if (input.dispatchNonce && !body) return { sent: false, reason: 'delivery_not_retained' };
        }
        const waiting = await readDiscordProviderCooldown(client);
        if (waiting) return { sent: false, reason: 'delivery_deferred', retryAfterSeconds: waiting.retryAfterSeconds };
        if (existing) {
          await client.query(`UPDATE discord_notification_deliveries SET state = 'sending', failure_code = NULL,
            attempt_count = attempt_count + 1, updated_at = clock_timestamp() WHERE nonce = $1`, [existing.nonce]);
          return { admitted: true, nonce: existing.nonce, attempt: existing.attempt_count + 1, ...(body ? { body, retryBuffered: true } : {}) };
        }
        const nonce = `cf_${randomBytes(16).toString('base64url')}`;
        await client.query(`INSERT INTO discord_notification_deliveries
          (classification_id, nonce, bot_user_id, channel_id, notification_kind,
           previous_status, previous_clarification_status, desired_clarification_status, correlation_version, config_fingerprint)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [input.classificationId, nonce, input.client.user.id, input.channelId, input.kind,
          history.status, history.clarification_status, input.clarificationStatus ?? null, DELIVERY_CORRELATION_VERSION, fingerprint]);
        body = input.prepareBody?.(nonce);
        const retryBuffered = body ? await retainDiscordDelivery(client,
          { nonce, classificationId: input.classificationId, configId: saved.id, body }) : false;
        return { admitted: true, nonce, attempt: 1, ...(body ? { body, retryBuffered } : {}) };
      });
    },
    defer(nonce, attempt) {
      return transaction(async client => {
        const { rows: [row] } = await client.query(`UPDATE discord_notification_deliveries
          SET state = CASE WHEN state = 'delivered' THEN state ELSE 'deferred' END,
              failure_code = CASE WHEN state = 'delivered' THEN NULL ELSE 'provider_rate_limited' END,
              updated_at = clock_timestamp()
          WHERE nonce = $1 AND attempt_count = $2 AND state IN ('sending', 'delivered')
          RETURNING state, message_id`, [nonce, attempt]);
        return deliveryResult(row);
      });
    },
    complete({ nonce, botUserId, channelId, messageId, correlationVersion, classificationId, verificationConfig = undefined }) {
      return transaction(async client => {
        const { rows: [receipt] } = await client.query(
          'SELECT * FROM discord_notification_deliveries WHERE nonce = $1 AND bot_user_id = $2 AND channel_id = $3',
          [nonce, botUserId, channelId]);
        if (!receipt) return false;
        if (correlationVersion !== undefined && (correlationVersion !== DELIVERY_CORRELATION_VERSION
          || receipt.correlation_version !== correlationVersion
          || String(receipt.classification_id) !== classificationId)) return false;
        // All mutators lock the parent first; never invert claim's lock order.
        const { rows: [history] } = await client.query(
          'SELECT id FROM classification_history WHERE id = $1 FOR UPDATE', [receipt.classification_id]);
        if (!history) return false;
        if (verificationConfig) {
          const { rows: [saved] } = await client.query(`SELECT *, updated_at::text AS verification_revision
            FROM notification_config WHERE id = $1 AND type = 'discord' FOR SHARE`, [verificationConfig.id]);
          if (!verificationConfigMatches(saved, verificationConfig)) return false;
        }
        const completed = await client.query(`UPDATE discord_notification_deliveries
          SET state = 'delivered', message_id = $2, failure_code = NULL, updated_at = now()
          WHERE nonce = $1 AND (message_id IS NULL OR message_id = $2) RETURNING classification_id`, [nonce, messageId]);
        if (!completed.rowCount) return false;
        await client.query('DELETE FROM discord_delivery_outbox WHERE nonce = $1', [nonce]);
        // Preserve any newer decision or conflicting legacy projection. The receipt
        // still records positive delivery evidence; it does not authorize a resend.
        await client.query(`UPDATE classification_history SET discord_message_id = $2,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('discord_message_id', $2::text),
          clarification_status = CASE WHEN status IS NOT DISTINCT FROM $3
            AND clarification_status IS NOT DISTINCT FROM $4 AND $5::text IS NOT NULL
            THEN $5 ELSE clarification_status END
          WHERE id = $1 AND (discord_message_id IS NULL OR discord_message_id = $2)
            AND (metadata->>'discord_message_id' IS NULL OR metadata->>'discord_message_id' = $2)`,
        [receipt.classification_id, messageId, receipt.previous_status,
          receipt.previous_clarification_status, receipt.desired_clarification_status]);
        return true;
      });
    },
    fail(nonce, code) {
      return transaction(async client => {
        const { rows: [row] } = await client.query(`UPDATE discord_notification_deliveries
          SET state = CASE WHEN state = 'delivered' THEN state ELSE $2 END,
              failure_code = CASE WHEN state = 'delivered' THEN NULL ELSE $3 END, updated_at = now()
          WHERE nonce = $1 RETURNING state, message_id`,
        [nonce, code === 'provider_rejected' ? 'rejected' : 'uncertain', code]);
        await client.query('DELETE FROM discord_delivery_outbox WHERE nonce = $1', [nonce]);
        return deliveryResult(row);
      });
    },
  };
}
