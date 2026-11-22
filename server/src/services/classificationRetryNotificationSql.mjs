/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Cast the bound History ID only. Notification data stays text. */
export const DELETE_RETRY_CLASSIFICATION_NOTIFICATIONS_SQL = `DELETE FROM app_notifications
  WHERE data IS NOT NULL
    AND (
      (data ? 'classificationId'
        AND (data->>'classificationId') ~ '^[0-9]+$'
        AND (ltrim(data->>'classificationId', '0') COLLATE "C") = ltrim(($1::bigint)::text, '0'))
      OR (data ? 'classification_id'
        AND (data->>'classification_id') ~ '^[0-9]+$'
        AND (ltrim(data->>'classification_id', '0') COLLATE "C") = ltrim(($1::bigint)::text, '0'))
    )`;
