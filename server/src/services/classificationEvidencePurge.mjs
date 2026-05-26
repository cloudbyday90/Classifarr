import { ValidationError } from '../utils/appError.mjs';
import { resolveExecutor } from '../utils/dbUtils.mjs';

export async function purgeByFilter(db, { scope = null, provenance = null, status = null, libraryId = null, mediaType = null, client = null } = {}) {
  const executor = resolveExecutor(client, db);
  const conditions = [];
  const params = [];

  if (scope) {
    params.push(scope);
    conditions.push(`scope = $${params.length}`);
  }
  if (provenance) {
    params.push(provenance);
    conditions.push(`provenance = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (libraryId != null) {
    params.push(libraryId);
    conditions.push(`library_id = $${params.length}`);
  }
  if (mediaType) {
    params.push(mediaType);
    conditions.push(`media_type = $${params.length}`);
  }

  if (conditions.length === 0) {
    throw new ValidationError('purgeByFilter: at least one filter is required to prevent accidental full-table delete');
  }

  const result = await executor.query(
    `DELETE FROM classification_evidence WHERE ${conditions.join(' AND ')}`,
    params
  );
  return { deleted: result.rowCount ?? 0 };
}

export async function purgeByTmdbId(db, { tmdbId, mediaType = null, scopes = [], client = null }) {
  if (!tmdbId) return { deleted: 0 };
  const executor = resolveExecutor(client, db);

  const conditions = ['tmdb_id = $1'];
  const params = [tmdbId];

  if (mediaType) {
    params.push(mediaType);
    conditions.push(`media_type = $${params.length}`);
  }

  if (scopes.length > 0) {
    params.push(scopes);
    conditions.push(`scope = ANY($${params.length})`);
  }

  const result = await executor.query(
    `DELETE FROM classification_evidence WHERE ${conditions.join(' AND ')}`,
    params
  );
  return { deleted: result.rowCount ?? 0 };
}

export async function purgeAll(db, { client = null } = {}) {
  const executor = resolveExecutor(client, db);
  const result = await executor.query('DELETE FROM classification_evidence');
  return { deleted: result.rowCount ?? 0 };
}
