/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archiveDatabaseClient } from './archiveDatabaseClient.mjs';
import { withOnlineArchiveSnapshot,assertArchiveSnapshot } from './onlineArchiveSnapshot.mjs';
import { checkCatalogReader } from './catalogReader.mjs';
import { captureScheduledCatalog } from './catalogCapture.mjs';
import { catalogSemanticRevision } from './catalogSchedule.mjs';
import { withCatalogSnapshotContent,freezeCatalogValue } from './catalogSnapshotContent.mjs';
import { gatewayError } from './errors.mjs';

/** Raw client and transaction control remain private, including during callbacks. */
export async function withOwnedCatalogSnapshot(configuration,consume,signal,previousRevisions = []) {
  const config = structuredClone(configuration), controller = new AbortController();
  const bounded = AbortSignal.any([controller.signal,AbortSignal.timeout(120000),...(signal ? [signal] : [])]);
  bounded.throwIfAborted();
  const source = archiveDatabaseClient(config.database,true,'classifarr-gateway-catalog-snapshot');
  let open = true, callbackFailed = false;
  const invalidate = () => { open = false; };
  const stop = () => { invalidate(); void source.end().catch(() => {}); };
  source.on('error',invalidate); source.on('end',invalidate); bounded.addEventListener('abort',stop,{once:true});
  try {
    await source.connect(); bounded.throwIfAborted();
    await checkCatalogReader(source,3);
    const identity = (await source.query('SELECT current_user AS role,current_database() AS database')).rows[0];
    if (identity.role !== config.database.user || identity.database !== config.database.database) throw gatewayError('gateway_catalog_reader_unsafe');
    return await withOnlineArchiveSnapshot(source,config,context => withCatalogSnapshotContent(source,context,bounded,async tables => {
      let pending, settled = false, used = false;
      const check = () => {
        bounded.throwIfAborted(); assertArchiveSnapshot(source,context);
        if (!open || source.getTransactionStatus() !== 'T') throw gatewayError('gateway_archive_snapshot_invalid');
      };
      const view = Object.freeze({report:freezeCatalogValue(structuredClone(context.report)),revision:context.revision,
        compatibleRevisions:Object.freeze([...context.compatibleRevisions]),semantic:catalogSemanticRevision(tables),signal:bounded,
        capture(options) {
          check();
          if (used || !options || Object.keys(options).sort().join(',') !== 'job,maintenance,paths') throw gatewayError('gateway_catalog_contract');
          used = true;
          const {job,paths} = structuredClone({job:options.job,paths:options.paths});
          pending = captureScheduledCatalog({source,context,configuration:config,maintenance:options.maintenance,job,paths,signal:bounded})
            .then(result => {check(); return result;}).finally(() => {settled = true;});
          // A forgotten await must not leak an unhandled rejection or outlive ownership.
          void pending.catch(() => {}); return pending;
        },
      });
      try {
        check(); let result;
        try { result = await consume(view); }
        catch (error) { callbackFailed = true; throw error; }
        check();
        if (pending && !settled) throw gatewayError('gateway_archive_snapshot_invalid');
        return result;
      } finally {
        invalidate();
        if (pending && !settled) controller.abort();
        await pending?.catch(() => {});
      }
    }),bounded,previousRevisions);
  } catch (error) {
    if (bounded.aborted && !callbackFailed) throw gatewayError('gateway_archive_cancelled');
    throw error;
  } finally {
    invalidate(); bounded.removeEventListener('abort',stop);
    await source.end(); source.removeListener('error',invalidate); source.removeListener('end',invalidate);
  }
}
