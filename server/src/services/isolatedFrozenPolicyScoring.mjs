/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const sourceRoot = Object.freeze({ baseline: 'file:///app/release/server/src/services/',
  candidate: 'file:///app/current/src/services/' });

/** Run each release's real preset/profile formulas without a database, retriever or provider. */
export async function createIsolatedFrozenPolicyScorer(role, loadModule = path => import(path)) {
  const root = sourceRoot[role];
  if (!root) throw new Error('frozen_policy_role_invalid');
  const [evaluation, scoring, profileMath, baselineProfile] = await Promise.all([
    loadModule(`${root}policyEngineEvaluation.mjs`),
    loadModule(`${root}policyEngineSourceScoring.mjs`),
    loadModule(`${root}libraryProfileComputations.mjs`),
    role === 'baseline' ? loadModule(`${root}libraryProfileService.mjs`) : Promise.resolve(null),
  ]);
  if (![evaluation.evaluateItem, evaluation.evaluatePolicy, scoring.scorePresets,
    scoring.scoreProfileWithDiagnostics, scoring.scoreRAGWithDiagnostics,
    profileMath.computeProfileScoreDetails].every(value => typeof value === 'function')) {
    throw new Error('frozen_policy_release_interface_invalid');
  }
  return async ({ metadata, policies, profiles }) => {
    const byId = new Map(profiles.map(entry => [entry.libraryId, entry.profile]));
    if (policies.some(policy => policy.library_media_type === metadata.media_type && !byId.has(policy.library_id))) {
      throw new Error('frozen_policy_profile_missing');
    }
    const readDetails = (id, item) => {
      if (!byId.has(id)) throw new Error('frozen_policy_profile_missing');
      return profileMath.computeProfileScoreDetails(byId.get(id), item);
    };
    const original = baselineProfile?.libraryProfileService.getProfileScoreDetails;
    if (baselineProfile) baselineProfile.libraryProfileService.getProfileScoreDetails = readDetails;
    try {
      return await evaluation.evaluateItem(metadata, { ragCache: { matches: [], timestamp: 1 }, relatedEvidence: [] }, {
        checkAuthoritativeSignals: async () => null,
        getActivePolicies: async () => policies,
        evaluatePolicy: (policy, item, cache, related) => evaluation.evaluatePolicy(policy, item, cache, related, {
          scorePresets: scoring.scorePresets, scoreRAGWithDiagnostics: scoring.scoreRAGWithDiagnostics,
          scoreProfileWithDiagnostics: role === 'baseline' ? scoring.scoreProfileWithDiagnostics
            : (id, value) => scoring.scoreProfileWithDiagnostics(id, value,
              { getProfileScoreDetails: () => readDetails(id, value) }),
          scorePatterns: async () => 0, scoreHistory: async () => 0,
        }),
        ...(role === 'candidate' ? { applyInventoryEvidence: ({ evaluations }) => evaluations } : {}),
      });
    } finally {
      if (baselineProfile) baselineProfile.libraryProfileService.getProfileScoreDetails = original;
    }
  };
}
