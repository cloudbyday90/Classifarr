/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { READ_SYNC_ITEM, UPSERT_SYNC_ITEM } from '../../services/mediaSyncItemQueries.mjs';

/** Bind only known table clauses; every production column, retention expression and xmin guard stays intact. */
export function scopedSyncQueries() {
    const readTarget = 'FROM media_server_items WHERE', writeTarget = 'INSERT INTO media_server_items\n';
    if (READ_SYNC_ITEM.split(readTarget).length !== 2 || !UPSERT_SYNC_ITEM.startsWith(writeTarget)) throw new Error('Unsupported sync SQL contract');
    return {
        read: READ_SYNC_ITEM.replace(readTarget, 'FROM scoped_repair_lab.scoped_repair_source WHERE'),
        upsert: UPSERT_SYNC_ITEM.replace(writeTarget, 'INSERT INTO scoped_repair_lab.scoped_repair_source AS media_server_items\n'),
        membership: `SELECT library_id,xmin::text AS source_revision FROM scoped_repair_lab.scoped_repair_source
            WHERE media_server_id=$1 AND external_id=$2`
    };
}
