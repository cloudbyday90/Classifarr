/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createServer } from 'node:http';

const writes = [], logs = [];
const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, (...args) => logs.push([level, ...args])]));
jest.unstable_mockModule('../../utils/logger.mjs', () => ({ createLogger: () => logger }));
let onConfiguration = () => {};
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: async (sql, params) => {
  if (sql.includes('ai_provider_config')) { onConfiguration(); return { rows: [{ ollama_model: 'synthetic:latest', ai_response_repair_enabled: true }] }; }
  if (!/^\s*SELECT/u.test(sql)) writes.push({ sql, params });
  return { rows: [], rowCount: 1 };
} }));
const admission = { admit: jest.fn(async () => null), failed: jest.fn(async () => false), succeeded: async () => {} };
const lock = { config: { heartbeatInterval: 5000 }, acquireLock: jest.fn(async () => {}), heartbeat() {}, releaseLock: jest.fn() };
jest.unstable_mockModule('../../services/classificationProviderAdmissionService.mjs', () => ({ classificationProviderAdmissionService: admission }));
jest.unstable_mockModule('../../services/providerLock.mjs', () => ({ providerLock: lock }));
const invalidation = jest.fn(async () => false);
jest.unstable_mockModule('../../services/ollamaVerificationCapabilityRuntimeInvalidationService.mjs', () => ({
  ollamaVerificationCapabilityRuntimeInvalidationService: { invalidateFromGenerationError: invalidation },
}));
const { policyRecoveryReferenceFixture } = await import('../fixtures/policyRecoveryReferenceFixture.mjs');
const { verificationProfile } = await import('../fixtures/verificationAdviceFixture.mjs');
const { classificationAiService } = await import('../../services/classificationAiService.mjs');
const { aiRouterService } = await import('../../services/aiRouter.mjs');
const { ollamaService } = await import('../../services/ollama.mjs');
const { cloudLLMService } = await import('../../services/cloudLLM.mjs');
const { libraryProfileService } = await import('../../services/libraryProfileService.mjs');
const { aiPromptBuilder } = await import('../../services/aiPromptBuilder.mjs');
const { buildAiProviderAuthorityProfile } = await import('../../services/aiProviderAuthority.mjs');
const { ClassificationPolicyPathService } = await import('../../services/classificationPolicyPathService.mjs');
const { ensureDecisionQuestion } = await import('../../services/classificationRoutingServiceShared.mjs');
const { candidateBoundVerificationResponseSchema } = await import('../../services/aiResponseSchema.mjs');
const { holdPolicyVerificationAdvice } = await import('../../services/policyVerificationAdvice.mjs');
const { ragRecheckAdviceFixture } = await import('../fixtures/ragRecheckAdviceFixture.mjs');
const { runPolicyRecheckStage, runAiRerunStage } = await import('../../services/classificationRagLoopStages.mjs');
const { policyEngine } = await import('../../services/policyEngine.mjs');
const { ragLoopResilienceManager } = await import('../../services/ragLoopResilienceManager.mjs');
const { classificationRagLoopService } = await import('../../services/classificationRagLoopService.mjs');
const { publishCurrentPolicyReviewFrame, holdCurrentPolicyReviewFrame, projectCurrentPolicyReviewFrame } = await import('../../services/currentPolicyReviewFrameLive.mjs');
const { ragRetriever } = await import('../../services/ragRetriever.mjs');
const { nonadoptedRagVerificationFixture, nonadoptedRagContext } = await import('../fixtures/nonadoptedRagVerificationFixture.mjs');
const { aiProviderCapabilityMetricsService } = await import('../../services/aiProviderCapabilityMetricsService.mjs');

let server, url, requests, beforeReply, done, answer;
beforeEach(async () => {
  logs.length = 0; writes.length = 0; requests = []; onConfiguration = () => {}; beforeReply = () => {};
  done = true; answer = JSON.stringify({ decision: 'CONFIRM', reason: 'Owned supplied support' });
  admission.admit.mockReset().mockResolvedValue(null); lock.acquireLock.mockReset().mockResolvedValue(undefined); lock.releaseLock.mockClear();
  admission.failed.mockClear(); invalidation.mockClear();
  server = createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requests.push({ path: request.url, body });
    const currentDone = done; beforeReply();
    response.setHeader('Content-Type', request.url === '/api/generate' ? 'application/x-ndjson' : 'application/json');
    response.end(request.url === '/api/generate' ? JSON.stringify({ model: 'synthetic:latest', done: currentDone, response: answer }) + '\n'
      : JSON.stringify({ choices: [{ message: { content: answer } }], usage: {} }));
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); }); url = `http://127.0.0.1:${server.address().port}`;
  // The published OpenAI endpoint is fixed in production. Redirect only this owned fixture's resolver.
  jest.spyOn(cloudLLMService, 'getEndpoint').mockReturnValue(url);
  jest.spyOn(ollamaService, 'getConfig').mockResolvedValue({ baseUrl: url, model: 'synthetic:latest' });
  jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });
  jest.spyOn(libraryProfileService, 'getProfileStats').mockImplementation(async () => verificationProfile());
});
afterEach(async () => { jest.restoreAllMocks(); server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); });

