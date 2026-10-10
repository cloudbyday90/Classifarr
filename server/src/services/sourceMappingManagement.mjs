/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError, ValidationError } from '../utils/appError.mjs';
import { MEDIA_SYNC_OWNER_LOCK } from './mediaSyncLockKeys.mjs';
import { reviewBody, reviewPreviewId, reviewInteger } from './mediaIdentityReviewContract.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { sourceMappingDiagnostic } from './sourceMappingDiagnostics.mjs';

/** Read committed state after an uncertain response; never retry approval automatically. */
export function createSourceMappingManagement(db) {
  return {
    async listSourceMappings(actorId, query = {}) {
      await requireReviewActor(db, reviewInteger(actorId));
      if (Object.keys(query).some(key => key !== 'offset') ||
          (query.offset !== undefined && !/^(0|[1-9]\d{0,8})$/.test(String(query.offset)))) throw new ValidationError('Invalid mapping page');
      const offset = Number(query.offset ?? 0);
      const { rows } = await db.query(`SELECT m.id,m.scope,m.approved_at,m.revoked_at,m.materialized_at,
        m.retry_after,m.last_outcome,l.name AS library_name,
        COALESCE(o.title,i.title) AS title,
        (o.external_id IS NULL AND i.metadata->'source_catalog_mapping'->>'id'=m.id::text
          AND l.is_active AND m.materialized_at>statement_timestamp()-interval '30 days') AS current_receipt
        FROM source_catalog_mappings m JOIN libraries l ON l.id=m.library_id
        LEFT JOIN media_server_items i ON i.library_id=m.library_id AND i.media_server_id=m.media_server_id AND i.external_id=m.external_id
        LEFT JOIN media_source_observations o ON o.library_id=m.library_id AND o.media_server_id=m.media_server_id AND o.external_id=m.external_id
        ORDER BY m.approved_at DESC,m.id LIMIT 51 OFFSET $1`, [offset]);
      return { version: 'source_mappings.v1', offset, hasMore: rows.length > 50, items: rows.slice(0, 50).map(row => ({
        id: row.id, title: row.title?.slice(0, 500) ?? 'Source item', libraryName: row.library_name?.slice(0, 500),
        scope: row.scope, approvedAt: row.approved_at, retryAfter: row.retry_after,
        diagnostic: row.revoked_at ? null : sourceMappingDiagnostic(row.last_outcome),
        status: row.revoked_at ? 'revoked' : sourceMappingDiagnostic(row.last_outcome) ? 'verification_deferred'
          : row.materialized_at && row.current_receipt ? 'materialized' : 'awaiting_sync',
      })) };
    },
    async revokeSourceMapping(actorId, rawId, body) {
      const id = reviewPreviewId(rawId);
      reviewBody(body, ['confirmed']);
      if (body.confirmed !== true) throw new ValidationError('Explicit revocation confirmation is required');
      return db.withTransaction(async tx => {
        await tx.query("SET LOCAL statement_timeout='5s'"); await tx.query("SET LOCAL lock_timeout='1s'");
        await requireReviewActor(tx, reviewInteger(actorId), true);
        const initial = (await tx.query('SELECT library_id FROM source_catalog_mappings WHERE id=$1', [id])).rows[0];
        if (!initial) throw new NotFoundError('Mapping not found');
        const lock = await tx.query('SELECT pg_try_advisory_xact_lock($1::integer,$2::integer) AS acquired', [MEDIA_SYNC_OWNER_LOCK,initial.library_id]);
        if (!lock.rows[0]?.acquired) throw new ConflictError('A library sync is active. Check saved mappings and retry revocation after it finishes.', { code: 'mapping_ingestion_active' });
        await tx.query('SELECT library_id FROM media_source_capture_state WHERE library_id=$1 FOR UPDATE', [initial.library_id]);
        const mapping = (await tx.query('SELECT * FROM source_catalog_mappings WHERE id=$1 FOR UPDATE', [id])).rows[0];
        if (!mapping) throw new NotFoundError('Mapping not found');
        if (mapping.revoked_at) return { version: 'source_mapping_revocation.v1', mappingId: id, status: 'revoked' };
        // Only invalidate inventory still bearing this receipt; never overwrite a newer source identity.
        const changed = await tx.query(`UPDATE media_server_items SET tmdb_id=NULL,imdb_id=NULL,tvdb_id=NULL,
          metadata=metadata-'source_catalog_mapping'-'inventory_tmdb'-'tmdb_identity_origin'-'source_identity_recovery'-'tmdb_resolution',
          inventory_tmdb_attempted_at=NULL,inventory_tmdb_fetched_at=NULL
          WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3 AND metadata->'source_catalog_mapping'->>'id'=$4
          RETURNING title,year,media_type`, [mapping.library_id,mapping.media_server_id,mapping.external_id,id]);
        if (changed.rows.length) {
          const item = changed.rows[0];
          await tx.query(`INSERT INTO media_source_observations
            (library_id,media_server_id,external_id,title,year,media_type,identity_issue,provider_fields,generation,source_digest)
            SELECT library_id,media_server_id,$3,$4,$5,$6,'conflicting_provider_ids',$7,generation,$8
            FROM media_source_capture_state WHERE library_id=$1 AND media_server_id=$2
            ON CONFLICT (library_id,media_server_id,external_id) DO NOTHING`,
          [mapping.library_id,mapping.media_server_id,mapping.external_id,item.title,item.year,item.media_type,mapping.provider_fields,mapping.source_digest]);
        }
        await tx.query("UPDATE source_catalog_mappings SET revoked_at=clock_timestamp(),last_outcome='revoked' WHERE id=$1", [id]);
        await tx.query("INSERT INTO audit_log(user_id,action,metadata) VALUES ($1,'source_mapping_revoked',$2::jsonb)",
          [actorId,JSON.stringify({ version: 1, mappingId: id })]);
        return { version: 'source_mapping_revocation.v1', mappingId: id, status: 'revoked' };
      });
    },
  };
}
