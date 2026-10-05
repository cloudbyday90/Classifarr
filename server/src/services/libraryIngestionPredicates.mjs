/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { MEDIA_SYNC_OWNER_LOCK } from './mediaSyncLockKeys.mjs';

// Fixed SQL aliases: l = library, s = optional ownership ledger. No caller input.
export const INGESTION_OWNER_ACTIVE_SQL = `EXISTS (SELECT 1 FROM pg_locks lock
  WHERE lock.locktype='advisory' AND lock.classid=${MEDIA_SYNC_OWNER_LOCK}::oid
    AND lock.objid=l.id::oid AND lock.objsubid=2 AND lock.granted
    AND lock.database=(SELECT oid FROM pg_database WHERE datname=current_database()))`;

export const INGESTION_UNFINISHED_MARKERS_SQL = `(EXISTS (SELECT 1 FROM media_server_sync_status other
  WHERE other.library_id=l.id AND other.status IN ('pending','running'))
  OR EXISTS (SELECT 1 FROM media_source_capture_state c WHERE c.library_id=l.id AND c.phase='collecting'))`;

export const INGESTION_FOREIGN_MARKERS_SQL = `(EXISTS (SELECT 1 FROM media_server_sync_status other
  WHERE other.library_id=l.id AND other.status IN ('pending','running') AND other.id IS DISTINCT FROM s.sync_status_id)
  OR EXISTS (SELECT 1 FROM media_source_capture_state c WHERE c.library_id=l.id AND c.phase='collecting'
    AND (c.generation IS DISTINCT FROM s.capture_generation OR c.source<>'media_sync')))`;

// Admission hint only. Recovery revalidates the installed fence under transaction locks.
export const INGESTION_LEGACY_COMPATIBLE_SQL = `(${INGESTION_FOREIGN_MARKERS_SQL}
  AND NOT EXISTS (SELECT 1 FROM media_server_sync_status other WHERE other.library_id=l.id
    AND other.status IN ('pending','running') AND other.id IS DISTINCT FROM s.sync_status_id AND other.ingestion_protocol<>0)
  AND NOT EXISTS (SELECT 1 FROM media_source_capture_state c WHERE c.library_id=l.id AND c.phase='collecting'
    AND (c.generation IS DISTINCT FROM s.capture_generation OR c.source<>'media_sync') AND c.ingestion_protocol<>0))`;
