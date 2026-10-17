/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archiveUuid, archiveHash } from './archiveRetentionContract.mjs';
import { gatewayError } from './errors.mjs';

export function validateCatalogVerification(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'archiveId,dependenciesAvailable,dumpSha256,kind,manifestSha256,purgeAuthorized,rowsRestored,runtimeEnabled,version' ||
      value.kind !== 'catalog_verification' || value.version !== 1 || !archiveUuid(value.archiveId) ||
      !archiveHash(value.manifestSha256) || !archiveHash(value.dumpSha256) || typeof value.rowsRestored !== 'boolean' ||
      typeof value.dependenciesAvailable !== 'boolean' || value.dependenciesAvailable && !value.rowsRestored ||
      value.runtimeEnabled !== false || value.purgeAuthorized !== false) throw gatewayError('gateway_catalog_verification_invalid');
  return value;
}
