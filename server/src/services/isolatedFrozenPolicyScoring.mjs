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
  const [inventoryModule, rankingModule, decisionModule, decisionBuilderModule] = role === 'candidate'
    ? await Promise.all(['policyInventoryEvidenceService.mjs', 'policyCandidateRankingProjection.mjs',
      'policyCandidateDecisionProjection.mjs', 'policyDecisionBuilder.mjs']
      .map(name => loadModule(`${root}${name}`))) : [null, null, null, null];
  if (inventoryModule && typeof inventoryModule.createPolicyInventoryEvidenceService !== 'function') {
    throw new Error('frozen_policy_inventory_interface_invalid');
  }
  if (role === 'candidate' && [rankingModule.projectRankedPolicyCandidates,
    decisionModule.projectPolicyCandidateDecision,
    decisionBuilderModule.policyDecisionBuilder?.buildPolicyDecision].some(value => typeof value !== 'function')) {
    throw new Error('frozen_policy_decision_interface_invalid');
  }
  return async ({ metadata, policies, profiles, inventory, onInventoryStatus }) => {
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
    const retriever = { async retrieve({ contract }) {
      const ids = contract?.candidates?.map(candidate => candidate.libraryId);
      if (!inventory || inventory.statusId !== 'captured' ||
          JSON.stringify(ids) !== JSON.stringify(inventory.contract) ||
          contract.candidates.some(candidate => candidate.mediaType !== metadata.media_type)) {
        onInventoryStatus?.('contract_mismatch');
        throw new Error('frozen_inventory_contract_mismatch');
      }
      onInventoryStatus?.(inventory.evidence.statusId === 'available' ? 'used' : 'unavailable');
      return inventory.evidence;
    } };
    const inventoryService = role === 'candidate' && inventory
      ? inventoryModule.createPolicyInventoryEvidenceService({ retriever, captureShadow: false }) : null;
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
        ...(role === 'candidate' ? { applyInventoryEvidence: input => inventoryService
          ? inventoryService.apply(input) : input.evaluations,
        rankResults: rankingModule.projectRankedPolicyCandidates,
        determineAction: ranked => decisionBuilderModule.policyDecisionBuilder.buildPolicyDecision(
          decisionModule.projectPolicyCandidateDecision({ ranked })) } : {}),
      });
    } finally {
      if (baselineProfile) baselineProfile.libraryProfileService.getProfileScoreDetails = original;
    }
  };
}