function provider(type, verified = true) {
  return { type, config: { primary_provider: type, api_endpoint: url, host: url, model: 'synthetic:latest',
    ...(type === 'ollama' ? { verificationModelDigest: 'a'.repeat(64) } : {}) },
  authority: buildAiProviderAuthorityProfile({ providerId: type, model: 'synthetic:latest', requestedMode: 'verification',
    ...(verified && type === 'ollama' ? { ollamaVerificationCapability: { providerId: 'ollama', model: 'synthetic:latest', verified: true, modelDigest: 'a'.repeat(64) } } : {}) }) };
}
function choose(type, hook = () => {}, verified = true) {
  jest.spyOn(aiRouterService, 'getProvider').mockImplementation(async () => { hook(); return provider(type, verified); });
}
function prompt(index = 0) { const body = requests[index].body; return body.prompt || body.messages.find(message => message.role === 'user').content; }
async function execute(value, copied = false) {
  const owner = new ClassificationPolicyPathService({ logger, classificationAiService,
    policyEngine: { evaluateItem: async () => copied ? { ...value.result } : value.result },
    classificationRagLoopService: { evaluateRagLoopSecondPass: async ({ baselineResult }) => baselineResult },
    classificationRoutingService: { ensureDecisionQuestion } });
  return owner.execute({ metadata: value.item, libraries: value.libraries, relatedEvidence: [] });
}

test.each(['ollama', 'openai'])('actual %s initial owner verification gets qualified optional advice/profile without extra authority', async type => {
  const value = await policyRecoveryReferenceFixture({ confidence: 73 }); choose(type);
  const result = (await execute(value)).result;
  expect(requests).toHaveLength(1); expect(libraryProfileService.getProfileStats).toHaveBeenCalledWith(value.libraries[0].id);
  expect(prompt()).toContain('Suggested Library: Owned destination 0'); expect(prompt()).toContain('Calculated Confidence: 73%');
  expect(prompt()).toContain('Owned profile observation'); expect(prompt()).toContain('Existing placement is observed evidence');
  expect(prompt()).not.toMatch(/Signal Breakdown|Primary Viability|Related Evidence|DECLARED POSITIVE PURPOSE/u);
  expect(prompt()).toContain('CANDIDATE-BOUND VERIFICATION MODE');
  expect(requests[0].body.format || requests[0].body.response_format.json_schema.schema).toEqual(candidateBoundVerificationResponseSchema);
  expect(result.deterministic_ai_mode.mode).toBe('verify'); expect(result.confidence).toBe(73);
  expect(result.candidate_bound_verification.status_id).toBe('confirmed');
  expect(result.ai_authority.sideEffects).toMatchObject({ canRoute: false, canLearn: false });
  expect(JSON.stringify({ result, logs, writes })).not.toMatch(/policyVerificationAdvice|verification_advice_projection|Owned profile observation/u);
});

test.each(['ollama', 'openai'])('copied live result through actual %s owner omits optional material but retains target/call contract', async type => {
  const value = await policyRecoveryReferenceFixture(); choose(type);
  const result = (await execute(value, true)).result;
  expect(requests).toHaveLength(1); expect(libraryProfileService.getProfileStats).not.toHaveBeenCalled();
  expect(prompt()).not.toMatch(/POLICY ENGINE SIGNALS|LIBRARY PROFILE/u); expect(prompt()).toContain('CANDIDATE-BOUND VERIFICATION MODE');
  expect(result.candidate_bound_verification.status_id).toBe('confirmed'); expect(result.confidence).toBe(70);
});

test.each(['configuration', 'provider', 'admission', 'profile', 'formatting', 'lock'])(
  '%s await mutation removes optional sections before real dispatch', async phase => {
    const value = await policyRecoveryReferenceFixture();
    const change = () => { value.libraries[0].is_active = false; };
    choose('ollama', phase === 'provider' ? change : undefined);
    if (phase === 'configuration') onConfiguration = change;
    if (phase === 'admission') admission.admit.mockImplementation(async () => { change(); });
    if (phase === 'profile') libraryProfileService.getProfileStats.mockImplementation(async () => { change(); return verificationProfile(); });
    if (phase === 'lock') lock.acquireLock.mockImplementation(async () => { change(); });
    if (phase === 'formatting') {
      const original = aiPromptBuilder.buildPrompt.bind(aiPromptBuilder);
      jest.spyOn(aiPromptBuilder, 'buildPrompt').mockImplementation(async (...args) => { const result = await original(...args); change(); return result; });
    }
    await execute(value);
    expect(requests).toHaveLength(1); expect(prompt()).not.toMatch(/POLICY ENGINE SIGNALS|LIBRARY PROFILE/u);
    expect(prompt()).toContain('CANDIDATE-BOUND VERIFICATION MODE');
    expect(libraryProfileService.getProfileStats).toHaveBeenCalledTimes(['configuration', 'provider', 'admission'].includes(phase) ? 0 : 1);
  });

test('existing transient stream retry rechecks advice without changing the two-attempt bound', async () => {
  const value = await policyRecoveryReferenceFixture(); choose('ollama'); done = false;
  beforeReply = () => { done = true; value.libraries[0].is_active = false; };
  await execute(value);
  expect(requests).toHaveLength(2); expect(prompt(0)).toContain('POLICY ENGINE SIGNALS');
  expect(prompt(1)).not.toMatch(/POLICY ENGINE SIGNALS|LIBRARY PROFILE/u);
  expect(libraryProfileService.getProfileStats).toHaveBeenCalledTimes(1); expect(admission.admit).toHaveBeenCalledTimes(1);
});

test('unverified provider still refuses before profile/prompt/lock/generation even with genuine proof', async () => {
  const value = await policyRecoveryReferenceFixture(); choose('ollama', undefined, false);
  const result = (await execute(value)).result;
  expect(requests).toHaveLength(0); expect(libraryProfileService.getProfileStats).not.toHaveBeenCalled(); expect(lock.acquireLock).not.toHaveBeenCalled();
  expect(result.candidate_bound_verification.status_id).toBe('provider_capability_unavailable');
});

