/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createInventoryNeighborhoodIndex } from './inventoryNeighborhoodProfiles.mjs';
import { representativeValidationError } from './representativeValidation.mjs';
import { REPRESENTATIVE_RECOVERY_WORK_COMPONENTS } from './inventoryRepresentativeStability.mjs';
import { isMap } from 'node:util/types';

export const REPRESENTATIVE_PROFILE_COMPONENT_LIMIT = 8_000_000;
export const REPRESENTATIVE_MIN_COVERAGE_PERCENT = 90;

export function assertRepresentativeSnapshotBudget(snapshot, dimensions, code = 'inventory_representative_profile_input_budget') {
  if (!Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > 16000 ||
      !Array.isArray(snapshot?.libraries) || snapshot.libraries.length > 64 ||
      !Array.isArray(snapshot.corpus?.documents) || snapshot.corpus.documents.length > 50000 ||
      !isMap(snapshot.corpus.texts) || snapshot.corpus.texts.size > 10000 ||
      snapshot.corpus.texts.size * dimensions > REPRESENTATIVE_PROFILE_COMPONENT_LIMIT ||
      snapshot.corpus.documents.length * dimensions * REPRESENTATIVE_RECOVERY_WORK_COMPONENTS > 80_000_000_000 ||
      !isMap(snapshot.vectors) || [...snapshot.vectors.keys()].some(hash => !snapshot.corpus.texts.has(hash))) throw new Error(code);
  if ([...snapshot.corpus.texts.keys()].some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) ||
      snapshot.corpus.documents.some(doc => !['movie', 'tv'].includes(doc?.type) || !snapshot.corpus.texts.has(doc.hash) ||
        !Array.isArray(doc.libraryIds) || doc.libraryIds.length > 64)) throw new Error(code);
}

function coverageStatus(eligible, available) {
  if (eligible < 3) return 'sparse';
  if (available < 3 || available * 100 < eligible * REPRESENTATIVE_MIN_COVERAGE_PERCENT) return 'waiting';
  return available === eligible ? 'complete' : 'partial';
}

export const representativeCoverageReady = coverage => ['complete', 'partial'].includes(coverage.status);

export function validateRepresentativeCoverage(coverage) {
  if (!coverage || Object.keys(coverage).length !== 3 ||
      !Number.isInteger(coverage.eligibleDescriptions) || coverage.eligibleDescriptions < 0 || coverage.eligibleDescriptions > 10000 ||
      !Number.isInteger(coverage.availableDescriptions) || coverage.availableDescriptions < 0 ||
      coverage.availableDescriptions > coverage.eligibleDescriptions ||
      coverage.status !== coverageStatus(coverage.eligibleDescriptions, coverage.availableDescriptions)) {
    throw representativeValidationError('profile_structure');
  }
}

/** Membership is resolved BEFORE availability filtering. Shared/missing copies cannot create votes. */
export function inspectRepresentativeCoverage(snapshot) {
  const index = createInventoryNeighborhoodIndex(snapshot.corpus.documents, null, snapshot.libraries);
  const libraries = new Map([...index.scope.keys()].sort((a, b) => a - b)
    .map(id => [id, { eligibleDescriptions: 0, availableDescriptions: 0, status: 'sparse' }]));
  for (const group of index.groups.values()) if (group.libraries.size === 1) {
    const coverage = libraries.get([...group.libraries][0]);
    coverage.eligibleDescriptions++;
    coverage.availableDescriptions += Number(snapshot.vectors.has(group.hash));
  }
  for (const coverage of libraries.values()) coverage.status = coverageStatus(coverage.eligibleDescriptions, coverage.availableDescriptions);
  return { index, libraries, summary: {
    eligibleDescriptions: snapshot.corpus.texts.size, availableDescriptions: snapshot.vectors.size,
    missingDescriptions: snapshot.corpus.texts.size - snapshot.vectors.size,
    readyLibraries: [...libraries.values()].filter(representativeCoverageReady).length,
    partialLibraries: [...libraries.values()].filter(row => row.status === 'partial').length,
    waitingLibraries: [...libraries.values()].filter(row => row.status === 'waiting').length,
  } };
}
