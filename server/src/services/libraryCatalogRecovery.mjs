/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { reconcileMediaServerLibraries } from './mediaServerLibrarySync.mjs';
import { libraryDiscoveryFailure } from './libraryDiscoveryFailure.mjs';

/** The existing watchdog owns scheduling; this adapter never starts timers or ingestion. */
export async function runLibraryCatalogRecovery({ db, getMediaServerServiceByType, logger }) {
  try {
    return await reconcileMediaServerLibraries({ db, getMediaServerServiceByType, automatic: true });
  } catch (error) {
    const reason = error?.code === 'library_catalog_busy' ? 'busy' : libraryDiscoveryFailure(error).reason;
    logger.debug('Automatic library discovery deferred', { reason });
    return { deferred: true, reason, libraries: [] };
  }
}
