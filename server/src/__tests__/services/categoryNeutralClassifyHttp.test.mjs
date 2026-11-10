/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createServer } from 'node:http';

const row = { ollama_model: 'synthetic:latest', temperature: 0.3, ai_response_repair_enabled: false };
const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, () => {}]));
jest.unstable_mockModule('../../utils/logger.mjs', () => ({ createLogger: () => logger }));
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: async sql => ({
  rows: sql.includes('ai_provider_config') ? [row] : [], rowCount: 1,
}) }));
const metadataShared = await import('../../services/classificationMetadataServiceShared.mjs');
const metadataService = {
  detectEventTypesFromMetadata: metadataShared.detectEventTypesFromMetadata,
  mergeMetadataForRecheck: metadataShared.mergeMetadataForRecheck,
  mightBeAnime: metadataShared.mightBeAnime,
  parseOverseerrPayload: metadataShared.parseOverseerrPayload,
  enrichWithTMDB: () => { throw new Error('Unexpected TMDB access in owned HTTP fixture'); },
  getTavilyConfig: () => { throw new Error('Unexpected research configuration access in owned HTTP fixture'); },
  enrichWithWebSearch: async () => ({ imdb: { provider: 'synthetic', query: 'owned fixture',
    results: [{ title: 'Fixture', url: 'https://example.invalid/fixture', snippet: 'Owned research sentinel', rank: 1 }] } }),
};
jest.unstable_mockModule('../../services/classificationMetadataService.mjs', () => ({ ...metadataService, classificationMetadataService: metadataService }));
jest.unstable_mockModule('../../services/classificationProviderAdmissionService.mjs', () => ({ classificationProviderAdmissionService: {
  admit: async () => null, failed: async () => false, succeeded: async () => {},
} }));
jest.unstable_mockModule('../../services/providerLock.mjs', () => ({ providerLock: {
  config: { heartbeatInterval: 5000 }, acquireLock: async () => {}, heartbeat() {}, releaseLock() {},
} }));
jest.unstable_mockModule('../../services/ollamaVerificationCapabilityRuntimeInvalidationService.mjs', () => ({
  ollamaVerificationCapabilityRuntimeInvalidationService: { invalidateFromGenerationError: async () => false },
}));
jest.unstable_mockModule('../../services/classificationRagLoopService.mjs', () => ({ classificationRagLoopService: {
  evaluateRagLoopSecondPass: () => { throw new Error('Unexpected post-provider work in refusal fixture'); },
} }));
const { classificationAiService } = await import('../../services/classificationAiService.mjs');
const { aiRouterService } = await import('../../services/aiRouter.mjs');
const { ollamaService } = await import('../../services/ollama.mjs');
const { classificationResponseSchema } = await import('../../services/aiResponseSchema.mjs');
const { evaluateClassificationRouteSafety } = await import('../../services/classificationRouteSafetyGate.mjs');
const { ClassificationLegacySignalPathService } = await import('../../services/classificationLegacySignalPathService.mjs');
const { ClassificationPolicyPathService } = await import('../../services/classificationPolicyPathService.mjs');
const { policyEngine } = await import('../../services/policyEngine.mjs');
const { recoveryPolicies } = await import('../fixtures/policyRecoveryReferenceFixture.mjs');
const { ensureDecisionQuestion } = await import('../../services/classificationRoutingServiceShared.mjs');

let server, origin, requests, response, responseStatus, beforeResponse;
const metadata = { title: 'Synthetic item', tmdb_id: 876543, media_type: 'movie', certification: 'R', genres: ['Thriller'] };
const libraries = [{ id: 11, name: 'First arbitrary label', media_type: 'movie' }, { id: 22, name: 'Second arbitrary label', media_type: 'movie' }];
beforeEach(async () => {
  requests = []; response = 'CONFIDENT|1|99|Supplied support'; responseStatus = 200;
  beforeResponse = () => {};
  server = createServer(async (request, reply) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requests.push({ path: request.url, body });
    beforeResponse();
    if (responseStatus !== 200) {
      reply.writeHead(responseStatus, { 'Content-Type': 'application/json' });
      reply.end(JSON.stringify({ error: 'Owned authorization refusal' })); return;
    }
    reply.setHeader('Content-Type', request.url === '/api/generate' ? 'application/x-ndjson' : 'application/json');
    reply.end(request.url === '/api/generate'
      ? JSON.stringify({ model: 'synthetic:latest', done: true, response }) + '\n'
      : JSON.stringify({ choices: [{ message: { content: response } }], usage: {} }));
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  jest.spyOn(ollamaService, 'getConfig').mockResolvedValue({ baseUrl: origin, model: 'synthetic:latest' });
  jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });
});
afterEach(async () => {
  jest.restoreAllMocks(); server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); });
});
function choose(type) {
  jest.spyOn(aiRouterService, 'getProvider').mockResolvedValue({ type,
    config: { primary_provider: 'custom', api_endpoint: origin, host: origin, model: 'synthetic:latest', temperature: 0.3 } });
}
function sent(type) {
  const body = requests.at(-1).body;
  return type === 'ollama' ? body.prompt : body.messages.find(message => message.role === 'user').content;
}

