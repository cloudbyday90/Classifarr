/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { default: db } = await import('../../config/database.mjs');
const { applyPolicyInitialIntentEstablishment } = await import('../../services/policyInitialIntentEstablishmentService.mjs');
const { getActivePolicies } = await import('../../services/policyEngineQueries.mjs');
const { evaluateItem, evaluatePolicy } = await import('../../services/policyEngineEvaluation.mjs');
const { createLivePolicyCandidatePurposeCapture, holdLivePolicyCandidatePurpose } = await import('../../services/policyCandidatePurposeLiveCapture.mjs');
const { buildPolicyCandidateAdjudicationContract } = await import('../../services/policyCandidateAdjudicationContract.mjs');
const { buildPolicyCandidatePurposePrompt } = await import('../../services/policyCandidatePurposeProvider.mjs');
const { buildClassificationBasePrompt } = await import('../../services/classificationBasePrompt.mjs');
const { aiPromptBuilder } = await import('../../services/aiPromptBuilder.mjs');
const { gatewayConfig } = await import('../../ollamaGateway/contract.mjs');
const { openGatewayLedger } = await import('../../ollamaGateway/ledger.mjs');
const { createGatewayServer } = await import('../../ollamaGateway/server.mjs');
const { createOllamaApplicationRouting } = await import('../../services/ollamaApplicationRouting.mjs');
const { holdOllamaGenerationConfiguration } = await import('../../services/ollamaGenerationConfigurationSnapshot.mjs');
const { ollamaService } = await import('../../services/ollama.mjs');
const { aiResponseParser } = await import('../../services/aiResponseParser.mjs');

