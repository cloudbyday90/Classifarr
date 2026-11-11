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
const { ragRetriever } = await import('../../services/ragRetriever.mjs');

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

test.each(['ollama', 'openai'])('actual %s adopted RAG verification uses fresh advice without earlier-pass leakage or result-context repair', async type => {
  const value = await ragRecheckAdviceFixture({ confidence: 73 }); choose(type);
  const result = await executeRag(value);
  expect(requests).toHaveLength(1); expect(result.aiCallsUsed).toBe(2);
  expect(prompt()).toContain('Suggested Library: Owned destination 0'); expect(prompt()).toContain('Calculated Confidence: 73%');
  expect(prompt()).toContain('Owned profile observation'); expect(prompt()).not.toContain('EARLIER PASS SENTINEL');
  expect(prompt()).not.toContain('Signal Breakdown'); expect(prompt()).not.toContain('DECLARED POSITIVE PURPOSE');
  expect(result.pass2Candidate.signalContext).toBe(value.ctx.signalContext);
  expect(result.pass2Candidate.library).toBe(value.libraries[0]); expect(result.pass2Candidate.confidence).toBe(73);
  expect(result.pass2Candidate.candidate_bound_verification.status_id).toBe('confirmed');
  expect(result.pass2Candidate.ai_authority.sideEffects).toMatchObject({ canRoute: false, canLearn: false });
  expect(JSON.stringify({ result, logs, writes })).not.toMatch(/ragRecheckVerificationAdvice|Owned profile observation/u);
});

test.each(['ollama', 'openai'])('copied RAG result keeps actual %s verification but omits optional sections', async type => {
  const value = await ragRecheckAdviceFixture(); choose(type);
  const result = await executeRag(value, { copied: true });
  expect(requests).toHaveLength(1); expect(result.aiCallsUsed).toBe(2);
  expect(prompt()).toContain('CANDIDATE-BOUND VERIFICATION MODE'); expect(prompt()).not.toMatch(/POLICY ENGINE SIGNALS|LIBRARY PROFILE/u);
  expect(libraryProfileService.getProfileStats).not.toHaveBeenCalled(); expect(result.pass2Candidate.confidence).toBe(70);
});

test.each(['handoff', 'profile', 'formatting', 'lock'])('RAG %s mutation removes optional material without changing the existing call count', async phase => {
  const value = await ragRecheckAdviceFixture(); choose('ollama');
  if (phase === 'profile') libraryProfileService.getProfileStats.mockImplementation(async () => { value.libraries[0].is_active = false; return verificationProfile(); });
  if (phase === 'lock') lock.acquireLock.mockImplementation(async () => { value.libraries[0].is_active = false; });
  if (phase === 'formatting') {
    const original = aiPromptBuilder.buildPrompt.bind(aiPromptBuilder);
    jest.spyOn(aiPromptBuilder, 'buildPrompt').mockImplementation(async (...args) => { const text = await original(...args); value.libraries[0].is_active = false; return text; });
  }
  const result = await executeRag(value, { afterStage: stage => { if (phase === 'handoff') stage.policyGate = { ...stage.policyGate }; } });
  expect(requests).toHaveLength(1); expect(result.aiCallsUsed).toBe(2);
  expect(prompt()).not.toMatch(/POLICY ENGINE SIGNALS|LIBRARY PROFILE/u); expect(prompt()).toContain('CANDIDATE-BOUND VERIFICATION MODE');
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

test('whole production RAG owner carries its private stage through fresh expansion to actual HTTP', async () => {
  const value = await ragRecheckAdviceFixture(); choose('ollama');
  const metadata = { ...value.item, genres: ['Animation'], keywords: ['Owned retrieval evidence'] };
  const config = { ...value.ctx.config, rag_retrieval_loop_enabled: true, rag_loop_rollout_mode: 'apply',
    rag_loop_trace_enabled: false, rag_loop_auto_fallback_enabled: false, rag_loop_auto_recover_enabled: false,
    rag_loop_conflict_detection_enabled: false, rag_loop_resilience_enabled: false,
    policy_recheck_below_prompt_threshold_enabled: true, policy_recheck_metadata_enrichment_enabled: false,
    policy_recheck_metadata_timeout_ms: 2000, policy_recheck_identifier_caps: { keywords: 8, genres: 5, studios: 3, cast: 3 },
    rag_conflict_top_n: 5, rag_loop_candidate_limit: 25, rag_retry_strategy: 'hybrid' };
  jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);
  jest.spyOn(ragRetriever, 'semanticSearchCandidates').mockImplementation(async (_item, _limit, options) =>
    [{ libraryId: options.pass === 'pass1' ? 2001 : 101, similarity: options.pass === 'pass1' ? 0.6 : 0.95 }]);
  jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([{ libraryId: 101, similarity: 0.95 }]);
  jest.spyOn(ragRetriever, 'hybridSearch').mockResolvedValue([{ libraryId: 101, similarity: 0.95 }]);
  jest.spyOn(ragRetriever, 'getSuggestedLibrary').mockReturnValue({ libraryId: 101, avgSimilarity: 0.95 });
  const evaluate = jest.spyOn(policyEngine, 'evaluateItem').mockImplementation(async expanded => {
    expect(expanded).not.toBe(metadata);
    return (await policyRecoveryReferenceFixture({ item: expanded })).result;
  });
  const result = await classificationRagLoopService.evaluateRagLoopSecondPass({ metadata, libraries: value.libraries,
    baselineResult: value.ctx.baselineResult, policyResult: value.ctx.policyResult, signalContext: value.ctx.signalContext, ragContext: null });
  expect(evaluate).toHaveBeenCalledTimes(1); expect(requests).toHaveLength(1);
  expect(prompt()).toContain('Suggested Library: Owned destination 0'); expect(prompt()).toContain('Owned profile observation');
  expect(prompt()).not.toContain('EARLIER PASS SENTINEL'); expect(result.library.id).toBe(101);
  expect(result.signalContext).toBe(value.ctx.signalContext); expect(result.candidate_bound_verification.status_id).toBe('confirmed');
});