test.each(['ollama', 'custom'])('actual %s classify request has one category-neutral suffix after unchanged research', async type => {
  choose(type); await classificationAiService.aiClassify(metadata, libraries, null, { mode: 'classify' });
  expect(requests).toHaveLength(1);
  const prompt = sent(type), suffix = prompt.slice(prompt.indexOf('IMPORTANT FOR CLARIFICATION:'));
  expect(prompt.match(/IMPORTANT FOR CLARIFICATION:/gu)).toHaveLength(1);
  expect(prompt).toContain('Owned research sentinel');
  expect(prompt.indexOf('Owned research sentinel')).toBeLessThan(prompt.indexOf(suffix));
  expect(suffix).not.toContain('"Family"');
  expect(suffix).not.toContain('NOT a library indicator');
  expect(suffix).toContain('do not invent rating requirements or exclusions');
  expect(suffix).toContain('observations rather than declared policy');
  expect(suffix).toContain('In classify mode, NEVER use CONFIRM format');
  expect(suffix).toContain('Always provide 2-3 clear options');
  expect(prompt).not.toContain('DECLARED POSITIVE PURPOSE EVIDENCE');
  if (type === 'ollama') expect(requests[0].body.format).toEqual(classificationResponseSchema);
});

test.each(['ollama', 'custom'])('real %s high-confidence output is still a proposal without route or learning permission', async type => {
  choose(type);
  const result = await classificationAiService.aiClassify(metadata, libraries, null, { mode: 'classify' });
  expect(requests).toHaveLength(1); expect(result.library.id).toBe(11); expect(result.confidence).toBe(95);
  expect(result.ai_authority.sideEffects).toMatchObject({ canRoute: false, canLearn: false, canMutatePolicy: false });
  expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(false);
});

test('renamed/reordered labels retain static guidance and actual numeric index membership', async () => {
  choose('ollama');
  await classificationAiService.aiClassify(metadata, libraries, null, { mode: 'classify' });
  const first = sent('ollama').split('IMPORTANT FOR CLARIFICATION:')[1];
  const renamed = [{ ...libraries[1], name: 'Family' }, { ...libraries[0], name: 'Custom purpose' }];
  const result = await classificationAiService.aiClassify(metadata, renamed, null, { mode: 'classify' });
  expect(sent('ollama').split('IMPORTANT FOR CLARIFICATION:')[1]).toBe(first);
  expect(result.library.id).toBe(22); expect(requests).toHaveLength(2);
});

test.each(['ollama', 'custom'])('real %s CLARIFY output preserves two valid supplied choices', async type => {
  choose(type); response = 'CLARIFY|Conflicting support|Two supplied signals disagree|Choose a destination|1|2';
  const result = await classificationAiService.aiClassify(metadata, libraries, null, { mode: 'classify' });
  expect(requests).toHaveLength(1); expect(result.needs_clarification).toBe(true);
  expect(result.library).toBeNull();
  expect(result.clarification.options.map(option => option.library_id)).toEqual([11, 22]);
});

test('an out-of-set answer cannot authorize an arbitrary route or an extra unadmitted repair', async () => {
  choose('ollama'); response = 'CONFIDENT|999|99|Injected destination';
  const result = await classificationAiService.aiClassify(metadata, libraries, null, { mode: 'classify' });
  expect(requests).toHaveLength(1); expect(result.needs_clarification).toBe(true);
  expect(result.library).toBeNull();
  expect(result.ai_authority.sideEffects.canRoute).toBe(false);
  expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(false);
});

