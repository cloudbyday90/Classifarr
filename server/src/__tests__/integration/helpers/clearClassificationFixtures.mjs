/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Only for the disposable, per-suite integration database. Parent DELETE is the
// supported evidence lifecycle: TRUNCATE CASCADE reaches protected tombstones
// even when their tables are empty. Leave all production guards enabled.
export async function clearClassificationHistoryFixtures(pool) {
  await pool.query(`
    DELETE FROM clarification_responses;
    DELETE FROM content_analysis_log;
    DELETE FROM media_requests;
    DELETE FROM webhook_log;
    DELETE FROM classification_history;
  `);
}

export async function clearMediaCatalogFixtures(pool) {
  await clearClassificationHistoryFixtures(pool);
  await pool.query(`
    DELETE FROM media_server_sync_status;
    DELETE FROM media_server_items;
    DELETE FROM libraries;
    DELETE FROM media_server;
  `);
}