test('scoped null proof blocks explicit policy override; unscoped direct verification retains compatibility', async () => {
  const value = await policyRecoveryReferenceFixture(); choose('ollama');
  const options = { mode: 'verify', verificationCandidate: value.result.topCandidate,
    policySignals: { confidence: 99, suggestedLibrary: { name: 'UNBOUND OVERRIDE' } } };
  await classificationAiService.aiClassify(value.item, value.libraries, value.context, { ...options, policyVerificationAdvice: null });
  expect(prompt()).not.toContain('UNBOUND OVERRIDE'); expect(prompt()).not.toContain('POLICY ENGINE SIGNALS');
  await classificationAiService.aiClassify(value.item, value.libraries, value.context, options);
  expect(requests).toHaveLength(2); expect(prompt(1)).toContain('UNBOUND OVERRIDE');
  expect(libraryProfileService.getProfileStats).toHaveBeenCalledTimes(1);
});

test('out-of-contract verification output cannot add a repair or route permission', async () => {
  const value = await policyRecoveryReferenceFixture(); choose('ollama'); answer = JSON.stringify({ decision: 'CONFIRM', reason: 'Owned', library_number: 999 });
  const result = (await execute(value)).result;
  expect(requests).toHaveLength(1); expect(result.candidate_bound_verification.status_id).toBe('contract_violation');
  expect(result.ai_authority.sideEffects.canRoute).toBe(false);
});

test('prompt assembly rejection cannot become a provider retry, refusal observation or capability invalidation', async () => {
  const value = await policyRecoveryReferenceFixture(); choose('ollama');
  const failure = Object.assign(new Error('Owned assembly failure'), { code: 'ETIMEDOUT' });
  jest.spyOn(aiPromptBuilder, 'buildPrompt').mockRejectedValue(failure);
  await expect(classificationAiService.aiClassify(value.item, value.libraries, value.context,
    { mode: 'verify', verificationCandidate: value.result.topCandidate, policyVerificationAdvice: holdPolicyVerificationAdvice(value.args) })).rejects.toBe(failure);
  expect(requests).toHaveLength(0); expect(admission.failed).not.toHaveBeenCalled(); expect(invalidation).not.toHaveBeenCalled();
  expect(aiPromptBuilder.buildPrompt).toHaveBeenCalledTimes(1); expect(lock.releaseLock).toHaveBeenCalledTimes(1);
});

async function executeRag(value, { copied = false, afterStage = () => {}, cap = 2 } = {}) {
  jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(copied ? { ...value.result } : value.result);
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const stage = await runPolicyRecheckStage(value.ctx);
  expect(stage.policyGate.shouldAdopt).toBe(true); afterStage(stage);
  return runAiRerunStage({ ...value.ctx, config: { ...value.ctx.config, policy_recheck_max_ai_calls_per_item: cap },
    policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate, policyRecheckStage: stage,
    aiClassify: classificationAiService.aiClassify });
}

test.each(['ollama', 'openai'])('actual %s adopted RAG verification owns its invocation context and current advisory', async type => {
  const value = await ragRecheckAdviceFixture({ confidence: 73 }); choose(type);
  value.ctx.baselineResult.ai_advisory = { version: 'classification.ai_advisory.v1', message: 'EARLIER ADVISORY SENTINEL' };
  const classify = jest.spyOn(classificationAiService, 'aiClassify');
  const result = await executeRag(value);
  expect(requests).toHaveLength(1); expect(result.aiCallsUsed).toBe(2);
  expect(prompt()).toContain('Suggested Library: Owned destination 0'); expect(prompt()).toContain('Calculated Confidence: 73%');
  expect(prompt()).toContain('Owned profile observation'); expect(prompt()).not.toContain('EARLIER PASS SENTINEL');
  expect(prompt()).not.toContain('Signal Breakdown'); expect(prompt()).not.toContain('DECLARED POSITIVE PURPOSE');
  expect(result.pass2Candidate.signalContext).toBe(classify.mock.calls[0][2]);
  expect(result.pass2Candidate.signalContext.ranked).toBe(value.result.ranked);
  expect(result.pass2Candidate.ai_advisory).toBeNull();
  expect(result.pass2Candidate.library).toBe(value.libraries[0]); expect(result.pass2Candidate.confidence).toBe(73);
  expect(result.pass2Candidate.candidate_bound_verification.status_id).toBe('confirmed');
  expect(result.pass2Candidate.ai_authority.sideEffects).toMatchObject({ canRoute: false, canLearn: false });
  expect(JSON.stringify({ result, logs, writes })).not.toMatch(/ragRecheckVerificationAdvice|Owned profile observation/u);
});

test.each(['ollama', 'openai'])('copied RAG result skips %s verification and records a review gap', async type => {
  const value = await ragRecheckAdviceFixture(); choose(type);
  const result = await executeRag(value, { copied: true });
  expect(requests).toHaveLength(0); expect(result.aiCallsUsed).toBe(1);
  expect(aiRouterService.getProvider).not.toHaveBeenCalled();
  expect(libraryProfileService.getProfileStats).not.toHaveBeenCalled(); expect(result.pass2Candidate.confidence).toBe(70);
  const published = publishCurrentPolicyReviewFrame(result.pass2Candidate, { ...result.pass2Candidate });
  expect(projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(published, value.item)).status).toBe('evidence_gap');
});

test.each(['handoff', 'profile', 'formatting', 'lock'])('RAG %s mutation refuses dispatch with truthful invocation accounting', async phase => {
  const value = await ragRecheckAdviceFixture(); choose('ollama');
  if (phase === 'profile') libraryProfileService.getProfileStats.mockImplementation(async () => { value.libraries[0].is_active = false; return verificationProfile(); });
  if (phase === 'lock') lock.acquireLock.mockImplementation(async () => { value.libraries[0].is_active = false; });
  if (phase === 'formatting') {
    const original = aiPromptBuilder.buildPrompt.bind(aiPromptBuilder);
    jest.spyOn(aiPromptBuilder, 'buildPrompt').mockImplementation(async (...args) => { const text = await original(...args); value.libraries[0].is_active = false; return text; });
  }
  const result = await executeRag(value, { afterStage: stage => { if (phase === 'handoff') stage.policyGate = { ...stage.policyGate }; } });
  expect(requests).toHaveLength(0); expect(result.aiCallsUsed).toBe(phase === 'handoff' ? 1 : 2);
  expect(result.pass2Candidate.library).toBe(value.libraries[0]);
  expect(admission.failed).not.toHaveBeenCalled(); expect(invalidation).not.toHaveBeenCalled();
});

