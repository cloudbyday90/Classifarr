/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const FENCE_TABLES = Object.freeze([
  'media_server_items', 'media_server_sync_status', 'media_source_capture_state',
  'library_ingestion_state', 'media_source_observations', 'media_server_collections',
]);

/** This candidate is deliberately not a production migration or startup hook. */
export async function assertFenceRehearsalDatabase(db) {
  if (process.env.NODE_ENV !== 'test' || !process.env.CLASSIFARR_INTEGRATION_RUN_ID) {
    throw new Error('ingestion_fence_requires_disposable_integration_database');
  }
  const { rows: [row] } = await db.query('SELECT current_database() AS database');
  if (!/^classifarr_suite_[a-f0-9]{12}$/.test(row?.database ?? '')) {
    throw new Error('ingestion_fence_database_rejected');
  }
}

export function fenceRole(value) {
  if (!/^cf_fence_(owner|writer|legacy)_[a-f0-9]{12}$/.test(value)) {
    throw new Error('ingestion_fence_role_rejected');
  }
  return value;
}
