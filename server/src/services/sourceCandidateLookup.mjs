/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { ConflictError, ForbiddenError, ServiceUnavailableError, ValidationError } from '../utils/appError.mjs';
import { reviewBody, reviewInteger } from './mediaIdentityReviewContract.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { readSourceIdentityIssues } from './sourceIdentityIssues.mjs';
import { readScopeEvidenceTarget } from './sourceScopeEvidenceRepository.mjs';
import { scopeEvidenceDigest } from './sourceScopeCatalogEvidence.mjs';
import { candidateDeclarations, readSourceCandidates, SourceCandidateError } from './sourceCandidateProjection.mjs';

const changed = () => new ConflictError('The source changed. Refresh items and try again.', { code: 'candidate_source_changed' });

/** Read-only candidate assistance; deliberately has no approval or recovery dependency. */
export function createSourceCandidateLookup({ db, withLock, getMediaServerService, createCatalogProvider }) {
  return async (actorId, key, body, callerSignal) => {
    reviewInteger(actorId); reviewBody(body, ['offset', 'sourceVersion']);
    if (!/^[a-f0-9]{64}$/.test(key) || typeof key !== 'string' ||
        typeof body.sourceVersion !== 'string' || !/^[a-f0-9]{64}$/.test(body.sourceVersion) ||
        !Number.isSafeInteger(body.offset) || body.offset < 0 || body.offset > 999999999) {
      throw new ValidationError('Invalid candidate lookup');
    }
    const input = { offset: body.offset, sourceVersion: body.sourceVersion };
    const check = async () => {
      await requireReviewActor(db, actorId);
      const page = await readSourceIdentityIssues(db, input.offset);
      const item = page.items.find(value => value.key === key);
      if (!item || item.issue !== 'conflicting_provider_ids' || item.sourceVersion !== input.sourceVersion) throw changed();
      return item;
    };
    await check();
    const deadline = AbortSignal.timeout(60000);
    const signal = callerSignal ? AbortSignal.any([deadline, callerSignal]) : deadline;
    let result;
    try {
      signal.throwIfAborted();
      const acquired = await withLock(async lease => {
        const scopedSignal = lease?.signal ? AbortSignal.any([signal, lease.signal]) : signal;
        scopedSignal.throwIfAborted();
        await check();
        const target = await readScopeEvidenceTarget(db, key, input.offset);
        if (!target?.is_active) throw changed();
        const targetDigest = scopeEvidenceDigest(target);
        const adapter = getMediaServerService(target.server_type);
        if (typeof adapter?.getLibraryItemIdentityEvidence !== 'function') throw new SourceCandidateError('source_invalid');
        const read = () => adapter.getLibraryItemIdentityEvidence(target.url, target.api_key,
          target.library_external_id, target.external_id, { signal: scopedSignal });
        const source = await read();
        scopedSignal.throwIfAborted();
        candidateDeclarations(source);
        if (source.mediaType !== target.media_type || source.snapshotDigest !== target.source_digest) throw changed();
        const provider = await createCatalogProvider(target.catalog_config);
        const found = await readSourceCandidates(source, provider, scopedSignal);
        const fresh = await read();
        scopedSignal.throwIfAborted();
        if (scopeEvidenceDigest(source) !== scopeEvidenceDigest(fresh) ||
            targetDigest !== scopeEvidenceDigest(await readScopeEvidenceTarget(db, key, input.offset))) throw changed();
        await provider.recheck();
        await check();
        scopedSignal.throwIfAborted();
        result = { version: 'source_candidates.v1', reference: randomUUID(), asOf: new Date().toISOString(),
          sourceKey: key, sourceVersion: input.sourceVersion, mediaType: source.mediaType,
          canApply: false, persisted: false, ...found };
      });
      if (!acquired) throw new SourceCandidateError('busy');
      signal.throwIfAborted();
      return result;
    } catch (error) {
      if (error instanceof ForbiddenError) throw new ForbiddenError('An active administrator account is required');
      if (error instanceof ConflictError) throw changed();
      const code = signal.aborted ? (callerSignal?.aborted ? 'cancelled' : 'timed_out')
        : error instanceof SourceCandidateError ? error.code : 'unavailable';
      throw new ServiceUnavailableError('Candidate lookup did not complete. Nothing was saved.', { code: `candidate_${code}` });
    }
  };
}
