/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inspectRepresentativeCoverage, representativeCoverageReady, validateRepresentativeCoverage } from './inventoryRepresentativeCoverage.mjs';
import { representativeValidationError, validateRepresentativeProfiles } from './representativeValidation.mjs';
import { isMap } from 'node:util/types';

/** A thread/cache result cannot claim readiness or support absent from its source snapshot. */
export function validateInventoryRepresentativeProfileCoverage(model, snapshot, dimensions) {
  const expected = inspectRepresentativeCoverage(snapshot);
  if (!isMap(model.libraries) || model.libraries.size !== expected.libraries.size) throw representativeValidationError('profile_structure');
  validateRepresentativeProfiles([...model.libraries.values()], dimensions);
  for (const [id, coverage] of expected.libraries) {
    const profile = model.libraries.get(id);
    validateRepresentativeCoverage(profile?.coverage);
    if (profile.mediaType !== expected.index.scope.get(id) ||
        Object.keys(coverage).some(key => profile.coverage[key] !== coverage[key]) ||
        profile.starts.some(start => start.groups.reduce((sum, group) => sum + group.support, 0) > coverage.availableDescriptions ||
          (!representativeCoverageReady(coverage) && start.groups.length))) throw representativeValidationError('profile_structure');
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
