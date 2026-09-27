/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError, ServiceUnavailableError } from '../utils/appError.mjs';
import { readLegacyIngestion } from './legacyIngestionRepository.mjs';

export async function readArchiveLibrary(db, libraryId) {
  const { rows: [library] } = await db.query('SELECT * FROM libraries WHERE id=$1', [libraryId]);
  if (!library) throw new NotFoundError('Library not found');
  return library;
}

export async function readArchiveSnapshot(db, libraryId, lock = false) {
  const snapshot = await readLegacyIngestion(db, libraryId, lock);
  const library = await readArchiveLibrary(db, libraryId);
  const { rows: [count] } = await db.query('SELECT count(*)::int AS total FROM media_server_items WHERE library_id=$1', [libraryId]);
  return { ...snapshot, library: { ...snapshot.library, external_id: library.external_id, archived_at: library.archived_at }, itemCount: count.total };
}

export async function readArchiveReceipt(db, request) {
  const { rows: [row] } = await db.query(`SELECT id,created_at,user_id,metadata FROM audit_log
    WHERE action='library_archive_changed' AND metadata->>'requestId'=$1`, [request.requestId]);
  if (!row) return null;
  const data = row.metadata;
  if (data?.version !== 1 || !['archive', 'restore'].includes(data.operation) || data.workersStopped !== true) {
    throw new ServiceUnavailableError('Archive receipt could not be verified');
  }
  if (row.user_id !== request.actorId || data.libraryId !== request.libraryId ||
      request.revision && (data.revision !== request.revision || data.operation !== request.operation)) {
    throw new ConflictError('Confirmation ID belongs to another archive review');
  }
  return { auditId: row.id, confirmedAt: row.created_at, requestId: request.requestId,
    libraryId: request.libraryId, operation: data.operation, enabled: false };
}

export async function changeLibraryArchive(db, request) {
  await db.query(`UPDATE libraries SET archived_at=CASE WHEN $2='archive' THEN clock_timestamp() ELSE NULL END,
    is_active=false,updated_at=clock_timestamp() WHERE id=$1`, [request.libraryId, request.operation]);
  const { rows: [audit] } = await db.query(`INSERT INTO audit_log(user_id,action,metadata)
    VALUES ($1,'library_archive_changed',$2::jsonb) RETURNING id,created_at`, [request.actorId, JSON.stringify({
    version: 1, libraryId: request.libraryId, requestId: request.requestId, operation: request.operation,
    revision: request.revision, workersStopped: true,
  })]);
  return { auditId: audit.id, confirmedAt: audit.created_at, requestId: request.requestId,
    libraryId: request.libraryId, operation: request.operation, enabled: false };
}
