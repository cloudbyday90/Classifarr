/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceMappingConfiguration, approvedScopeDocuments } from './sourceMappingContract.mjs';
import { scopeEvidencePlan, readScopeCatalog, compareScopeEvidence } from './sourceScopeCatalogEvidence.mjs';
import { sourceMetadata } from './mediaSourceIdentity.mjs';
import { SourceMappingCheckError, sourceMappingFailureCode } from './sourceMappingDiagnostics.mjs';

export const READ_SOURCE_MAPPING = `SELECT m.*, m.retry_after>clock_timestamp() AS retry_pending, l.external_id AS library_external_id,
  s.type AS server_type,s.url,s.api_key,s.is_active,
  (SELECT jsonb_build_object('id',t.id,'active',t.is_active,'key',t.api_key)
   FROM tmdb_config t ORDER BY (t.is_active IS TRUE) DESC,t.id DESC LIMIT 1) AS catalog_config
  FROM source_catalog_mappings m JOIN libraries l ON l.id=m.library_id AND l.media_server_id=m.media_server_id
  JOIN media_server s ON s.id=m.media_server_id
  WHERE m.library_id=$1 AND m.media_server_id=$2 AND m.external_id=$3
    AND m.revoked_at IS NULL AND l.is_active AND s.is_active AND l.media_type=m.media_type`;

