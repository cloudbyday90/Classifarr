/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceConflictAuthorityPredicateForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

// Shared list/link population. A source change clears recovery through the existing trigger.
const SCOPE = `FROM media_server_items msi
    JOIN libraries l ON l.id=msi.library_id AND l.is_active
      AND l.media_server_id IS NOT DISTINCT FROM msi.media_server_id
    LEFT JOIN media_server ms ON ms.id=msi.media_server_id
    WHERE msi.media_type IN ('movie','tv') AND l.media_type=msi.media_type
      AND (msi.media_server_id IS NULL OR ms.is_active)
      AND msi.inventory_tmdb_recovery->>'status'='open'
      AND msi.inventory_tmdb_recovery->>'tmdb_id'=msi.tmdb_id::text
      AND msi.inventory_tmdb_recovery->>'media_type'=msi.media_type`;

export const INVENTORY_RECOVERY_PAGE = `WITH cases AS MATERIALIZED (
    SELECT msi.id,msi.media_type ${SCOPE}
), selected AS (SELECT id FROM cases WHERE id>$1 ORDER BY id LIMIT 26), page AS (
    SELECT msi.id,msi.title,msi.year,msi.media_type,msi.tmdb_id,l.name AS library_name,
      ms.type AS server_type,msi.inventory_tmdb_recovery AS recovery,
      msi.inventory_tmdb_retry_after AS retry_after,
      msi.inventory_tmdb_lease_until AS lease_until,
      ${sourceConflictAuthorityPredicateForMediaServerItem('$2')} AS source_blocked
    FROM selected JOIN media_server_items msi ON msi.id=selected.id
    JOIN libraries l ON l.id=msi.library_id
    LEFT JOIN media_server ms ON ms.id=msi.media_server_id
)
SELECT statement_timestamp() AS as_of,
    (SELECT COUNT(*)::integer FROM cases) AS total,
    (SELECT COUNT(*)::integer FROM cases WHERE media_type='movie') AS movies,
    (SELECT COUNT(*)::integer FROM cases WHERE media_type='tv') AS tv,
    COALESCE((SELECT jsonb_agg(page ORDER BY id) FROM page),'[]'::jsonb) AS items`;

export const INVENTORY_RECOVERY_LINK_SOURCE = `SELECT msi.id, msi.external_id,
    msi.xmin::text AS item_revision,l.xmin::text AS library_revision,
    ms.xmin::text AS server_revision,ms.id AS server_id,ms.type,ms.url,ms.api_key
    ${SCOPE} AND msi.id=$1 AND msi.inventory_tmdb_recovery->>'case_id'=$2`;