test('RAG provider refusal and exhausted item cap retain their existing distinct counter/dispatch behavior', async () => {
  const value = await ragRecheckAdviceFixture(); choose('ollama', undefined, false);
  const refused = await executeRag(value);
  expect(requests).toHaveLength(0); expect(refused.aiCallsUsed).toBe(2); expect(libraryProfileService.getProfileStats).not.toHaveBeenCalled();
  expect(refused.pass2Candidate.candidate_bound_verification.status_id).toBe('provider_capability_unavailable');
  jest.restoreAllMocks(); choose('ollama');
  const capped = await executeRag(await ragRecheckAdviceFixture(), { cap: 1 });
  expect(requests).toHaveLength(0); expect(capped.aiCallsUsed).toBe(1);
});

test.each(['apply', 'shadow', 'comparison rejection', 'rollout mutation'])('whole production adopted RAG owner %s carries its review source through actual HTTP', async scenario => {
  const value = await ragRecheckAdviceFixture(); choose('ollama');
  const earlierAdvisory = { version: 'classification.ai_advisory.v1', message: 'EARLIER ADVISORY SENTINEL' };
  value.ctx.baselineResult.ai_advisory = earlierAdvisory;
  const classify = jest.spyOn(classificationRagLoopService, 'aiClassify');
  const metadata = { ...value.item, genres: ['Animation'], keywords: ['Owned retrieval evidence'] };
  const config = { ...value.ctx.config, rag_retrieval_loop_enabled: true, rag_loop_rollout_mode: scenario === 'shadow' ? 'shadow' : 'apply',
    rag_loop_trace_enabled: false, rag_loop_auto_fallback_enabled: false, rag_loop_auto_recover_enabled: false,
    rag_loop_conflict_detection_enabled: false, rag_loop_resilience_enabled: false,
    policy_recheck_below_prompt_threshold_enabled: true, policy_recheck_metadata_enrichment_enabled: false,
    policy_recheck_metadata_timeout_ms: 2000, policy_recheck_identifier_caps: { keywords: 8, genres: 5, studios: 3, cast: 3 },
    rag_conflict_top_n: 5, rag_loop_candidate_limit: 25, rag_retry_strategy: 'hybrid' };
  jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);
  if (scenario === 'rollout mutation') jest.spyOn(classificationRagLoopService, 'maybeApplyRolloutAutomation').mockImplementation(async () => {
    value.libraries[0].is_active = false;
  });
  jest.spyOn(ragRetriever, 'semanticSearchCandidates').mockImplementation(async (_item, _limit, options) =>
    [{ libraryId: options.pass === 'pass1' ? 2001 : 101, similarity: options.pass === 'pass1' ? 0.6 : 0.95 }]);
  jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([{ libraryId: 101, similarity: 0.95 }]);
  jest.spyOn(ragRetriever, 'hybridSearch').mockResolvedValue([{ libraryId: 101, similarity: 0.95 }]);
  jest.spyOn(ragRetriever, 'getSuggestedLibrary').mockReturnValue({ libraryId: 101, avgSimilarity: 0.95 });
  let freshPolicyResult;
  const evaluate = jest.spyOn(policyEngine, 'evaluateItem').mockImplementation(async expanded => {
    expect(expanded).not.toBe(metadata);
    freshPolicyResult = (await policyRecoveryReferenceFixture({ item: expanded })).result;
    return freshPolicyResult;
  });
  if (scenario === 'comparison rejection') beforeReply = () => {
    freshPolicyResult.ranked[0].candidate_diagnostics.primary_anchor_eligible = false;
  };
  const result = await classificationRagLoopService.evaluateRagLoopSecondPass({ metadata, libraries: value.libraries,
    baselineResult: value.ctx.baselineResult, policyResult: value.ctx.policyResult, signalContext: value.ctx.signalContext, ragContext: null });
  expect(evaluate).toHaveBeenCalledTimes(1); expect(requests).toHaveLength(1);
  expect(prompt()).toContain('Suggested Library: Owned destination 0'); expect(prompt()).toContain('Owned profile observation');
  expect(prompt()).not.toContain('EARLIER PASS SENTINEL');
  const held = holdCurrentPolicyReviewFrame(result, metadata);
  if (scenario === 'shadow' || scenario === 'comparison rejection') {
    expect(result.library).toBe(value.ctx.baselineResult.library);
    expect(result.signalContext).toBe(value.ctx.signalContext);
    expect(result.ai_advisory).toBe(earlierAdvisory);
    expect(held).toBeNull();
  } else {
    expect(result.library.id).toBe(101);
    expect(result.candidate_bound_verification.status_id).toBe('confirmed');
    expect(result.signalContext).toBe(classify.mock.calls[0][2]);
    expect(result.ai_advisory).toBeNull();
    expect(projectCurrentPolicyReviewFrame(held).status).toBe(scenario === 'rollout mutation' ? 'evidence_gap' : 'recorded');
  }
});

