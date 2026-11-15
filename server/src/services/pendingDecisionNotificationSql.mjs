/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Only bind the lifecycle's already validated canonical positive predecessor IDs. */
export const MARK_SUPERSEDED_PENDING_NOTIFICATIONS_READ_SQL = `UPDATE app_notifications
  SET is_read = true,
      read_at = COALESCE(read_at, NOW())
  WHERE is_read = false
    AND data IS NOT NULL
    AND data->>'notificationType' = 'awaiting_decision'
    AND (data->>'classificationId') ~ '^[0-9]+$'
    AND (ltrim(data->>'classificationId', '0') COLLATE "C") = ANY($1::text[])`;
