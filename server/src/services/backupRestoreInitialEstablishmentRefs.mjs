/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { ValidationError } from '../utils/appError.mjs';
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';

const requiredReferences = ['policy_id', 'library_id', 'intent_id', 'migration_event_id', 'rollback_snapshot_id'];
const uniqueReferences = ['id', ...requiredReferences];

function invalidEstablishmentReference(field) {
  return new ValidationError(
    `Invalid initial intent establishment backup reference at ${field}. Re-export a complete configuration backup.`,
  );
}

function indexClaimedRows(rows, claimedIds, section) {
  if (!Array.isArray(rows)) throw invalidEstablishmentReference(section);
  const index = new Map();
  for (const [position, row] of rows.entries()) {
    const id = canonicalDatabaseBigintId(row?.id);
    if (!claimedIds.has(id)) continue;
    if (index.has(id)) throw invalidEstablishmentReference(`${section}[${position}].id`);
    index.set(id, row);
  }
  return index;
}

function libraryOwnerKey(library) {
  return JSON.stringify([library.name, library.media_type]);
}

function validateUnambiguousOwners(data, claimedLibraries, librariesById) {
  const assertedOwnerKeys = new Set();
  for (const libraryId of claimedLibraries) {
    const library = librariesById.get(libraryId);
    if (library) assertedOwnerKeys.add(libraryOwnerKey(library));
  }

  const seenLibraryKeys = new Set();
  for (const [position, library] of (data.libraries ?? []).entries()) {
    const key = libraryOwnerKey(library);
    if (!assertedOwnerKeys.has(key)) continue;
    if (seenLibraryKeys.has(key)) throw invalidEstablishmentReference(`libraries[${position}].id`);
    seenLibraryKeys.add(key);
  }

  const seenPolicyLibraries = new Set();
  for (const [position, policy] of (data.libraryPolicies ?? []).entries()) {
    const libraryId = canonicalDatabaseBigintId(policy.library_id);
    if (!claimedLibraries.has(libraryId)) continue;
    if (seenPolicyLibraries.has(libraryId)) throw invalidEstablishmentReference(`libraryPolicies[${position}].library_id`);
    seenPolicyLibraries.add(libraryId);
  }
}

export function validateInitialEstablishmentArchive(data, { intentsById, librariesById }) {
  const receipts = data.policyInitialIntentEstablishments ?? [];
  if (!Array.isArray(receipts)) throw invalidEstablishmentReference('policyInitialIntentEstablishments');
  const claims = new Map(uniqueReferences.map(key => [key, new Set()]));
  const requestKeys = new Set();
  const complete = [];
  for (const [position, receipt] of receipts.entries()) {
    // Incomplete archives have no receipt the current restore can map.
    if (receipt?.state !== 'established' || requiredReferences.some(key => receipt[key] == null)) continue;
    const field = `policyInitialIntentEstablishments[${position}]`;
    const ids = Object.fromEntries(
      requiredReferences.map(key => [key, canonicalDatabaseBigintId(receipt[key])]),
    );
    for (const key of requiredReferences) {
      if (ids[key] === null) throw invalidEstablishmentReference(`${field}.${key}`);
    }
    for (const key of uniqueReferences) {
      if (receipt[key] == null) continue;
      const id = key === 'id' ? canonicalDatabaseBigintId(receipt.id) : ids[key];
      const seen = claims.get(key);
      if (id === null || seen.has(id)) throw invalidEstablishmentReference(`${field}.${key}`);
      seen.add(id);
    }
    if (typeof receipt.idempotency_key === 'string') {
      if (requestKeys.has(receipt.idempotency_key)) throw invalidEstablishmentReference(`${field}.idempotency_key`);
      requestKeys.add(receipt.idempotency_key);
    }
    complete.push({ ids, field });
  }
  if (complete.length === 0) return;
  validateUnambiguousOwners(data, claims.get('library_id'), librariesById);

  const events = indexClaimedRows(
    data.policyIntentMigrationEvents ?? [], claims.get('migration_event_id'), 'policyIntentMigrationEvents',
  );
  const snapshots = indexClaimedRows(
    data.policyIntentRollbackSnapshots ?? [], claims.get('rollback_snapshot_id'), 'policyIntentRollbackSnapshots',
  );
  for (const { ids, field } of complete) {
    const intent = intentsById.get(ids.intent_id);
    const source = events.get(ids.migration_event_id);
    const snapshot = snapshots.get(ids.rollback_snapshot_id);
    if (!intent || !source || !snapshot) continue;

    if (canonicalDatabaseBigintId(intent.policy_id) !== ids.policy_id ||
        canonicalDatabaseBigintId(intent.library_id) !== ids.library_id ||
        (intent.intent_version != null && canonicalDatabaseBigintId(intent.intent_version) !== '1') ||
        (intent.source != null && intent.source !== 'native_intent')) {
      throw invalidEstablishmentReference(`${field}.intent_id`);
    }
    if (canonicalDatabaseBigintId(source.policy_id) !== ids.policy_id ||
        canonicalDatabaseBigintId(source.intent_id) !== ids.intent_id) {
      throw invalidEstablishmentReference(`${field}.migration_event_id`);
    }
    if (canonicalDatabaseBigintId(snapshot.policy_id) !== ids.policy_id ||
        canonicalDatabaseBigintId(snapshot.intent_id) !== ids.intent_id) {
      throw invalidEstablishmentReference(`${field}.rollback_snapshot_id`);
    }
  }
}