test.each(['CONFIRM', 'ABSTAIN', 'invalid', 'unsupported'])('actual adopted %s outcome supplies a bounded review attempt', async outcome => {
  const value = await ragRecheckAdviceFixture({ confidence: 75 });
  value.ctx.baselineResult.ai_advisory = { version: 'classification.ai_advisory.v1', message: 'EARLIER ADVISORY SENTINEL' };
  choose('ollama', undefined, outcome !== 'unsupported');
  const classify = jest.spyOn(classificationAiService, 'aiClassify');
  if (outcome === 'ABSTAIN') answer = '{"decision":"ABSTAIN","reason":"Owned uncertainty"}';
  if (outcome === 'invalid') answer = '{"decision":"CONFIRM","reason":"Owned","library_number":99}';
  const result = await executeRag(value);
  expect(requests).toHaveLength(outcome === 'unsupported' ? 0 : 1);
  expect(result.aiCallsUsed).toBe(2);
  expect(result.pass2Candidate.signalContext).toBe(classify.mock.calls[0][2]);
  expect(result.pass2Candidate.signalContext.confidence).toBe(75);
  expect(result.pass2Candidate.signalContext.ranked).toBe(value.result.ranked);
  expect(result.pass2Candidate.ai_advisory).toBe(outcome === 'CONFIRM' ? null : (await classify.mock.results[0].value).ai_advisory);
  expect(JSON.stringify(result.pass2Candidate)).not.toContain('EARLIER ADVISORY SENTINEL');
  expect(result.pass2Candidate.candidate_bound_verification.status_id).toBe(
    outcome === 'CONFIRM' ? 'confirmed' : outcome === 'ABSTAIN' ? 'abstained' :
      outcome === 'invalid' ? 'contract_violation' : 'provider_capability_unavailable');
  expect(result.pass2Candidate.ai_authority.sideEffects).toMatchObject({ canRoute: false, canLearn: false });
  const published = publishCurrentPolicyReviewFrame(result.pass2Candidate, { ...result.pass2Candidate });
  expect(projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(published, value.item)))
    .toMatchObject({ status: 'recorded', policy: { confidence: 75 } });
});

test.each(['copied', 'profile', 'reply', 'long label'])('adopted %s evidence has separate numeric invocation and optional-label admission', async phase => {
  const value = await ragRecheckAdviceFixture();
  choose('ollama');
  const classify = jest.spyOn(classificationAiService, 'aiClassify');
  value.ctx.baselineResult.ai_advisory = { message: 'EARLIER ADVISORY SENTINEL' };
  if (phase === 'profile') libraryProfileService.getProfileStats.mockImplementation(async () => {
    value.libraries[0].is_active = false;
    return verificationProfile();
  });
  if (phase === 'reply') beforeReply = () => { value.result.ranked[0].score++; };
  if (phase === 'long label') value.libraries[0].name = 'x'.repeat(161);
  const result = await executeRag(value, { copied: phase === 'copied' });
  expect(requests).toHaveLength(['reply', 'long label'].includes(phase) ? 1 : 0);
  expect(result.aiCallsUsed).toBe(phase === 'copied' ? 1 : 2);
  expect(result.hadError).toBe(false);
  if (phase === 'long label') {
    expect(result.pass2Candidate.candidate_bound_verification.status_id).toBe('confirmed');
    expect(result.pass2Candidate.signalContext).toBe(classify.mock.calls[0][2]);
    expect(result.pass2Candidate.ai_advisory).toBeNull();
  } else {
    expect(result.pass2Candidate.candidate_bound_verification).toBeUndefined();
    expect(result.pass2Candidate.library).toBe(value.libraries[0]);
  }
  const published = publishCurrentPolicyReviewFrame(result.pass2Candidate, { ...result.pass2Candidate });
  expect(projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(published, value.item)).status)
    .toBe(phase === 'long label' ? 'recorded' : 'evidence_gap');
  if (phase === 'long label') expect(libraryProfileService.getProfileStats).not.toHaveBeenCalled();
});

async function executeNonadopted(value, { copied = false, afterStage = () => {}, cap = 2 } = {}) {
  jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(copied ? { ...value.result } : value.result);
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const stage = await runPolicyRecheckStage(value.ctx);
  expect(stage.policyGate.shouldAdopt).toBe(false); expect(stage.pass2Candidate).toBeNull();
  const used = afterStage(stage) || stage;
  return runAiRerunStage({ ...value.ctx, config: { ...value.ctx.config, policy_recheck_max_ai_calls_per_item: cap },
    policyAfter: used.policyAfter, existingCandidate: used.pass2Candidate, policyRecheckStage: used,
    aiClassify: classificationAiService.aiClassify });
}

function expectAdoptedGap(value, result) {
  expect(result.pass2Candidate.library).toBe(value.libraries[0]);
  const published = publishCurrentPolicyReviewFrame(result.pass2Candidate, { ...result.pass2Candidate });
  expect(projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(published, value.item)))
    .toMatchObject({ status: 'evidence_gap', policy: null });
}

test.each(['configuration', 'provider', 'admission', 'profile', 'formatting', 'lock'])(
  'adopted %s proof loss retains a charged invocation, candidate and review gap', async phase => {
    const value = await ragRecheckAdviceFixture(), change = () => { value.libraries[0].is_active = false; };
    choose('ollama', phase === 'provider' ? change : undefined);
    if (phase === 'configuration') onConfiguration = change;
    if (phase === 'admission') admission.admit.mockImplementation(async () => { change(); });
    if (phase === 'profile') libraryProfileService.getProfileStats.mockImplementation(async () => { change(); return verificationProfile(); });
    if (phase === 'lock') lock.acquireLock.mockImplementation(async () => { change(); });
    if (phase === 'formatting') {
      const build = aiPromptBuilder.buildPrompt.bind(aiPromptBuilder);
      jest.spyOn(aiPromptBuilder, 'buildPrompt').mockImplementation(async (...args) => { const text = await build(...args); change(); return text; });
    }
    const observation = jest.spyOn(aiProviderCapabilityMetricsService, 'record'), failure = jest.spyOn(ragLoopResilienceManager, 'recordFailure');
    const result = await executeRag(value);
    expect(result).toMatchObject({ aiCallsUsed: 2, hadError: false }); expect(requests).toHaveLength(0);
    expect(admission.failed).not.toHaveBeenCalled(); expect(invalidation).not.toHaveBeenCalled(); expect(observation).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
    expect(lock.releaseLock).toHaveBeenCalledTimes(['lock', 'formatting'].includes(phase) ? 1 : 0);
    expectAdoptedGap(value, result);
  });

