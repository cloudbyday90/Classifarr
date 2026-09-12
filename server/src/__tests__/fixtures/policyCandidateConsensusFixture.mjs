/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildPolicyCandidateAdjudicationContract } from '../../services/policyCandidateAdjudicationContract.mjs';
import { finalizePolicyCandidateAdjudication } from '../../services/policyCandidateAdjudicationResult.mjs';

export function consensusFixture() {
  const libraries = [1, 2, 3].map(id => ({ id, name: `Library ${id}`, media_type: 'movie', is_active: true }));
  const metadata = { tmdb_id: 999, media_type: 'movie', overview: 'A journey across the open ocean.', genres: ['Documentary'] };
  const policyResult = { action: 'prompt_select', confidence: 87, decisionDiagnostics: null,
    ranked: libraries.map(library => ({ library_id: library.id, score: library.id === 1 ? 87 : 86,
      auto_classify_threshold: 85, prompt_threshold: 60 })) };
  const contract = buildPolicyCandidateAdjudicationContract({ policyResult, libraries, mediaType: 'movie' });
  const aiMatch = { library: libraries[1], format: 'confident', confidence: 99,
    ai_authority: { version: 'ai.provider_authority.v1', providerId: 'ollama', model: 'test:latest',
      effectiveMode: 'proposal', isFallback: false, downgraded: false, sideEffects: { canRoute: false } } };
  const evidence = { version: contract.version, candidates: libraries.map(library => ({
    libraryId: library.id, mediaType: 'movie', currentLibrary: { directMatch: false },
    descriptionEvidence: { statusId: 'available', eligible: 100, indexed: 100,
      learnedProfile: { version: 'contrastive_profile_v1', statusId: 'available',
        relativeFit: library.id === 2 ? 1 : -1, trainingDescriptions: 100 },
      items: [0, 1, 2].map(index => ({ description: `Example ${library.id}-${index}`,
        similarity: (library.id === 2 ? .92 : .65) - index * .02, sharedAcrossCandidates: false })) },
  })) };
  const input = { metadata, libraries, policyResult, contract, evidence, aiMatch,
    consensusContext: JSON.stringify(consensusConfig()) };
  return { ...input, result: finalizePolicyCandidateAdjudication(input) };
}

export function consensusConfig() {
  return { rag_enabled: true, primary_provider: 'ollama', ollama_model: 'test:latest', ollama_host: 'http://localhost:11434' };
}

export function consensusDependencies(input) {
  return {
    readConfig: async () => consensusConfig(),
    readLibraries: async () => structuredClone(input.libraries),
    readPolicy: async () => structuredClone(input.policyResult),
    readEvidence: async () => structuredClone(input.evidence),
  };
}
