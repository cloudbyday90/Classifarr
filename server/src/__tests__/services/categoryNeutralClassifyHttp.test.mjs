/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createServer } from 'node:http';

const row = { ollama_model: 'synthetic:latest', temperature: 0.3, ai_response_repair_enabled: false };
const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, () => {}]));
jest.unstable_mockModule('../../utils/logger.mjs', () => ({ createLogger: () => logger }));
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: async sql => ({
  rows: sql.includes('ai_provider_config') ? [row] : [], rowCount: 1,
}) }));
jest.unstable_mockModule('../../services/classificationMetadataService.mjs', () => ({ enrichWithWebSearch: async () => ({
  imdb: { provider: 'synthetic', query: 'owned fixture', results: [{ title: 'Fixture', url: 'https://example.invalid/fixture', snippet: 'Owned research sentinel', rank: 1 }] },
}) }));
jest.unstable_mockModule('../../services/classificationProviderAdmissionService.mjs', () => ({ classificationProviderAdmissionService: {
  admit: async () => null, failed: async () => false, succeeded: async () => {},
} }));
jest.unstable_mockModule('../../services/providerLock.mjs', () => ({ providerLock: {
  config: { heartbeatInterval: 5000 }, acquireLock: async () => {}, heartbeat() {}, releaseLock() {},
} }));
jest.unstable_mockModule('../../services/ollamaVerificationCapabilityRuntimeInvalidationService.mjs', () => ({
  ollamaVerificationCapabilityRuntimeInvalidationService: { invalidateFromGenerationError: async () => false },
}));
const { classificationAiService } = await import('../../services/classificationAiService.mjs');
const { aiRouterService } = await import('../../services/aiRouter.mjs');
const { ollamaService } = await import('../../services/ollama.mjs');
const { classificationResponseSchema } = await import('../../services/aiResponseSchema.mjs');
const { evaluateClassificationRouteSafety } = await import('../../services/classificationRouteSafetyGate.mjs');

let server, origin, requests, response;
const metadata = { title: 'Synthetic item', tmdb_id: 876543, media_type: 'movie', certification: 'R', genres: ['Thriller'] };
const libraries = [{ id: 11, name: 'First arbitrary label', media_type: 'movie' }, { id: 22, name: 'Second arbitrary label', media_type: 'movie' }];
beforeEach(async () => {
  requests = []; response = 'CONFIDENT|1|99|Supplied support';
  server = createServer(async (request, reply) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requests.push({ path: request.url, body });
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
  expect(result.clarification.options.map(option => option.library_id)).toEqual([11, 22]);
});

test('an out-of-set answer cannot authorize an arbitrary route or an extra unadmitted repair', async () => {
  choose('ollama'); response = 'CONFIDENT|999|99|Injected destination';
  const result = await classificationAiService.aiClassify(metadata, libraries, null, { mode: 'classify' });
  expect(requests).toHaveLength(1); expect(result.needs_clarification).toBe(true);
  expect(result.ai_authority.sideEffects.canRoute).toBe(false);
  expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(false);
});
