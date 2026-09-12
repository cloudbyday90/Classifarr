/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { buildPolicyCandidateAdjudicationContract, buildPolicyCandidateAdjudicationPool } from './policyCandidateAdjudicationContract.mjs';
import { resolveDeterministicOutcomeAiMode } from './classificationDeterministicAiMode.mjs';
import { rankLearnedCandidateShortlist } from './learnedCandidateShortlistRanking.mjs';
import { createPolicyCandidateAdjudicationEvidenceService, projectPolicyCandidateAdjudicationEvidenceForProvider } from './policyCandidateAdjudicationEvidence.mjs';
import { buildSignalContext } from './policyScoringContextBuilder.mjs';
import { buildClassificationBasePrompt } from './classificationBasePrompt.mjs';
import { AIPromptBuilder } from './aiPromptBuilder.mjs';

const silent = Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, () => {}]));
const promptBuilder = new AIPromptBuilder({ logger: silent });
const comparable = ({ libraryNumber: _number, ...candidate }) => candidate;
export const replayFingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Capture private evidence once. Source labels and prior chosen destinations are not prompt inputs. */
export async function preparePolicyShortlistReplayCase(entry, source, runtime, signal) {
  const { metadata, policyResult } = entry, { libraries, config } = source;
  const options = { policyResult, libraries, mediaType: metadata.media_type };
  const baseline = buildPolicyCandidateAdjudicationContract(options);
  const mode = resolveDeterministicOutcomeAiMode({ policyResult, libraries, candidateAdjudication: baseline });
  if (!baseline.valid || !mode.shouldInvoke || mode.mode !== 'adjudicate') return { status: 'not_adjudication' };
  const pool = buildPolicyCandidateAdjudicationPool(options);
  if (pool.length > 64) return { status: 'scope_unavailable' };
  const descriptions = await runtime.retrieve({ contract: { valid: true, candidates: pool }, metadata, signal });
  signal?.throwIfAborted();
  if (descriptions?.statusId !== 'available' || !Array.isArray(descriptions.candidates) || descriptions.candidates.length !== pool.length ||
      new Set(descriptions.candidates.map(candidate => candidate?.libraryId)).size !== pool.length ||
      descriptions.candidates.some(candidate => !pool.some(value => value.libraryId === candidate?.libraryId) || candidate.indexed !== candidate.eligible)) {
    return { status: 'evidence_unavailable' };
  }
  const profiles = new Map(descriptions.candidates.map(candidate => [candidate.libraryId, candidate.learnedProfile]));
  const orders = { baseline: rankLearnedCandidateShortlist(pool, profiles),
    protected: rankLearnedCandidateShortlist(pool, profiles, descriptions.candidates) };
  const profileReads = new Map();
  const evidenceService = createPolicyCandidateAdjudicationEvidenceService({
    getProfileStats: id => {
      if (!profileReads.has(id)) profileReads.set(id, runtime.readProfile(id));
      return profileReads.get(id);
    }, retrieveCurrentLibraryEvidence: runtime.retrieveCurrent,
    retrieveCurrentLibrarySemanticEvidence: async () => null,
    retrieveInventoryDescriptions: async ({ contract }) => ({ ...descriptions,
      candidates: descriptions.candidates.filter(candidate => contract.candidates.some(value => value.libraryId === candidate.libraryId)) }),
  });
  const signalContext = buildSignalContext(policyResult, libraries, policyResult.ranked);
  const ragContext = { similarItems: (policyResult.ragCache?.matches ?? []).slice(0, 3) };
  const arms = {};
  for (const arm of ['baseline', 'protected']) {
    signal?.throwIfAborted();
    const contract = buildPolicyCandidateAdjudicationContract({ ...options, candidateOrder: orders[arm] });
    if (arm === 'protected' && JSON.stringify(contract) === JSON.stringify(arms.baseline.contract)) {
      arms[arm] = arms.baseline; continue;
    }
    const evidence = await evidenceService.build({ contract, metadata, ragContext });
    const context = { metadata, libraries: contract.candidates.map(candidate => candidate.library), signalContext,
      policySignals: signalContext, ragContext: null, verificationContract: null,
      candidateAdjudicationEvidence: projectPolicyCandidateAdjudicationEvidenceForProvider(evidence,
        { providerType: config.primary_provider, providerHost: config.ollama_host }) };
    const prompt = await buildClassificationBasePrompt(context, { mode: 'adjudicate', promptBuilder });
    arms[arm] = { contract, evidence, prompt };
  }
  for (const candidate of arms.baseline.evidence.candidates) {
    const other = arms.protected.evidence.candidates.find(value => value.libraryId === candidate.libraryId);
    if (other && JSON.stringify(comparable(candidate)) !== JSON.stringify(comparable(other))) return { status: 'evidence_changed' };
  }
  signal?.throwIfAborted();
  return { status: 'ready', metadata, policyResult, libraries, signalContext, arms,
    changedShortlist: arms.baseline !== arms.protected,
    fingerprint: replayFingerprint({ metadata, policyResult, arms }) };
}
