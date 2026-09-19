/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inspectRepresentativeCoverage, representativeCoverageReady, validateRepresentativeCoverage } from './inventoryRepresentativeCoverage.mjs';
import { representativeValidationError, validateRepresentativeProfiles } from './representativeValidation.mjs';
import { isMap } from 'node:util/types';
import { validateRepresentativeMembership } from './inventoryRepresentativeMembership.mjs';

/** A thread/cache result cannot claim readiness or support absent from its source snapshot. */
export function validateInventoryRepresentativeProfileCoverage(model, snapshot, dimensions) {
  const expected = inspectRepresentativeCoverage(snapshot);
  if (!isMap(model.libraries) || model.libraries.size !== expected.libraries.size) throw representativeValidationError('profile_structure');
  validateRepresentativeProfiles([...model.libraries.values()], dimensions);
  const hashes = new Map([...expected.libraries.keys()].map(id => [id, new Set()]));
  for (const group of expected.index.groups.values()) if (group.libraries.size === 1 && snapshot.vectors.has(group.hash)) {
    const id = [...group.libraries][0];
    if (representativeCoverageReady(expected.libraries.get(id))) hashes.get(id).add(group.hash);
  }
  for (const [id, coverage] of expected.libraries) {
    const profile = model.libraries.get(id);
    validateRepresentativeCoverage(profile?.coverage);
    if (profile.mediaType !== expected.index.scope.get(id) ||
        Object.keys(coverage).some(key => profile.coverage[key] !== coverage[key]) ||
        profile.starts.some(start => start.groups.reduce((sum, group) => sum + group.support, 0) > coverage.availableDescriptions ||
          (!representativeCoverageReady(coverage) && start.groups.length))) throw representativeValidationError('profile_structure');
    validateRepresentativeMembership(profile, hashes.get(id));
  }
  if (Object.entries(expected.summary).some(([key, value]) => model.summary?.[key] !== value)) throw representativeValidationError('profile_structure');
  const summary = { ...expected.summary };
  for (const key of ['libraries', 'trainingDescriptions', 'sharedDescriptions', 'groups', 'sparseLibraries',
    'unconvergedStarts', 'discardedDescriptions', 'recoveredStarts', 'recoveryIterations']) {
    const value = model.summary?.[key];
    if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) throw representativeValidationError('profile_structure');
    summary[key] = value;
  }
  if (summary.libraries !== expected.libraries.size) throw representativeValidationError('profile_structure');
  return summary; // Never spread arbitrary worker/cache fields into a status or log.
}
