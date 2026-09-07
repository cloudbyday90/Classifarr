/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { normalizeSourceProviderIds } from './mediaSourceIdentity.mjs';
import { sourceIdentityDiagnostics } from './mediaSyncIdentityDiagnostics.mjs';

export const SOURCE_OBSERVATION_LIMITS = Object.freeze({ retainedPerLibrary: 20000, retentionDays: 30,
  pageLimit: 1000, libraryLimit: 12, previewPerLibrary: 5 });

export function sourceObservationPage(mediaServerId, libraryId, items) {
  if (!positiveDatabaseInteger(mediaServerId) || !positiveDatabaseInteger(libraryId) ||
      !Array.isArray(items) || items.length > SOURCE_OBSERVATION_LIMITS.pageLimit) throw new Error('Invalid source observation page');
  const resolved = new Set(), unresolved = new Map();
  let rejected = 0, uncapturable = 0;
  for (const item of items) {
    const key = item?.external_id;
    const validKey = typeof key === 'string' && key.trim().length > 0 && key.length <= 500 && !key.includes('\0');
    const type = canonicalMediaType(item?.media_type);
    const accepted = validKey && type && normalizeSourceProviderIds(item);
    if (!accepted) rejected++;
    if (!validKey) { uncapturable++; continue; }
    // A valid duplicate cannot erase a rejection seen in the same capture page.
    if (accepted) { if (!unresolved.has(key)) resolved.add(key); continue; }
    resolved.delete(key);
    const diagnostics = sourceIdentityDiagnostics(mediaServerId, libraryId, item);
    const title = typeof item.title === 'string' ? item.title.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim().slice(0, 500) : null;
    const year = positiveDatabaseInteger(item.year);
    unresolved.set(key, { external_id: key, title: title || null, year: year && year <= 9999 ? year : null,
      media_type: type, identity_issue: diagnostics.identityIssue, provider_fields: diagnostics.providerFields });
  }
  return { resolved: [...resolved], unresolved: [...unresolved.values()], observed: items.length, rejected, uncapturable };
}
