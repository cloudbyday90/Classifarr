/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDiscordId } from './discordDeliveryContract.mjs';

export function validVerificationInput(classificationId, body) {
  return typeof classificationId === 'string' && /^[1-9][0-9]{0,18}$/.test(classificationId)
    && BigInt(classificationId) <= 9223372036854775807n
    && body && !Array.isArray(body) && Object.keys(body).length === 1 && isDiscordId(body.messageId);
}

export function verificationConfigMatches(saved, snapshot) {
  return Boolean(saved?.enabled && snapshot?.enabled && saved.bot_token
    && ['id', 'bot_token', 'channel_id', 'verification_revision'].every(key => saved[key] === snapshot[key]));
}

// null is a fail-closed, indefinite pause; never shorten an unknown provider limit.
export function verificationRetrySeconds(value) {
  const seconds = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 && seconds <= 315360000
    ? Math.max(60, Math.ceil(seconds)) : null;
}
