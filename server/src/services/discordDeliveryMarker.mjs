/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeliveryNonce, isDiscordId } from './discordDeliveryContract.mjs';

const PREFIX = 'Classifarr receipt ';
export const DELIVERY_CORRELATION_VERSION = 1;

export function formatDeliveryMarker(classificationId, nonce) {
  if (!/^[1-9][0-9]{0,18}$/.test(String(classificationId)) || !isDeliveryNonce(nonce)) {
    throw new Error('delivery_marker_invalid');
  }
  return `${PREFIX}v1:${classificationId}:${nonce}`;
}

export const hasDeliveryMarker = text => typeof text === 'string' && text.includes(PREFIX);

export function readDeliveryMarker(text) {
  if (typeof text !== 'string' || text.length > 2048) return null;
  const index = text.indexOf(PREFIX);
  if (index < 0 || (index > 0 && text[index - 1] !== '\n')) return null;
  const line = text.slice(index);
  const match = /^Classifarr receipt v1:([1-9][0-9]{0,18}):(cf_[A-Za-z0-9_-]{22})$/.exec(line);
  // JS $ permits a final newline; the wire marker does not.
  if (!match || match[0] !== line) return null;
  return { classificationId: match[1], nonce: match[2], correlationVersion: DELIVERY_CORRELATION_VERSION };
}

/** Only call with a normalized provider response, never a client-submitted body. */
export function getDeliveryProof(message, botUserId) {
  if (!isDiscordId(botUserId) || !isDiscordId(message?.id) || !isDiscordId(message?.channelId)
    || message?.author?.id !== botUserId || message.partial || message.webhookId
    || message.reference || message.messageSnapshots?.size) return null;
  const embeds = message.embeds ?? [];
  if (!Array.isArray(embeds) || embeds.length > 10) return null;
  const marked = embeds.filter(embed => hasDeliveryMarker(embed?.footer?.text));
  let correlation;
  if (marked.length) {
    correlation = readDeliveryMarker(embeds[0]?.footer?.text);
    if (marked.length !== 1 || !correlation || message.author.bot !== true || message.type !== 0
      || (message.nonce != null && message.nonce !== correlation.nonce)) return null;
  } else if (!isDeliveryNonce(message.nonce)) return null;
  return { nonce: message.nonce, ...correlation, botUserId, channelId: message.channelId, messageId: message.id };
}