/** A separate, durable budget for explicitly approved intent; no retry counter reset. */
export function createSourceMappingRecovery({ store, context, source, createCatalogProvider }) {
  let attempts = 0, layoutReads = 0, admittedIds = null, layoutIds = null;
  return async item => {
    if (item?.provider_identity_invalid !== true || !item.source_identity_evidence) return null;
    let mapping;
    await store.withCurrentCapture(context, async tx => {
      mapping = (await tx.query(READ_SOURCE_MAPPING, [context.libraryId, context.mediaServerId, item.external_id])).rows[0];
    });
    if (!mapping) return null;
    const refused = { handled: true, proof: null };
    if (mapping.retry_pending) return refused;
    if (layoutIds === null) await store.withCurrentCapture(context, async tx => {
      const { rows } = await tx.query(`SELECT id FROM source_catalog_mappings WHERE library_id=$1 AND media_server_id=$2
        AND revoked_at IS NULL AND (retry_after IS NULL OR retry_after<=clock_timestamp())
        ORDER BY materialized_at NULLS FIRST,attempt_count,approved_at,id LIMIT 20`, [context.libraryId,context.mediaServerId]);
      layoutIds = new Set(rows.map(row => row.id));
    });
    if (!layoutIds?.has(mapping.id)) return refused;
    if (layoutReads >= 20) return refused;
    const deadline = AbortSignal.timeout(90000);
    const signal = source.signal ? AbortSignal.any([source.signal, deadline]) : deadline;
    const recordFailure = code => store.withCurrentCapture(context, tx => tx.query(`UPDATE source_catalog_mappings
      SET last_outcome=$2,retry_after=COALESCE(retry_after,clock_timestamp()+interval '1 day')
      WHERE id=$1 AND revoked_at IS NULL`, [mapping.id, `deferred:${code}`]));
    const read = () => source.service.getLibraryItemLayout(source.url, source.apiKey,
      source.libraryKey, item.external_id, { signal });
    const validConfiguration = mapping.source_digest === item.source_identity_evidence.snapshotDigest &&
      mapping.configuration_digest === sourceMappingConfiguration(mapping);
    // Reuse catalog evidence only after a fresh, complete source layout matches it.
    // Its catalog timestamp is not extended by reuse, so provider refresh cannot starve.
    const verifiedAt = new Date(mapping.catalog_verified_at).getTime();
    if (validConfiguration && verifiedAt > Date.now() - 86400000 && verifiedAt <= Date.now()) {
      layoutReads++;
      try {
        const layout = await read(); signal.throwIfAborted();
        if (layout.digest === mapping.layout_digest && layout.identity.snapshotDigest === mapping.source_digest) {
          return recoveredProof(item, mapping, layout.digest, mapping.documents, mapping.catalog_verified_at);
        }
      } catch (error) {
        source.signal?.throwIfAborted();
        // Cached verification is still a provider attempt; retain its failure across restarts.
        await store.withCurrentCapture(context, tx => tx.query(`UPDATE source_catalog_mappings
          SET retry_after=clock_timestamp()+interval '1 day',attempt_count=LEAST(attempt_count+1,1000000),last_outcome=$2
          WHERE id=$1 AND revoked_at IS NULL`, [mapping.id, `deferred:${sourceMappingFailureCode(error, 'source', signal)}`]));
        return refused;
      }
    }
    if (attempts >= 4) return refused;
    if (admittedIds === null) await store.withCurrentCapture(context, async tx => {
      const { rows } = await tx.query(`SELECT id FROM source_catalog_mappings WHERE library_id=$1 AND media_server_id=$2
        AND revoked_at IS NULL AND (retry_after IS NULL OR retry_after<=clock_timestamp())
        ORDER BY catalog_verified_at NULLS FIRST,attempt_count,approved_at,id LIMIT 4`, [context.libraryId,context.mediaServerId]);
      admittedIds = new Set(rows.map(row => row.id));
    });
    if (!admittedIds?.has(mapping.id)) return refused;
    let claimed = false;
    await store.withCurrentCapture(context, async tx => {
      claimed = (await tx.query(`UPDATE source_catalog_mappings SET retry_after=clock_timestamp()+interval '1 day',
        attempt_count=LEAST(attempt_count+1,1000000),last_outcome='checking'
        WHERE id=$1 AND revoked_at IS NULL AND (retry_after IS NULL OR retry_after<=clock_timestamp()) RETURNING id`, [mapping.id])).rowCount === 1;
    });
    if (!claimed) return refused;
    attempts++;
    let stage = 'validation';
    try {
      if (mapping.source_digest !== item.source_identity_evidence.snapshotDigest) throw new SourceMappingCheckError('source_changed');
      if (!validConfiguration) throw new SourceMappingCheckError('configuration_changed');
      stage = 'catalog';
      const provider = await createCatalogProvider(mapping.catalog_config);
      layoutReads++;
      stage = 'source';
      const layout = await read();
      stage = 'validation';
      if (layout.identity.snapshotDigest !== mapping.source_digest) throw new SourceMappingCheckError('source_changed');
      const plan = scopeEvidencePlan(layout, mapping.scope);
      stage = 'catalog';
      const catalog = await readScopeCatalog(plan, provider, signal);
      stage = 'validation';
      const comparison = compareScopeEvidence(layout, plan, catalog.catalog);
      if (!comparison.total) throw new SourceMappingCheckError('empty_source');
      if (comparison.matched !== comparison.total || comparison.exclusions.length) {
        throw new SourceMappingCheckError(comparison.exclusions[0]?.reason);
      }
      stage = 'catalog';
      const freshCatalog = await readScopeCatalog(plan, provider, signal);
      stage = 'source';
      const fresh = await read();
      stage = 'validation';
      if (layout.digest !== fresh.digest) throw new SourceMappingCheckError('source_changed');
      if (catalog.digest !== freshCatalog.digest) throw new SourceMappingCheckError('catalog_changed');
      stage = 'catalog';
      await provider.recheck();
      signal.throwIfAborted();
      stage = 'validation';
      return recoveredProof(item, mapping, layout.digest,
        approvedScopeDocuments(mapping.scope, mapping.media_type, catalog), new Date().toISOString());
    } catch (error) {
      source.signal?.throwIfAborted();
      await recordFailure(sourceMappingFailureCode(error, stage, signal));
      return refused;
    }
  };
}

function recoveredProof(item, mapping, layoutDigest, documents, catalogVerifiedAt) {
  const recovered = { ...structuredClone(item), tmdb_id: mapping.scope.kind === 'whole_work' ? mapping.scope.tmdbId : null,
    imdb_id: null, tvdb_id: null, metadata: sourceMetadata(item.metadata) };
  delete recovered.provider_identity_invalid;
  delete recovered.provider_identity_issue;
  delete recovered.provider_identity_field;
  delete recovered.source_identity_evidence;
  return { handled: true, proof: { item: recovered, mapping, layoutDigest, documents, catalogVerifiedAt } };
}