test.each(['transport configuration', 'response', 'metrics'])(
  'adopted proof loss during %s preserves completed observations while retaining the deterministic candidate', async phase => {
    const value = await ragRecheckAdviceFixture(); choose('ollama');
    const change = () => { value.libraries[0].is_active = false; };
    if (phase === 'transport configuration') ollamaService.getConfig.mockImplementation(async () => { change(); return { baseUrl: url, model: 'synthetic:latest' }; });
    if (phase === 'response') beforeReply = change;
    const record = aiProviderCapabilityMetricsService.record.bind(aiProviderCapabilityMetricsService), deltas = [];
    const observation = jest.spyOn(aiProviderCapabilityMetricsService, 'record').mockImplementation(async (...args) => {
      const delta = await record(...args); deltas.push(delta); if (phase === 'metrics') change(); return delta;
    });
    const succeeded = jest.spyOn(admission, 'succeeded');
    const result = await executeRag(value);
    expect(result).toMatchObject({ aiCallsUsed: 2, hadError: false }); expect(requests).toHaveLength(1);
    expect(succeeded).toHaveBeenCalledTimes(1); expect(observation).toHaveBeenCalledTimes(1); expect(deltas[0].requestCount).toBe(1);
    expect(observation.mock.calls[0][0].parseResult.candidate_bound_verification.status_id).toBe('confirmed');
    expect(admission.failed).not.toHaveBeenCalled(); expect(invalidation).not.toHaveBeenCalled(); expect(lock.releaseLock).toHaveBeenCalledTimes(1);
    expectAdoptedGap(value, result);
  });

test('adopted real stream failure survives proof loss before retry without adding an HTTP attempt', async () => {
  const value = await ragRecheckAdviceFixture(); choose('ollama'); done = false;
  beforeReply = () => { value.item.tmdb_id++; };
  const observation = jest.spyOn(aiProviderCapabilityMetricsService, 'record'), classify = jest.fn(value.ctx.classifyStageError);
  value.ctx.classifyStageError = classify;
  const result = await executeRag(value);
  expect(result.pass2Candidate.library).toBe(value.libraries[0]); expect(result.aiCallsUsed).toBe(2); expect(requests).toHaveLength(1);
  expect(admission.failed).toHaveBeenCalledTimes(1); expect(invalidation).toHaveBeenCalledTimes(1); expect(observation).toHaveBeenCalledTimes(1);
  const error = admission.failed.mock.calls[0][1];
  expect(classify).toHaveBeenCalledWith('ai_rerun', error, 'ai_rerun_failed');
  expect(observation.mock.calls[0][0].generationError).toBe(error);
  expect(holdCurrentPolicyReviewFrame(result.pass2Candidate, value.item)).toBeNull(); // Existing genuine-error fallback.
});

test('adopted genuine rejected operation keeps its identity when source proof also changes', async () => {
  const value = await ragRecheckAdviceFixture(); choose('ollama');
  const error = new Error('Fresh verification context is unavailable');
  admission.admit.mockImplementation(async () => { value.item.tmdb_id++; throw error; });
  const classify = jest.fn(value.ctx.classifyStageError); value.ctx.classifyStageError = classify;
  const result = await executeRag(value);
  expect(result.hadError).toBe(true); expect(result.aiCallsUsed).toBe(2); expect(requests).toHaveLength(0);
  expect(classify).toHaveBeenCalledWith('ai_rerun', error, 'ai_rerun_failed');
});

test.each(['ollama', 'openai'])('non-adopted %s verification coherently dispatches fresh B/75 rather than old A/80', async type => {
  const value = await nonadoptedRagVerificationFixture(); choose(type);
  value.ctx.baselineResult.ai_advisory = { version: 'classification.ai_advisory.v1', message: 'EARLIER ADVISORY SENTINEL' };
  const result = await executeNonadopted(value);
  expect(requests).toHaveLength(1); expect(result.aiCallsUsed).toBe(2);
  expect(prompt()).toContain('Suggested Library: Owned destination 0'); expect(prompt()).toContain('Calculated Confidence: 75%');
  expect(prompt()).not.toMatch(/EARLIER PASS SENTINEL|Signal Breakdown|Calculated Confidence: 80%/u);
  expect(requests[0].body.format || requests[0].body.response_format.json_schema.schema).toEqual(candidateBoundVerificationResponseSchema);
  expect(result.pass2Candidate.library).toBe(value.libraries[0]); expect(result.pass2Candidate.confidence).toBe(75);
  expect(result.pass2Candidate.candidate_bound_verification.status_id).toBe('confirmed');
  expect(result.pass2Candidate.ai_authority.sideEffects).toMatchObject({ canRoute: false, canLearn: false });
  expect(result.pass2Candidate.signalContext).toMatchObject({ confidence: 75, suggestedLibrary: value.libraries[0] });
  expect(result.pass2Candidate.signalContext).not.toBe(value.ctx.signalContext);
  expect(result.pass2Candidate.ai_advisory).toBeNull();
  expect(JSON.stringify(result.pass2Candidate)).not.toContain('EARLIER ADVISORY SENTINEL');
  expect(JSON.stringify({ result, logs, writes })).not.toMatch(/nonadoptedRagVerification|Owned profile observation/u);
});

test('same destination retains fresh overall confidence rather than earlier or leading score', async () => {
  const value = await nonadoptedRagVerificationFixture(); choose('ollama');
  value.ctx = nonadoptedRagContext(value, { earlier: value.libraries[0] });
  expect(value.result.ranked[0].score).not.toBe(75);
  const result = await executeNonadopted(value);
  expect(requests).toHaveLength(1); expect(result.pass2Candidate.confidence).toBe(75);
});

