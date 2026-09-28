/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readLibraryCatalogSource, fetchLibraryCatalog } from './libraryCatalogContext.mjs';
import { createLibraryDiscoveryStatusRepository } from './libraryDiscoveryStatusRepository.mjs';
import { createLogger } from '../utils/logger.mjs';
import { admitCatalogRecovery } from './libraryCatalogRecoveryPolicy.mjs';
const logger = createLogger('LibraryDiscovery');

/**
 * Manual diagnostics are best-effort; automatic admission must be durable.
 * @param {*} db @param {Function} resolveService @param {Function} consume
 * @param {{ automatic?: boolean, signal?: AbortSignal }} [options]
 */
export async function observeLibraryDiscovery(db, resolveService, consume, { automatic = false, signal } = {}) {
  const repository = createLibraryDiscoveryStatusRepository(db);
  if (automatic) {
    const admission = admitCatalogRecovery(await repository.read());
    if (!admission.allowed) return { deferred: true, reason: admission.reason, libraries: [] };
  }
  const source = await readLibraryCatalogSource(db);
  if (automatic && (!source.url?.trim() || !source.api_key?.trim())) return { deferred: true, reason: 'not_configured', libraries: [] };
  const record = async action => {
    try { return await action(); } catch {
      logger.warn('Library discovery status could not be saved', { reason: 'storage_unavailable' });
      return null;
    }
  };
  const attempt = automatic ? await repository.begin(source, { automatic }) : await record(() => repository.begin(source));
  if (automatic && !attempt) return { deferred: true, reason: 'configuration_changed', libraries: [] };
  let contract = 'unknown', merging = false;
  try {
    const catalog = await fetchLibraryCatalog(source, resolveService, { signal, onContract: value => { contract = value; } });
    signal?.throwIfAborted();
    merging = true;
    const result = await consume({ source, catalog });
    await record(() => repository.finish(attempt, { contract, count: catalog.filter(item => item.media_type !== null).length }));
    return result;
  } catch (error) {
    const diagnosticError = merging && error?.code !== 'library_catalog_source_changed'
      ? { catalogDiagnostic: { reason: 'local_update_failed', httpStatus: null } } : error;
    await record(() => repository.finish(attempt, { error: diagnosticError, contract }));
    throw error;
  }
}
