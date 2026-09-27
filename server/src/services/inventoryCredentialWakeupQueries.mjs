/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

export const CURRENT_WAKEUP = `SELECT w.*, c.api_key FROM inventory_credential_wakeups w
    JOIN tmdb_config c ON c.id=w.config_id
    WHERE c.id=(SELECT id FROM tmdb_config WHERE is_active ORDER BY id DESC LIMIT 1)
      AND NULLIF(BTRIM(c.api_key),'') IS NOT NULL FOR UPDATE OF w SKIP LOCKED`;

export const WAKEUP_CANDIDATES = `SELECT msi.id,msi.tmdb_id,msi.media_type,
    msi.inventory_tmdb_recovery AS recovery FROM media_server_items msi
    JOIN libraries l ON l.id=msi.library_id AND l.is_active AND l.media_type=msi.media_type
      AND l.media_server_id IS NOT DISTINCT FROM msi.media_server_id
    LEFT JOIN media_server ms ON ms.id=msi.media_server_id
    WHERE msi.id>$1 AND msi.media_type IN ('movie','tv') AND msi.tmdb_id>0
      AND (msi.media_server_id IS NULL OR ms.is_active)
      AND msi.inventory_tmdb_recovery->>'status'='open'
      AND msi.inventory_tmdb_recovery->>'category'='authentication'
      AND msi.inventory_tmdb_wakeup_generation IS DISTINCT FROM $2::uuid
      AND msi.inventory_tmdb_retry_after>clock_timestamp()
      AND msi.inventory_tmdb_attempted_at<=$3::timestamptz
      AND (msi.inventory_tmdb_lease_until IS NULL OR msi.inventory_tmdb_lease_until<=clock_timestamp())
      AND ${sourceConflictAuthorityExclusionForMediaServerItem('$4')}
    ORDER BY msi.id LIMIT 100 FOR UPDATE OF msi SKIP LOCKED`;

export const RELEASE_WAKEUP_ITEMS = `UPDATE media_server_items SET
    inventory_tmdb_retry_after=clock_timestamp()+make_interval(secs => 1+random()*59),
    inventory_tmdb_attempted_at=NULL, inventory_tmdb_wakeup_generation=$2::uuid
    WHERE id=ANY($1::integer[])`;
