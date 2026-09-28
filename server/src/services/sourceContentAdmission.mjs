/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createSourceContentCircuitRepository } from './sourceContentCircuitRepository.mjs';
import { sourceContentFailure, SourceContentDeferredError } from './sourceContentFailure.mjs';
import { preflightSourceEnumeration } from './sourceEnumerationPreflight.mjs';
export const SOURCE_CONTENT_PROBE_LOCK = 0x53435052;

export function createSourceContentAdmission({ db, source, owner }) {
  const repository = createSourceContentCircuitRepository(db, source);
  async function page(service, method, url, apiKey, libraryKey, options) {
    let locked = false, admission;
    const checkOwner = async () => { owner.signal?.throwIfAborted(); await owner.assertSource(source); };
    try {
      await checkOwner();
      admission = await repository.admit(async () => {
        const { rows: [row] } = await db.query('SELECT pg_try_advisory_lock($1::integer,$2::integer) AS acquired', [SOURCE_CONTENT_PROBE_LOCK, source.media_server_id]);
        locked = row.acquired === true;
        return locked;
      });
      const request = async (readMethod, ...args) => {
        try { return await service[readMethod](...args); }
        catch (error) {
          await checkOwner();
          const failure = sourceContentFailure(error);
          if (failure) throw await repository.fail(admission, failure);
          throw error;
        }
      };
      if (!admission.probe) {
        const result = await request(method, url, apiKey, libraryKey, options);
        await checkOwner();
        return result;
      }
      // A media-page success must not clear a collections outage (or vice versa).
      // The existing canary validates both operations, at most four two-item pages.
      await preflightSourceEnumeration({ service: {
        getLibraryPage: (...args) => request('getLibraryPage', ...args),
        getCollectionPage: (...args) => request('getCollectionPage', ...args),
      }, url, apiKey, libraryKey, batchSize: 2,
      owner: { signal: owner.signal, assertSource: checkOwner } });
      await checkOwner();
      await repository.settleProbe(admission, true);
    } catch (error) {
      owner.signal?.throwIfAborted();
      if (admission?.probe && !(error instanceof SourceContentDeferredError)) await repository.settleProbe(admission, false);
      throw error;
    } finally {
      if (locked && !owner.signal?.aborted) {
        const { rows: [row] } = await db.query('SELECT pg_advisory_unlock($1::integer,$2::integer) AS released', [SOURCE_CONTENT_PROBE_LOCK, source.media_server_id]);
        if (row.released !== true) throw new Error('source_content_probe_ownership_lost');
      }
    }
    // Re-admit the requested page after releasing the probe lock. Canary data
    // is not shared between runs or substituted for full enumeration.
    return page(service, method, url, apiKey, libraryKey, options);
  }
  return { check: () => repository.check(), page };
}
