/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { MessagePayload } from 'discord.js';
import { readDeliveryMarker } from './discordDeliveryMarker.mjs';

const keys = new Set(['content', 'embeds', 'components', 'allowed_mentions', 'nonce', 'enforce_nonce', 'tts']);

export function serializeDiscordDeliveryBody(input, payload) {
  if (payload.files?.length || payload.attachments?.length) throw new Error('unsupported_delivery_files');
  const body = JSON.stringify(MessagePayload.create(input.channel, payload).resolveBody().body);
  if (Buffer.byteLength(body) > 256 * 1024) throw new Error('delivery_payload_too_large');
  return body;
}

/** Only internally produced notification bodies may be retained/replayed. */
export function validRetainedDiscordBody(body, classificationId, nonce) {
  if (typeof body !== 'string' || Buffer.byteLength(body) > 65536) return false;
  try {
    const value = JSON.parse(body);
    const marker = readDeliveryMarker(value?.embeds?.[0]?.footer?.text);
    return Object.keys(value).every(key => keys.has(key)) && value.nonce === nonce
      && value.enforce_nonce === true && marker?.nonce === nonce
      && marker?.classificationId === String(classificationId);
  } catch { return false; }
}
