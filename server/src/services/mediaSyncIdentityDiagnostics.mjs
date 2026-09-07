/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { normalizeSourceProviderIds } from './mediaSourceIdentity.mjs';

/** Fixed categories and a stable fingerprint, never titles, URLs or provider values. */
export function sourceIdentityDiagnostics(mediaServerId, libraryId, item) {
  let identityIssue = 'invalid_provider_ids';
  if (!positiveDatabaseInteger(mediaServerId)) identityIssue = 'invalid_media_server_id';
  else if (!canonicalMediaType(item?.media_type)) identityIssue = 'invalid_media_type';
  else if (typeof item?.external_id !== 'string' || !item.external_id.trim()) identityIssue = 'invalid_external_id';
  else if (item.provider_identity_invalid && item.provider_identity_issue === 'conflicting_provider_ids') {
    identityIssue = 'conflicting_provider_ids';
  }
  const fields = ['tmdb_id', 'imdb_id', 'tvdb_id'].filter(field =>
    item?.provider_identity_field === field || !normalizeSourceProviderIds({ [field]: item?.[field] }));
  const serverId = positiveDatabaseInteger(mediaServerId);
  return {
    identityIssue,
    providerFields: fields,
    mediaServerId: serverId,
    libraryId: positiveDatabaseInteger(libraryId),
    sourceFingerprint: serverId && typeof item?.external_id === 'string' && item.external_id.length <= 500
      ? createHash('sha256').update(JSON.stringify([serverId, item.external_id])).digest('hex') : null,
  };
}
