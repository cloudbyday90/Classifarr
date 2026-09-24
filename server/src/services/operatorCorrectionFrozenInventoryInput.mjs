/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateFrozenPolicyInput, validateFrozenPolicyWorkerInput } from './operatorCorrectionFrozenPolicyInput.mjs';

const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const positiveId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function validateInventory(inventory, mediaType) {
  if (!exact(inventory, ['statusId', 'contract', 'evidence'])) throw new Error('frozen_inventory_invalid');
  if (inventory.statusId === 'not_requested') {
    if (inventory.contract !== null || inventory.evidence !== null) throw new Error('frozen_inventory_invalid');
    return;
  }
  if (inventory.statusId !== 'captured' || !Array.isArray(inventory.contract) ||
      inventory.contract.length < 2 || inventory.contract.length > 64 ||
      inventory.contract.some(id => !positiveId(id)) ||
      new Set(inventory.contract).size !== inventory.contract.length ||
      inventory.contract.some((id, index) => index > 0 && id < inventory.contract[index - 1])) {
    throw new Error('frozen_inventory_contract_invalid');
  }
  const response = inventory.evidence;
  if (!exact(response, ['statusId', 'candidates']) ||
      !['available', 'unavailable'].includes(response.statusId) || !Array.isArray(response.candidates) ||
      ![0, inventory.contract.length].includes(response.candidates.length) ||
      (response.statusId === 'available' && response.candidates.length === 0)) {
    throw new Error('frozen_inventory_evidence_invalid');
  }
  for (const [index, candidate] of response.candidates.entries()) {
    if (!exact(candidate, ['libraryId', 'eligible', 'indexed', 'learnedProfile', 'items']) ||
        candidate.libraryId !== inventory.contract[index] ||
        typeof candidate.eligible !== 'boolean' || typeof candidate.indexed !== 'boolean' ||
        !Array.isArray(candidate.items) || candidate.items.length > 3) {
      throw new Error('frozen_inventory_candidate_invalid');
    }
    const profile = candidate.learnedProfile;
    if (!exact(profile, ['version', 'snapshotId', 'relativeFit', 'statusId', 'trainingDescriptions']) ||
        profile.version !== 'contrastive_profile_v1' || !/^[a-f0-9]{64}$/.test(profile.snapshotId) ||
        !finite(profile.relativeFit, -100, 100) ||
        !['neutral', 'available'].includes(profile.statusId) ||
        !Number.isSafeInteger(profile.trainingDescriptions) || profile.trainingDescriptions < 0 ||
        profile.trainingDescriptions > 50_000) throw new Error('frozen_inventory_profile_invalid');
    for (const item of candidate.items) {
      if (!exact(item, ['description', 'similarity', 'sharedAcrossCandidates']) ||
          typeof item.description !== 'string' || item.description.length > 10_000 ||
          !finite(item.similarity, 0, 1) || typeof item.sharedAcrossCandidates !== 'boolean') {
        throw new Error('frozen_inventory_item_invalid');
      }
    }
  }
  const hasItems = response.candidates.some(candidate => candidate.items.length > 0);
  if ((response.statusId === 'available') !== hasItems ||
      new Set(response.candidates.map(candidate => candidate.learnedProfile.snapshotId)).size > 1) {
    throw new Error('frozen_inventory_evidence_invalid');
  }
  if (!['movie', 'tv'].includes(mediaType)) throw new Error('frozen_inventory_media_invalid');
}

function validate(input, worker) {
  const top = worker ? ['version', 'policies', 'folds', 'cases']
    : ['version', 'sourceFingerprint', 'sampleFingerprint', 'provenance',
      'eligibleCorrections', 'policies', 'folds', 'cases'];
  if (!exact(input, top) || input.version !== 3 || !Array.isArray(input.cases) ||
      JSON.stringify(input).length > 8_000_000) throw new Error('frozen_inventory_input_invalid');
  const cases = input.cases.map(row => {
    const keys = worker ? ['mediaType', 'foldIndex', 'metadata', 'inventory']
      : ['mediaType', 'labelLibraryId', 'foldIndex', 'metadata', 'inventory'];
    if (!exact(row, keys)) throw new Error('frozen_inventory_case_invalid');
    validateInventory(row.inventory, row.mediaType);
    const { inventory: _inventory, ...policyRow } = row;
    return policyRow;
  });
  const policyInput = { ...input, version: 2, cases };
  if (worker) validateFrozenPolicyWorkerInput(policyInput);
  else validateFrozenPolicyInput(policyInput);
  return input;
}

export const validateFrozenInventoryInput = input => validate(input, false);
export const validateFrozenInventoryWorkerInput = input => validate(input, true);
export const fingerprintFrozenInventoryInput = input => createHash('sha256')
  .update(JSON.stringify(validateFrozenInventoryInput(input))).digest('hex');

/** Labels and source identifiers remain solely in the parent process. */
export function projectFrozenInventoryWorkerInput(input) {
  const validated = validateFrozenInventoryInput(input);
  return { version: 3, policies: validated.policies, folds: validated.folds,
    cases: validated.cases.map(({ mediaType, foldIndex, metadata, inventory }) =>
      ({ mediaType, foldIndex, metadata, inventory })) };
}
