/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readLibraryCatalogSource, fetchLibraryCatalog } from './libraryCatalogContext.mjs';
import { createLibraryDiscoveryStatusRepository } from './libraryDiscoveryStatusRepository.mjs';
import { createLogger } from '../utils/logger.mjs';
const logger = createLogger('LibraryDiscovery');

/** Diagnostics are best-effort; completion follows the existing merge commit. */
export async function observeLibraryDiscovery(db, resolveService, consume) {
  const source = await readLibraryCatalogSource(db);
  const repository = createLibraryDiscoveryStatusRepository(db);
  const record = async action => {
    try { return await action(); } catch {
      logger.warn('Library discovery status could not be saved', { reason: 'storage_unavailable' });
      return null;
    }
  };
  const attempt = await record(() => repository.begin(source));
  let contract = 'unknown', merging = false;
  try {
    const catalog = await fetchLibraryCatalog(source, resolveService, { onContract: value => { contract = value; } });
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