test.each(['ABSTAIN', 'invalid', 'unsupported'])('%s result retains the same fresh numeric verification reference without repair', async kind => {
  const value = await nonadoptedRagVerificationFixture(); choose('ollama', undefined, kind !== 'unsupported');
  value.ctx.baselineResult.ai_advisory = { version: 'classification.ai_advisory.v1', message: 'EARLIER ADVISORY SENTINEL' };
  answer = kind === 'invalid' ? '{"decision":"CONFIRM","reason":"Owned","library_number":99}' : '{"decision":"ABSTAIN","reason":"Owned uncertainty"}';
  const result = await executeNonadopted(value);
  expect(requests).toHaveLength(kind === 'unsupported' ? 0 : 1); expect(result.aiCallsUsed).toBe(2);
  expect(result.pass2Candidate.library).toBe(value.libraries[0]); expect(result.pass2Candidate.confidence).toBe(75);
  expect(result.pass2Candidate.candidate_bound_verification.status_id).toBe(
    kind === 'unsupported' ? 'provider_capability_unavailable' : kind === 'invalid' ? 'contract_violation' : 'abstained');
  expect(result.pass2Candidate.ai_authority.sideEffects.canRoute).toBe(false);
  expect(result.pass2Candidate.signalContext.confidence).toBe(75);
  expect(result.pass2Candidate.ai_advisory.deterministic_candidate.library_id).toBe(value.libraries[0].id);
  expect(JSON.stringify(result.pass2Candidate.ai_advisory)).not.toContain('EARLIER ADVISORY SENTINEL');
});

test.each(['copied result', 'copied stage', 'changed source', 'cap'])('%s skips non-adopted verification before service invocation', async kind => {
  const value = await nonadoptedRagVerificationFixture(); choose('ollama');
  const result = await executeNonadopted(value, { copied: kind === 'copied result', cap: kind === 'cap' ? 1 : 2,
    afterStage: stage => { if (kind === 'copied stage') return { ...stage }; if (kind === 'changed source') value.item.tmdb_id++; } });
  expect(result).toEqual({ pass2Candidate: null, aiCallsUsed: 1, hadError: false });
  expect(requests).toHaveLength(0); expect(aiRouterService.getProvider).not.toHaveBeenCalled();
  expect(libraryProfileService.getProfileStats).not.toHaveBeenCalled(); expect(admission.failed).not.toHaveBeenCalled();
});

test.each(['configuration', 'provider', 'admission', 'profile', 'formatting', 'lock'])(
  'non-adopted %s proof loss retains a charged invocation without a provider failure', async phase => {
    const value = await nonadoptedRagVerificationFixture(), change = () => { value.libraries[0].is_active = false; };
    choose('ollama', phase === 'provider' ? change : undefined);
    if (phase === 'configuration') onConfiguration = change;
    if (phase === 'admission') admission.admit.mockImplementation(async () => { change(); });
    if (phase === 'profile') libraryProfileService.getProfileStats.mockImplementation(async () => { change(); return verificationProfile(); });
    if (phase === 'lock') lock.acquireLock.mockImplementation(async () => { change(); });
    if (phase === 'formatting') {
      const original = aiPromptBuilder.buildPrompt.bind(aiPromptBuilder);
      jest.spyOn(aiPromptBuilder, 'buildPrompt').mockImplementation(async (...args) => { const text = await original(...args); change(); return text; });
    }
    const observation = jest.spyOn(aiProviderCapabilityMetricsService, 'record'), failure = jest.spyOn(ragLoopResilienceManager, 'recordFailure');
    const result = await executeNonadopted(value);
    expect(result).toEqual({ pass2Candidate: null, aiCallsUsed: 2, hadError: false }); expect(requests).toHaveLength(0);
    expect(admission.failed).not.toHaveBeenCalled(); expect(invalidation).not.toHaveBeenCalled(); expect(observation).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
    expect(lock.releaseLock).toHaveBeenCalledTimes(['lock', 'formatting'].includes(phase) ? 1 : 0);
  });

test.each(['transport configuration', 'response', 'metrics'])(
  'proof loss during %s preserves real completed observations but discards the result', async phase => {
    const value = await nonadoptedRagVerificationFixture(); choose('ollama');
    const change = () => { value.libraries[0].is_active = false; };
    if (phase === 'transport configuration') ollamaService.getConfig.mockImplementation(async () => { change(); return { baseUrl: url, model: 'synthetic:latest' }; });
    if (phase === 'response') beforeReply = change;
    const original = aiProviderCapabilityMetricsService.record.bind(aiProviderCapabilityMetricsService), deltas = [];
    const observation = jest.spyOn(aiProviderCapabilityMetricsService, 'record').mockImplementation(async (...args) => {
      const delta = await original(...args); deltas.push(delta); if (phase === 'metrics') change(); return delta;
    });
    const succeeded = jest.spyOn(admission, 'succeeded');
    const result = await executeNonadopted(value);
    expect(result).toEqual({ pass2Candidate: null, aiCallsUsed: 2, hadError: false }); expect(requests).toHaveLength(1);
    expect(succeeded).toHaveBeenCalledTimes(1); expect(observation).toHaveBeenCalledTimes(1); expect(deltas[0].requestCount).toBe(1);
    expect(observation.mock.calls[0][0].parseResult.candidate_bound_verification.status_id).toBe('confirmed');
    expect(admission.failed).not.toHaveBeenCalled(); expect(invalidation).not.toHaveBeenCalled(); expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });

