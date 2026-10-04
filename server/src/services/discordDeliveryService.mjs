/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeliveryNonce, isDiscordId } from './discordDeliveryContract.mjs';

export function createDiscordDeliveryService(repository) {
  let sending = 0;
  let confirming = 0;
  const warn = (warnFn, reason, classificationId) => {
    try {
      warnFn?.({
        category: reason, message: reason.endsWith('_busy')
          ? 'Discord notification work skipped because local capacity is full'
          : 'Discord delivery requires review; no automatic resend was attempted',
        // Bound dedupe cardinality by fixed reason, not the number of media items.
        metadata: { reason, classificationId }, dedupeSignature: `${reason}:initial-notification`,
      });
    } catch { /* A diagnostic sink failure must not break the Gateway listener. */ }
  };
  const complete = async (proof, onFailure = () => {}) => {
    // A lost COMMIT acknowledgement is safe to retry locally, never remotely.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { return await repository.complete(proof); } catch { /* bounded database-only retry */ }
    }
    onFailure();
    return false;
  };
  return {
    async send(input) {
      if (!isDiscordId(input.client?.user?.id) || !isDiscordId(input.channelId)
        || !['classification', 'confidence', 'pending'].includes(input.kind)
        || !/^[1-9][0-9]{0,18}$/.test(String(input.classificationId ?? ''))) {
        return { sent: false, reason: 'invalid_delivery_scope' };
      }
      if (sending >= 8) {
        warn(input.warnFn, 'delivery_busy', input.classificationId);
        return { sent: false, reason: 'delivery_busy' };
      }
      sending += 1;
      let claim;
      try {
        claim = await repository.claim(input);
        if (!claim.admitted) {
          if (['delivery_unconfirmed', 'delivery_rejected'].includes(claim.reason)) warn(input.warnFn, claim.reason, input.classificationId);
          return claim;
        }
        let message;
        try {
          message = await input.channel.send({ ...input.payload, nonce: claim.nonce, enforceNonce: true });
        } catch (error) {
          const code = [400, 401, 403, 404].includes(error?.status) ? 'provider_rejected' : 'send_unconfirmed';
          const result = await repository.fail(claim.nonce, code);
          if (!result.messageId) warn(input.warnFn, result.reason, input.classificationId);
          return result;
        }
        if (isDiscordId(message?.id) && await complete({ nonce: claim.nonce,
          botUserId: input.client.user.id, channelId: input.channelId, messageId: message.id })) {
          return { sent: true, messageId: message.id };
        }
        const result = await repository.fail(claim.nonce, 'completion_unconfirmed');
        if (!result.messageId) warn(input.warnFn, result.reason, input.classificationId);
        return result;
      } catch {
        // Admission may have committed even when its acknowledgement was lost.
        warn(input.warnFn, 'delivery_unconfirmed', input.classificationId);
        return { sent: false, reason: 'delivery_unconfirmed' };
      } finally { sending -= 1; }
    },
    async observe(message, client, warnFn) {
      if (!isDeliveryNonce(message?.nonce) || !isDiscordId(message?.id)
        || !isDiscordId(message?.channelId) || !isDiscordId(client?.user?.id)
        || message?.author?.id !== client.user.id) return false;
      if (confirming >= 8) {
        warn(warnFn, 'delivery_confirmation_busy', null);
        return false;
      }
      confirming += 1;
      try {
        return await complete({ nonce: message.nonce, botUserId: client.user.id,
          channelId: message.channelId, messageId: message.id },
        () => warn(warnFn, 'delivery_confirmation_unavailable', null));
      } finally { confirming -= 1; }
    },
  };
}
