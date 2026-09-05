/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Appended to guarded persistence; $6 is attempted, $7 is a captured observation. */
export const INVENTORY_OBSERVATION_ACTIVITY_CTE = `
    , activity AS (
      INSERT INTO inventory_observation_activity AS existing (hour_slot, bucket_at, captured, unavailable)
      SELECT mod(floor(extract(epoch FROM NOW()) / 3600)::bigint, 168),
        date_trunc('hour', NOW(), 'UTC'), CASE WHEN $7 THEN 1 ELSE 0 END, CASE WHEN $7 THEN 0 ELSE 1 END
      FROM updated WHERE $6
      ON CONFLICT (hour_slot) DO UPDATE SET
        bucket_at = EXCLUDED.bucket_at,
        captured = CASE WHEN existing.bucket_at = EXCLUDED.bucket_at THEN existing.captured ELSE 0 END + EXCLUDED.captured,
        unavailable = CASE WHEN existing.bucket_at = EXCLUDED.bucket_at THEN existing.unavailable ELSE 0 END + EXCLUDED.unavailable
      WHERE existing.bucket_at <= EXCLUDED.bucket_at
    )`;
