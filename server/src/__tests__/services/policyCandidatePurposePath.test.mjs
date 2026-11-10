/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { candidatePurposeFixture } from '../fixtures/candidatePurposeFixture.mjs';
import { ClassificationPolicyPathService } from '../../services/classificationPolicyPathService.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';
import { policyInventoryEvidenceService } from '../../services/policyInventoryEvidenceService.mjs';
import { buildPolicyCandidateAdjudicationContract } from '../../services/policyCandidateAdjudicationContract.mjs';
import { holdLivePolicyCandidatePurpose } from '../../services/policyCandidatePurposeLiveCapture.mjs';
import { buildPolicyCandidatePurposePrompt } from '../../services/policyCandidatePurposeProvider.mjs';

test('production wrapper mints the private sidecar around its unchanged real evaluation/ranking path', async () => {
  const fixture = await candidatePurposeFixture();
  const spies = [
    jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue(fixture.policies),
    jest.spyOn(policyEngine, 'checkAuthoritativeSignals').mockResolvedValue(null),
    jest.spyOn(policyEngine, 'scoreProfileWithDiagnostics').mockResolvedValue({ score: 70, diagnostics: null }),
    jest.spyOn(policyInventoryEvidenceService, 'apply').mockImplementation(async ({ evaluations }) => evaluations),
  ];
  try {
    const result = await policyEngine.evaluateItem(fixture.item);
    const contract = buildPolicyCandidateAdjudicationContract({ policyResult: result, libraries: fixture.libraries, mediaType: fixture.item.media_type });
    const token = holdLivePolicyCandidatePurpose({ policyResult: result, contract, metadata: fixture.item });
    expect(buildPolicyCandidatePurposePrompt(token, { metadata: fixture.item, libraries: contract.candidates.map(row => row.library),
      providerType: 'ollama', providerHost: '127.0.0.1', transportHost: '127.0.0.1' })).toContain('"terms":["Animation"]');
    expect(JSON.stringify(result)).not.toContain('"terms"');
  } finally { spies.forEach(spy => spy.mockRestore()); }
});

test.each(['adjudicate', 'verify'])('policy path forwards opaque evidence only to %s adjudication, preserving ordinary candidate JSON', async initialMode => {
  const fixture = await candidatePurposeFixture();
  const evidence = { version: fixture.contract.version, candidates: fixture.contract.candidates.map(row => ({ libraryId: row.libraryId })) };
  const before = JSON.stringify(evidence), observed = [];
  const aiClassify = jest.fn(async (metadata, libraries, _signals, options) => {
    const purpose = buildPolicyCandidatePurposePrompt(options.candidatePurpose, { metadata, libraries,
      providerType: 'ollama', providerHost: '127.0.0.1', transportHost: '127.0.0.1' });
    observed.push(purpose);
    return { library: fixture.libraries[0], confidence: 70, format: options.mode === 'verify' ? 'abstain' : 'confident' };
  });
  const service = new ClassificationPolicyPathService({
    policyEngine: { evaluateItem: async () => fixture.result },
    policyScoringContextBuilder: { buildSignalContext: () => ({ confidence: 70 }) },
    policyCandidateShortlistService: { build: async () => fixture.contract },
    policyCandidateAdjudicationEvidenceService: { build: async () => evidence },
    classificationAiService: { aiClassify },
    resolveDeterministicOutcomeAiMode: () => ({ shouldInvoke: true, mode: initialMode }),
    resolveCandidateAdjudicationFallback: () => ({ shouldInvoke: initialMode === 'verify' }),
    finalizePolicyCandidateAdjudication: ({ aiMatch }) => aiMatch,
    policyCandidateConsensusService: { prepare: async () => null, resolve: async ({ result }) => result },
    learnedEvidenceRoutingService: { prepare: async () => null, resolve: async ({ result }) => result },
    policyCandidateContrastiveRetriever: { retrieve: async () => null },
    classificationRoutingService: { ensureDecisionQuestion: async ({ result }) => result },
    observeRepresentativeDecision() {},
    logger: { info() {}, warn() {}, error() {} },
  });
  const result = await service.execute({ metadata: fixture.item, libraries: fixture.libraries });
  expect(aiClassify).toHaveBeenCalledTimes(initialMode === 'adjudicate' ? 1 : 2);
  expect(observed.at(-1)).toContain('"terms":["Animation"]');
  if (initialMode === 'verify') expect(observed[0]).toBeNull();
  expect(JSON.stringify(evidence)).toBe(before);
  expect(JSON.stringify(result)).not.toContain('"terms"');
});
