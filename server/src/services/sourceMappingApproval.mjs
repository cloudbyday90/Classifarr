/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { ConflictError, ValidationError } from '../utils/appError.mjs';
import { reviewBody } from './mediaIdentityReviewContract.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { reviewSourceScope } from './sourceScopeReview.mjs';
import { readScopeEvidenceTarget } from './sourceScopeEvidenceRepository.mjs';
import { scopeEvidenceDigest } from './sourceScopeCatalogEvidence.mjs';
import { createSourceScopeEvidenceService } from './sourceScopeEvidenceService.mjs';
import { approvedScopeDocuments, sourceMappingConfiguration } from './sourceMappingContract.mjs';

const changed = () => new ConflictError('Evidence changed. Check the mapping again before approval.', { code: 'scope_evidence_changed' });

/** The browser can express intent, but cannot supply the evidence being stored. */
export function createSourceMappingApproval(deps) {
  return async (actorId, key, body, signal) => {
    reviewBody(body, ['offset', 'sourceVersion', 'scope', 'evidenceFingerprint', 'confirmed']);
    if (body.confirmed !== true || !/^[a-f0-9]{64}$/.test(body.evidenceFingerprint ?? '')) {
      throw new ValidationError('Explicit confirmation of current evidence is required');
    }
    const expected = body.evidenceFingerprint;
    const inspect = createSourceScopeEvidenceService({ ...deps, onVerified: async verified => {
      const { target, source, catalog, result, input } = verified;
      const { comparison } = result;
      if (result.evidenceFingerprint !== expected || source.identity.snapshotDigest !== target.source_digest) throw changed();
      if (!comparison.total || comparison.matched !== comparison.total || comparison.exclusions.length) {
        throw new ConflictError('Every source item must match the approved scope.', { code: 'scope_incomplete' });
      }
      const documents = approvedScopeDocuments(result.scope, target.media_type, catalog);
      return deps.db.withTransaction(async tx => {
        await tx.query("SET LOCAL statement_timeout='5s'");
        await tx.query("SET LOCAL lock_timeout='1s'");
        await requireReviewActor(tx, actorId, true);
        // Consistent source-before-observation order; no provider IO in this transaction.
        await tx.query('SELECT library_id FROM media_source_capture_state WHERE library_id=$1 FOR SHARE', [target.library_id]);
        await tx.query('SELECT id FROM media_server WHERE id=$1 FOR SHARE', [target.media_server_id]);
        await tx.query('SELECT id FROM libraries WHERE id=$1 FOR SHARE', [target.library_id]);
        await tx.query(`SELECT external_id FROM media_source_observations
          WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3 FOR UPDATE`,
        [target.library_id, target.media_server_id, target.external_id]);
        if (target.catalog_config?.id) await tx.query('SELECT id FROM tmdb_config WHERE id=$1 FOR SHARE', [target.catalog_config.id]);
        await reviewSourceScope(tx, actorId, key, input);
        if (scopeEvidenceDigest(await readScopeEvidenceTarget(tx, key, input.offset)) !== scopeEvidenceDigest(target)) throw changed();
        verified.signal.throwIfAborted();
        const existing = (await tx.query(`SELECT id, evidence_fingerprint, revoked_at FROM source_catalog_mappings
          WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3 FOR UPDATE`,
        [target.library_id, target.media_server_id, target.external_id])).rows[0];
        if (existing && !existing.revoked_at) {
          if (existing.evidence_fingerprint !== expected) throw new ConflictError('Revoke the existing mapping before replacing it.', { code: 'scope_already_approved' });
          return { version: 'source_mapping_approval.v1', mappingId: existing.id, status: 'approved', materialized: false };
        }
        const id = randomUUID();
        await tx.query(`INSERT INTO source_catalog_mappings
          (id,library_id,media_server_id,external_id,media_type,source_digest,layout_digest,configuration_digest,evidence_fingerprint,scope,documents,approved_by,provider_fields)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13)
          ON CONFLICT (library_id,media_server_id,external_id) DO UPDATE SET id=EXCLUDED.id,
            media_type=EXCLUDED.media_type,source_digest=EXCLUDED.source_digest,layout_digest=EXCLUDED.layout_digest,
            configuration_digest=EXCLUDED.configuration_digest,evidence_fingerprint=EXCLUDED.evidence_fingerprint,
            scope=EXCLUDED.scope,documents=EXCLUDED.documents,approved_by=EXCLUDED.approved_by,
            approved_at=clock_timestamp(),revoked_at=NULL,materialized_at=NULL,catalog_verified_at=NULL,retry_after=NULL,
            provider_fields=EXCLUDED.provider_fields,last_outcome=NULL`,
        [id,target.library_id,target.media_server_id,target.external_id,target.media_type,target.source_digest,
          source.digest,sourceMappingConfiguration(target),expected,JSON.stringify(result.scope),JSON.stringify(documents),actorId,target.provider_fields]);
        await tx.query(`INSERT INTO audit_log(user_id,action,metadata) VALUES ($1,'source_mapping_approved',$2::jsonb)`,
          [actorId,JSON.stringify({ version: 1, mappingId: id, libraryId: target.library_id, scope: result.scope, evidenceFingerprint: expected })]);
        verified.signal.throwIfAborted();
        return { version: 'source_mapping_approval.v1', mappingId: id, status: 'approved', materialized: false };
      });
    } });
    return inspect(actorId, key, { offset: body.offset, sourceVersion: body.sourceVersion, scope: body.scope }, signal);
  };
}