test('a real failed stream survives source loss before its retry, with one HTTP attempt and its error observation', async () => {
  const value = await nonadoptedRagVerificationFixture(); choose('ollama'); done = false;
  beforeReply = () => { value.item.tmdb_id++; };
  const observation = jest.spyOn(aiProviderCapabilityMetricsService, 'record'), classifyStageError = jest.fn(value.ctx.classifyStageError);
  value.ctx.classifyStageError = classifyStageError;
  const result = await executeNonadopted(value);
  expect(result.pass2Candidate).toBeNull(); expect(result.aiCallsUsed).toBe(2); expect(requests).toHaveLength(1);
  expect(admission.failed).toHaveBeenCalledTimes(1); expect(invalidation).toHaveBeenCalledTimes(1); expect(observation).toHaveBeenCalledTimes(1);
  const error = admission.failed.mock.calls[0][1];
  expect(classifyStageError).toHaveBeenCalledWith('ai_rerun', error, 'ai_rerun_failed');
  expect(observation.mock.calls[0][0].generationError).toBe(error);
});

test('a genuinely rejected pre-dispatch operation keeps its error when proof also changes', async () => {
  const value = await nonadoptedRagVerificationFixture(); choose('ollama');
  const error = Object.assign(new Error('Fresh verification context is unavailable'), { code: 'FRESH_VERIFICATION_CONTEXT_UNAVAILABLE' });
  admission.admit.mockImplementation(async () => { value.item.tmdb_id++; throw error; });
  const classifyStageError = jest.fn(value.ctx.classifyStageError); value.ctx.classifyStageError = classifyStageError;
  const result = await executeNonadopted(value);
  expect(result.hadError).toBe(true); expect(result.aiCallsUsed).toBe(2); expect(requests).toHaveLength(0);
  expect(classifyStageError).toHaveBeenCalledWith('ai_rerun', error, 'ai_rerun_failed');
});

test.each(['apply', 'shadow', 'comparison rejection', 'rollout mutation'])('production RAG %s keeps policy rejection separate from final fresh verification comparison', async scenario => {
  const mode = scenario === 'shadow' ? 'shadow' : 'apply';
  const value = await nonadoptedRagVerificationFixture(); choose('ollama');
  const earlierAdvisory = { version: 'classification.ai_advisory.v1', message: 'EARLIER ADVISORY SENTINEL' };
  value.ctx.baselineResult.ai_advisory = earlierAdvisory;
  const metadata = { ...value.item, genres: ['Animation'], keywords: ['Owned retrieval evidence'] };
  const config = { ...value.ctx.config, rag_retrieval_loop_enabled: true, rag_loop_rollout_mode: mode,
    rag_loop_trace_enabled: true, rag_loop_auto_fallback_enabled: false, rag_loop_auto_recover_enabled: false,
    rag_loop_conflict_detection_enabled: false, rag_loop_resilience_enabled: false,
    policy_recheck_below_prompt_threshold_enabled: true, policy_recheck_metadata_enrichment_enabled: false,
    policy_recheck_identifier_caps: { keywords: 8, genres: 5, studios: 3, cast: 3 },
    rag_conflict_top_n: 5, rag_loop_candidate_limit: 25, rag_retry_strategy: 'hybrid' };
  jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);
  if (scenario === 'rollout mutation') jest.spyOn(classificationRagLoopService, 'maybeApplyRolloutAutomation').mockImplementation(async () => {
    value.libraries[0].is_active = false;
  });
  // Two destinations keep the margin unchanged while top similarity improves enough for AI eligibility only.
  const matches = pass => [{ libraryId: 101, similarity: pass === 'pass1' ? 0.5 : 0.6 },
    { libraryId: 2001, similarity: pass === 'pass1' ? 0.2 : 0.3 }];
  jest.spyOn(ragRetriever, 'semanticSearchCandidates').mockImplementation(async (_item, _limit, options) => matches(options.pass));
  jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue(matches('pass2'));
  jest.spyOn(ragRetriever, 'hybridSearch').mockResolvedValue(matches('pass2'));
  jest.spyOn(ragRetriever, 'getSuggestedLibrary').mockReturnValue({ libraryId: 101, avgSimilarity: 0.6 });
  const evaluate = jest.spyOn(policyEngine, 'evaluateItem').mockImplementation(async expanded => {
    expect(expanded).not.toBe(metadata);
    const evaluated = await policyRecoveryReferenceFixture({ item: expanded, confidence: 75 });
    if (scenario === 'comparison rejection') evaluated.result.ranked[0].candidate_diagnostics.primary_anchor_eligible = false;
    return evaluated.result;
  });
  const result = await classificationRagLoopService.evaluateRagLoopSecondPass({ metadata, libraries: value.libraries,
    baselineResult: value.ctx.baselineResult, policyResult: value.ctx.policyResult, signalContext: value.ctx.signalContext, ragContext: null });
  expect(evaluate).toHaveBeenCalledTimes(1); expect(requests).toHaveLength(1);
  expect(prompt()).toContain('Calculated Confidence: 75%');
  expect(result.ragLoopTrace.events).toEqual(expect.arrayContaining([
    expect.objectContaining({ stage: 'policy_recheck', outcome: 'evaluated' }),
    expect.objectContaining({ stage: 'ai_rerun', outcome: 'applied' }),
  ]));
  const baselineSelected = mode === 'shadow' || scenario === 'comparison rejection';
  if (baselineSelected) {
    expect(result.signalContext).toBe(value.ctx.signalContext);
    expect(result.ai_advisory).toBe(earlierAdvisory);
  } else {
    expect(result.signalContext).toMatchObject({ confidence: 75, suggestedLibrary: value.libraries[0], ranked: result.policyResult.ranked });
    expect(result.ai_advisory).toBeNull();
  }
  expect(result.library).toBe(baselineSelected ? value.ctx.baselineResult.library : value.libraries[0]);
  const held = holdCurrentPolicyReviewFrame(result, metadata);
  if (baselineSelected) expect(held).toBeNull();
  else expect(projectCurrentPolicyReviewFrame(held).status).toBe(scenario === 'rollout mutation' ? 'evidence_gap' : 'recorded');
});