const fixtures = [], sentinel = 'Configured purpose private sentinel';
describe('live purpose PostgreSQL and gateway evidence', () => {
beforeAll(async () => {
  await db.query("INSERT INTO users(id,username,password_hash,role) VALUES(1,'purpose-fixture-admin','synthetic-only','admin') ON CONFLICT(id) DO NOTHING");
});
afterAll(async () => { for (const value of fixtures.reverse()) await value.cleanup(); });

async function loadedFixture(semantics = 'identity') {
  const created = [];
  for (let index = 0; index < 2; index++) {
    const value = await createPolicyEngineIntegrationFixture(db, { libraryName: `Purpose ${randomUUID()}`, policyName: `Purpose ${randomUUID()}`,
      policyValues: { trust_patterns: false, trust_rag: false, trust_history: false } });
    fixtures.push(value); created.push(value);
    await db.query('DELETE FROM policy_presets WHERE policy_id=$1', [value.policyId]);
    const result = await applyPolicyInitialIntentEstablishment({ dbClient: db, policyId: value.policyId, actorId: 1,
      request: { schema_version: 1, idempotency_key: randomUUID(), declared_intent: { purpose: [{
        signal_type: 'genres', operator: 'include', values: { include: ['Animation', sentinel] }, semantics,
      }] } } });
    expect(result.establishment.applied).toBe(true);
  }
  const ids = created.map(value => value.policyId);
  const policies = (await getActivePolicies({ dbClient: db, throwOnError: true })).filter(policy => ids.includes(policy.id));
  const libraries = (await db.query('SELECT * FROM libraries WHERE id=ANY($1::int[]) ORDER BY id', [created.map(value => value.libraryId)])).rows;
  return { policies, libraries, item: { media_type: 'movie', tmdb_id: 987654, title: 'Synthetic fixture', genres: ['Animation'] } };
}

async function evaluate(value, live = true) {
  const result = await evaluateItem(value.item, {}, {
    checkAuthoritativeSignals: async () => null, getActivePolicies: async () => value.policies,
    evaluatePolicy: (...args) => evaluatePolicy(...args, { scoreProfileWithDiagnostics: async () => ({ score: 0, diagnostics: null }) }),
    applyInventoryEvidence: async ({ evaluations }) => evaluations, rankResults: async rows => rows,
    determineAction: ranked => ({ action: 'prompt_select', confidence: ranked[0].score, ranked }),
    ...(live ? { captureCandidatePurpose: createLivePolicyCandidatePurposeCapture(value.item) } : {}),
  });
  const contract = buildPolicyCandidateAdjudicationContract({ policyResult: result, libraries: value.libraries, mediaType: value.item.media_type });
  expect(contract.valid).toBe(true);
  const token = holdLivePolicyCandidatePurpose({ policyResult: result, contract, metadata: value.item });
  const libraries = contract.candidates.map(row => row.library);
  const section = buildPolicyCandidatePurposePrompt(token, { metadata: value.item, libraries, providerType: 'ollama', providerHost: '127.0.0.1', transportHost: '127.0.0.1' });
  return { result, contract, token, libraries, section };
}

test.each(['identity', 'compatibility'])('real canonical %s declaration loads and binds without altering numeric evaluation', async semantics => {
  const value = await loadedFixture(semantics), captured = await evaluate(value), offline = await evaluate(value, false);
  expect(value.policies.every(policy => policy.native_intent_version === 1)).toBe(true);
  expect(captured.section).toContain(`"semantics":"${semantics}"`);
  expect(captured.section).toContain(sentinel);
  expect(captured.section).toContain('"declaredMatch":"matched"');
  expect(JSON.stringify(captured.result)).not.toContain(sentinel);
  expect(captured.result.ranked).toEqual(offline.result.ranked);
  expect(offline.section).toBeNull();
});

test('later database changes cannot replace the retained declaration or upgrade a copied result', async () => {
  const value = await loadedFixture(), captured = await evaluate(value);
  await db.query(`UPDATE policy_intent_rules SET values='{"include":["Later declaration"]}'::jsonb
    WHERE intent_id IN (SELECT id FROM policy_intents WHERE policy_id=ANY($1::int[]) AND active=true) AND intent_role='purpose'`,
  [value.policies.map(policy => policy.id)]);
  const section = buildPolicyCandidatePurposePrompt(captured.token, { metadata: value.item, libraries: captured.libraries,
    providerType: 'ollama', providerHost: '127.0.0.1', transportHost: '127.0.0.1' });
  expect(section).toContain(sentinel); expect(section).not.toContain('Later declaration');
  expect(holdLivePolicyCandidatePurpose({ policyResult: structuredClone(captured.result), contract: captured.contract, metadata: value.item })).toBeNull();
});

test('real protected gateway sends the frozen local prompt and retains only existing opaque work evidence', async () => {
  const value = await loadedFixture('compatibility'), captured = await evaluate(value);
  await getPool().query(await readFile(new URL('../../../../database/ollama-gateway/current.sql', import.meta.url), 'utf8'));
  const requests = [], model = 'synthetic:latest';
  const provider = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/tags') { response.end(JSON.stringify({ models: [{ name: model, digest: 'a'.repeat(64) }] })); return; }
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    response.setHeader('Content-Type', 'application/x-ndjson');
    response.end(`${JSON.stringify({ model, done: true, response: JSON.stringify({ decision: 'PROPOSE', library_number: 1 }) })}\n`);
  });
  let routing, gateway, session;
  try {
    await new Promise(resolve => { provider.listen(0, '127.0.0.1', resolve); });
    const port = provider.address().port, upstream = `http://127.0.0.1:${port}`, token = randomBytes(32).toString('base64url');
    const backgroundToken = randomBytes(32).toString('base64url');
    const config = gatewayConfig({ upstream, models: [model], workIdentityKey: randomBytes(32).toString('base64url'),
      credentials: [{ installation: 'purpose-fixture', workClass: 'foreground', token },
        { installation: 'purpose-fixture', workClass: 'background', token: backgroundToken }], timeoutMs: 2000, queueMs: 300 });
    session = await getPool().connect();
    const ledger = await openGatewayLedger(session, config.providerHash, config.providerInstance);
    gateway = createGatewayServer({ config, ledger });
    await new Promise(resolve => { gateway.server.listen(0, '127.0.0.1', resolve); });
    const configuration = { host: '127.0.0.1', port, baseUrl: upstream, model };
    const gatewayOptions = { url: `http://127.0.0.1:${gateway.server.address().port}`, upstream, models: [model] };
    routing = createOllamaApplicationRouting({ revision: 1, configuration,
      foreground: { ...gatewayOptions, token }, background: { ...gatewayOptions, token: backgroundToken } });
    const generationConfiguration = await holdOllamaGenerationConfiguration(async () => configuration);
    const prompt = await buildClassificationBasePrompt({ metadata: value.item, libraries: captured.libraries,
      candidatePurposePrompt: captured.section }, { mode: 'adjudicate', promptBuilder: aiPromptBuilder });
    const output = await routing.run(() => ollamaService.generateWithProgress(prompt, model, 0.3, null, null,
      { requireDoneSignal: true, hardTimeout: 5000, generationConfiguration }));
    const parsed = aiResponseParser.parse(output, { libraries: captured.libraries, metadata: value.item }, { mode: 'adjudicate' });
    expect(parsed.library.id).toBe(captured.libraries[0].id);
    expect(requests).toHaveLength(1); expect(requests[0].prompt).toContain(sentinel);
    expect((await ledger.status()).attempts).toBe('1');
    const bindings = (await getPool().query('SELECT * FROM ollama_gateway.request_binding')).rows;
    expect(bindings).toHaveLength(1); expect(bindings[0].work_fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    const completions = (await getPool().query('SELECT * FROM ollama_gateway.completion_receipt')).rows;
    expect(JSON.stringify({ bindings, completions, parsed })).not.toContain(sentinel);
    routing.close();
    expect(() => routing.run(() => ollamaService.generateWithProgress(prompt, model, 0.3, null, null,
      { generationConfiguration }))).toThrow('gateway_client_closed');
    expect(requests).toHaveLength(1); expect((await ledger.status()).attempts).toBe('1');
  } finally {
    routing?.close(); await gateway?.stop(); session?.release(true);
    provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); });
  }
});
});