test.each(['ollama', 'custom'])('real %s unresolved responses cannot promote even a known high-confidence hint', async type => {
  choose(type);
  const context = { confidence: 91, suggestedLibrary: libraries[1], breakdown: [] };
  for (const output of [
    'The library is Second arbitrary label.',
    'CONFIDENT|999|99|Unknown destination',
    JSON.stringify({ decision: 'CLARIFY', problem_summary: 'Conflicting support', why_uncertain: 'Insufficient evidence',
      question: 'Choose a destination', options: [1, 2] }),
  ]) {
    response = output;
    const before = requests.length;
    const result = await classificationAiService.aiClassify(metadata, libraries, context, { mode: 'classify' });
    expect(requests).toHaveLength(before + 1);
    expect(result.library).toBeNull();
    expect(result.needs_clarification).toBe(true);
    expect(result.format).toBe(output.startsWith('{') ? 'clarify' : 'contract_violation');
    expect(result.ai_advisory).toBeUndefined();
    expect(result.ai_authority.sideEffects).toMatchObject({ canRoute: false, canLearn: false });
    expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(false);
    expect((result.policy_question || result.clarification).options.map(option => option.library_id)).toEqual([11, 22]);
  }
});

test.each(['ollama', 'custom'])('real %s refusal through the production legacy owner preserves recovery boundaries', async type => {
  choose(type); responseStatus = 401;
  class EmptyCollector {
    async collectAll() {}
    getSignals() { return []; }
    getPatternSignals() { return []; }
  }
  const owner = new ClassificationLegacySignalPathService({ logger, SignalCollectorClass: EmptyCollector,
    ragRetriever: { semanticSearch: async () => [] },
    confidenceCalculator: { loadWeights: async () => {}, calculate: () => ({ confidence: 65, suggestedLibrary: null }), toAIContext: () => ({}) },
    classificationEvidenceService: { buildRelatedEvidenceSummary: () => null },
    classificationAiService, classificationRoutingService: { ensureDecisionQuestion },
  });
  const result = await owner.execute({ metadata, libraries, relatedEvidence: [] });
  expect(requests).toHaveLength(1);
  expect(result).toMatchObject({ library: null, confidence: 50, method: 'fallback', needs_clarification: true,
    provider_recovery: { version: 'provider_recovery.v1', mode: 'review_required' },
    route_safety: { automatic_route_allowed: false, primary_gate: { id: 'provider_recovery_review_required' } } });
  expect(result.reason).toBe('AI unavailable - choose a destination for this item');
  expect(result.policy_question.options.map(option => option.library_id)).toEqual([11, 22]);
  expect(result.needs_retry).toBeUndefined();
});

for (const state of ['genuine', 'copied', 'inactive']) {
  test.each(['ollama', 'custom'])(`real %s refusal through the policy owner rechecks ${state} advice without another request`, async type => {
    choose(type); responseStatus = 401;
    const policies = recoveryPolicies(2);
    // Distinct supported terms preserve the existing specialization/adjudication gate.
    policies.forEach((policy, index) => { Object.assign(policy.policy_intent_contract.purpose[0], {
      signal_type: 'keywords', values: { require_any: [`Owned-anchor-${index}`] },
    }); });
    jest.spyOn(policyEngine, 'checkAuthoritativeSignals').mockResolvedValue(null);
    jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue(policies);
    jest.spyOn(policyEngine, 'scoreProfileWithDiagnostics').mockResolvedValue({ score: 70, diagnostics: null });
    const pool = policies.map(policy => ({ id: policy.library_id, name: 'Any category', media_type: 'movie', is_active: true }));
    if (state === 'inactive') beforeResponse = () => { pool[0].is_active = false; };
    const engine = state === 'copied' ? { evaluateItem: async (...args) => ({ ...await policyEngine.evaluateItem(...args) }) } : policyEngine;
    const owner = new ClassificationPolicyPathService({ logger, policyEngine: engine, classificationAiService,
      classificationRoutingService: { ensureDecisionQuestion } });
    const out = await owner.execute({ metadata: { ...metadata, keywords: ['Owned-anchor-0', 'Owned-anchor-1'] }, libraries: pool, relatedEvidence: [] });
    expect(out.result.policyResult).toMatchObject({ action: 'prompt_select' });
    expect(requests).toHaveLength(1);
    expect(out.handled).toBe(true);
    expect(out.result).toMatchObject({ method: state === 'genuine' ? 'signal_calculation' : 'fallback',
      provider_recovery: { version: 'provider_recovery.v1', mode: 'review_required' },
      route_safety: { automatic_route_allowed: false, primary_gate: { id: 'provider_recovery_review_required' } } });
    if (state === 'genuine') expect(out.result.library).toBe(pool[0]);
    else { expect(out.result.library).toBeNull(); expect(out.result.confidence).toBe(50); }
    expect(out.result.needs_retry).toBeUndefined();
    expect(sent(type)).not.toMatch(/recoveryReference|policy_recovery_reference/u);
  });
}
