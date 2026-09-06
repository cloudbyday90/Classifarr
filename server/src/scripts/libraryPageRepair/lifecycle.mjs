/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { PAGE_REPAIR_LIMITS } from './contract.mjs';

/** Called under the publication lock; selected-library restart reasons remain observable. */
export async function reclaimIdlePageRepair(db, ns, libraryId, now) {
    const threshold = new Date(Date.parse(now) - PAGE_REPAIR_LIMITS.maxAgeMs).toISOString();
    await db.query(`DELETE FROM ${ns}.page_repair_state
        WHERE library_id<>$1 AND last_observed_at<$2::timestamptz`, [libraryId, threshold]);
}

/** The cursor and journal preserve insert detection after an empty range is reclaimed. */
export async function persistPageRepairProjection(db, ns, libraryId, pageId, projection, now) {
    if (projection.counts.inventory === 0) {
        await db.query(`DELETE FROM ${ns}.page_repair_pages WHERE library_id=$1 AND page_id=$2`, [libraryId, pageId]);
        return;
    }
    await db.query(`INSERT INTO ${ns}.page_repair_pages(library_id,page_id,counts,digest,measured_at,expires_at)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(library_id,page_id) DO UPDATE
        SET counts=EXCLUDED.counts,digest=EXCLUDED.digest,measured_at=EXCLUDED.measured_at,expires_at=EXCLUDED.expires_at,dirty_since=NULL`,
    [libraryId, pageId, projection.counts, projection.digest, now, projection.expiresAt]);
}
