/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const isDiscordId = value => typeof value === 'string' && /^[0-9]{17,20}$/.test(value);
export const isDeliveryNonce = value => typeof value === 'string' && /^cf_[A-Za-z0-9_-]{22}$/.test(value);

export function deliveryResult(row) {
  if (row?.state === 'delivered') return { sent: false, reason: 'already_notified', messageId: row.message_id };
  return { sent: false, reason: row?.state === 'rejected' ? 'delivery_rejected' : 'delivery_unconfirmed' };
}

export function configAllowsDelivery(saved, input) {
  const { config, kind, channelId, client } = input;
  if (!saved?.enabled || !config?.enabled || !client.token || !saved.bot_token) return false;
  if (saved.bot_token.replace(/^Bot\s+/i, '') !== client.token.replace(/^Bot\s+/i, '')) return false;
  if (saved.channel_id !== channelId || saved.id !== config.id) return false;
  const flag = kind === 'pending' ? 'notify_on_pending_items' : 'notify_on_classification';
  if (!saved[flag] || !config[flag]) return false;
  // Do not send an old mention or display policy after configuration changed.
  const revisionValue = value => value instanceof Date ? value.getTime() : value ?? '';
  return ['updated_at', 'bot_token', 'channel_id', 'pending_mention_here', 'pending_mention_type',
    'pending_mention_target_id', 'show_poster', 'show_confidence', 'show_method', 'show_reason',
    'show_metadata', 'enable_corrections', 'correction_buttons_count', 'include_library_dropdown']
    .every(key => revisionValue(saved[key]) === revisionValue(config[key]));
}
