/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { ConflictError, ServiceUnavailableError } from '../utils/appError.mjs';
import { reviewSourceScope } from './sourceScopeReview.mjs';
import { readScopeEvidenceTarget } from './sourceScopeEvidenceRepository.mjs';
import { compareScopeEvidence, readScopeCatalog, scopeEvidenceDigest, scopeEvidencePlan, ScopeEvidenceError } from './sourceScopeCatalogEvidence.mjs';
import { CatalogEpisodeEvidenceError } from './catalogEpisodeEvidence.mjs';

const changed = () => new ConflictError('The source or catalog changed. Refresh items and review again.', { code: 'scope_evidence_changed' });
const unavailable = code => new ServiceUnavailableError('Evidence could not be checked. Nothing was saved.', { code });

export function createSourceScopeEvidenceService({ db, withLock, getMediaServerService, createCatalogProvider }) {
  return async function inspect(actorId, key, body, callerSignal) {
    // The structural check validates/copies all browser input before provider I/O.
    const offset = body?.offset;
    const draft = await reviewSourceScope(db, actorId, key, body);
    const input = { offset, sourceVersion: draft.sourceVersion, scope: draft.scope };
    const deadline = AbortSignal.timeout(90000);
    const signal = callerSignal ? AbortSignal.any([deadline, callerSignal]) : deadline;
    let result;
    try {
      signal.throwIfAborted();
      const acquired = await withLock(async lease => {
        const scopedSignal = lease?.signal ? AbortSignal.any([signal, lease.signal]) : signal;
        scopedSignal.throwIfAborted();
        const target = await readScopeEvidenceTarget(db, key, input.offset);
        if (!target || !target.is_active) throw changed();
        const targetDigest = scopeEvidenceDigest(target);
        const catalogProvider = await createCatalogProvider(target.catalog_config);
        await reviewSourceScope(db, actorId, key, input);
        const adapter = getMediaServerService(target.server_type);
        if (typeof adapter?.getLibraryItemLayout !== 'function') throw unavailable('scope_source_unavailable');
        const readSource = () => adapter.getLibraryItemLayout(target.url, target.api_key,
          target.library_external_id, target.external_id, { signal: scopedSignal });
        scopedSignal.throwIfAborted();
        const source = await readSource();
        scopedSignal.throwIfAborted();
        if (source.identity.mediaType !== target.media_type) throw changed();
        const plan = scopeEvidencePlan(source, draft.scope);
        const catalog = await readScopeCatalog(plan, catalogProvider, scopedSignal);
        const comparison = compareScopeEvidence(source, plan, catalog.catalog);
        const freshCatalog = await readScopeCatalog(plan, catalogProvider, scopedSignal);
        const freshSource = await readSource();
        scopedSignal.throwIfAborted();
        if (source.digest !== freshSource.digest || catalog.digest !== freshCatalog.digest ||
            targetDigest !== scopeEvidenceDigest(await readScopeEvidenceTarget(db, key, input.offset))) throw changed();
        await catalogProvider.recheck();
        await reviewSourceScope(db, actorId, key, input);
        scopedSignal.throwIfAborted();
        result = { ...draft, version: 'source_scope_evidence.v1', reference: randomUUID(),
          asOf: new Date().toISOString(), verification: 'typed_catalog_membership', crossProviderVerified: false,
          evidenceFingerprint: scopeEvidenceDigest([draft.draftFingerprint, source.digest, catalog.digest]),
          backfill: { eligible: false, excludedScope: 'all', reason: 'mapping_not_approved' },
          comparison };
      });
      if (!acquired) throw unavailable('scope_evidence_busy');
      signal.throwIfAborted();
      return result;
    } catch (error) {
      if (signal.aborted) throw unavailable(callerSignal?.aborted ? 'scope_evidence_cancelled' : 'scope_evidence_timed_out');
      if ([400, 403, 409].includes(error?.statusCode)) throw error;
      if (error instanceof ScopeEvidenceError) {
        if (error.code === 'source_seasons_changed') throw changed();
        throw unavailable(`scope_${error.code}`);
      }
      if (error instanceof CatalogEpisodeEvidenceError) throw unavailable('scope_catalog_invalid');
      if (['scope_evidence_busy', 'scope_source_unavailable'].includes(error?.code)) throw error;
      throw unavailable('scope_evidence_unavailable');
    }
  };
}
