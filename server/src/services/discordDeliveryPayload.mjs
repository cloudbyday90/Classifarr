/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { formatDeliveryMarker, hasDeliveryMarker, readDeliveryMarker } from './discordDeliveryMarker.mjs';

const invalid = () => { throw new Error('delivery_payload_invalid'); };
const textLength = (value, limit) => {
  if (value == null) return 0;
  if (typeof value !== 'string' || value.length > limit) return invalid();
  return value.length;
};

function embedLength(embed) {
  const fields = embed.fields ?? [];
  if (!Array.isArray(fields) || fields.length > 25) return invalid();
  return textLength(embed.title, 256) + textLength(embed.description, 4096)
    + textLength(embed.author?.name, 256) + textLength(embed.footer?.text, 2048)
    + fields.reduce((sum, field) => sum + textLength(field.name, 256) + textLength(field.value, 1024), 0);
}

function footerText(text, marker, available) {
  const limit = Math.min(2048, available);
  if (limit < marker.length || typeof text !== 'string' || hasDeliveryMarker(text)) return invalid();
  let prose = text.slice(0, Math.max(0, limit - marker.length - 1));
  // Do not split a UTF-16 surrogate pair when shortening decorative footer prose.
  if (/[\uD800-\uDBFF]$/.test(prose)) prose = prose.slice(0, -1);
  return prose ? `${prose}\n${marker}` : marker;
}

/** Reserve space before admission, without mutating the caller's embed builders. */
export function prepareDeliveryPayload(payload, classificationId) {
  if (!payload || !Array.isArray(payload.embeds ?? []) || (payload.embeds?.length ?? 0) > 10) return invalid();
  const embeds = (payload.embeds?.length ? payload.embeds : [{}]).map(embed => (
    typeof embed?.toJSON === 'function' ? embed.toJSON() : { ...embed }
  ));
  const total = embeds.reduce((sum, embed) => sum + embedLength(embed), 0);
  if (embeds.some(embed => hasDeliveryMarker(embed.footer?.text))) return invalid();
  const first = embeds[0];
  const prose = first.footer?.text ?? '';
  const available = 6000 - total + prose.length;
  // All admitted nonces have the same wire length. Fail before claiming a receipt.
  footerText(prose, formatDeliveryMarker(classificationId, `cf_${'0'.repeat(22)}`), available);
  return nonce => ({
    ...payload, nonce, enforceNonce: true,
    embeds: [{ ...first, footer: { ...first.footer,
      text: footerText(prose, formatDeliveryMarker(classificationId, nonce), available) } }, ...embeds.slice(1)],
  });
}

/** Interaction edits replace the message with one embed; never invent legacy proof. */
export function setDeliveryFooter(embed, text) {
  const original = embed.data.footer?.text;
  const proof = readDeliveryMarker(original);
  if (hasDeliveryMarker(original) && !proof) return invalid();
  if (!proof) return embed.setFooter({ text });
  const available = 6000 - embedLength(embed.data) + original.length;
  return embed.setFooter({ text: footerText(text, formatDeliveryMarker(proof.classificationId, proof.nonce), available) });
}
