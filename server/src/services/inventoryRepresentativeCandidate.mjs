/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isMap } from 'node:util/types';
import { inventoryRepresentativeSourceKey, INVENTORY_REPRESENTATIVE_PROFILE_VERSION } from './inventoryRepresentativeProfile.mjs';
import { assertRepresentativeSnapshotBudget, assertRepresentativePresenceBudget, inspectRepresentativeCoverage } from './inventoryRepresentativeCoverage.mjs';
import { validateInventoryRepresentativeProfileCoverage } from './inventoryRepresentativeProfileValidation.mjs';
import { representativeValidationError } from './representativeValidation.mjs';
import { representativeValidationIssue } from './representativeValidationDiagnostics.mjs';

/** End the fitting snapshot's scope before the caller's independent verification read. */
export async function prepareInventoryRepresentativeCandidate({ repository, identity, expected, signal,
  isCurrent, selectCached, fit, observer, neighborhoodRecovery, hasCached = false }) {
  if (hasCached && repository.prepareRepresentative) {
    const warm = await repository.prepareRepresentative(identity, { signal, configKey: expected }, async (snapshot, readVectors) => {
      signal.throwIfAborted();
      if (!isCurrent(snapshot.state)) return { status: 'invalidated' };
      assertRepresentativePresenceBudget(snapshot, identity.dimensions);
      const model = selectCached(snapshot.key);
      if (!model) return null; // Close this probe before a cold fitting read.
      return prepareConsumers({ model, snapshot, identity, expected, signal, observer, neighborhoodRecovery,
        sourceKey: snapshot.key, reused: true, readVectors });
    });
    if (warm) return warm;
  }
  const snapshot = await repository.read(identity, { signal });
  signal.throwIfAborted();
  if (!isCurrent(snapshot.state)) return { status: 'invalidated' };
  if (!snapshot.corpus.texts.size) return { status: 'empty_corpus' };
  assertRepresentativeSnapshotBudget(snapshot, identity.dimensions);
  const coverage = inspectRepresentativeCoverage(snapshot);
  if (!coverage.summary.readyLibraries) return { status: 'waiting_for_vectors', summary: coverage.summary };
  const sourceKey = inventoryRepresentativeSourceKey(snapshot, identity, expected);
  const cached = selectCached(sourceKey);
  const model = cached ?? await fit(snapshot, identity.dimensions, { signal });
  return prepareConsumers({ model, snapshot, identity, expected, signal, observer, neighborhoodRecovery,
    sourceKey, reused: Boolean(cached) });
}

async function prepareConsumers({ model, snapshot, identity, expected, signal, observer, neighborhoodRecovery,
  sourceKey, reused, readVectors = null }) {
  signal.throwIfAborted();
  if (model?.version !== INVENTORY_REPRESENTATIVE_PROFILE_VERSION || model.kind !== 'full_inventory_shadow' ||
      !isMap(model.libraries)) throw representativeValidationError('profile_header');
  const summary = validateInventoryRepresentativeProfileCoverage(model, snapshot, identity.dimensions, readVectors ? snapshot.presentHashes : snapshot.vectors);
  let batch = null;
  try { batch = observer?.prepare({ model, snapshot, identity, configKey: expected }); }
  catch { /* Optional diagnostics cannot discard an otherwise valid profile. */ }
  let recoveryBatch = null;
  try { recoveryBatch = await neighborhoodRecovery?.prepare({ model, snapshot, identity, configKey: expected, signal, readVectors }); }
  catch (error) {
    // Known malformed evidence must retain its redacted diagnostic/backoff path.
    if (readVectors || representativeValidationIssue(error) !== 'unknown_check') throw error;
  }
  return { sourceKey, model, summary, reused, batch, recoveryBatch };
}
