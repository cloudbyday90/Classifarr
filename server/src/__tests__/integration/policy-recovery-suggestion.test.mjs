/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, afterEach, beforeAll, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';

let database;
const query = (...args) => database.query(...args), withTransaction = (...args) => database.withTransaction(...args);
jest.unstable_mockModule('../../config/database.mjs', () => ({ query, withTransaction, default: { query, withTransaction } }));
jest.unstable_mockModule('../../services/classification.mjs', () => ({ classificationService: {} }));
jest.unstable_mockModule('../../services/embeddingService.mjs', () => ({ embeddingService: { generateAndStore: jest.fn() } }));
const { policyEngine } = await import('../../services/policyEngine.mjs');
const { getActivePolicies } = await import('../../services/policyEngineQueries.mjs');
const { applyPolicyInitialIntentEstablishment } = await import('../../services/policyInitialIntentEstablishmentService.mjs');
const { buildSignalContext } = await import('../../services/policyScoringContextBuilder.mjs');
const { holdPolicyRecoverySuggestion, readPolicyRecoverySuggestion } = await import('../../services/policyRecoverySuggestionReader.mjs');
const { holdPolicyVerificationAdvice, createPolicyVerificationAdviceSession } = await import('../../services/policyVerificationAdvice.mjs');
const { libraryProfileService } = await import('../../services/libraryProfileService.mjs');
const { ClassificationPolicyPathService } = await import('../../services/classificationPolicyPathService.mjs');
const { ClassificationPersistenceService } = await import('../../services/classificationPersistenceService.mjs');
const { ensureDecisionQuestion } = await import('../../services/classificationRoutingServiceShared.mjs');
const { resolvePolicyQuestion } = await import('../../services/clarificationPolicyResolution.mjs');
const { buildPolicyRuntimeQuestionAnswerContract, parsePolicyRuntimeQuestionAnswer } = await import('../../services/policyRuntimeQuestionAnswerContract.mjs');
const context = { extractQuestionContext: () => ({}), getPolicyQuestionContextVersion: async () => 1,
  stampPolicyQuestionContext: value => value, isPolicyQuestionStale: () => false };
const persistence = new ClassificationPersistenceService({ policyQuestionContext: context });
const fixtures = [], history = [];
const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, () => {}]));

beforeAll(async () => {
  database = createReadinessDatabase();
  await query("INSERT INTO users(id,username,password_hash,role) VALUES(1,'recovery-fixture-admin','synthetic-only','admin') ON CONFLICT(id) DO NOTHING");
});
afterEach(async () => {
  jest.restoreAllMocks();
  for (const id of history) await query('DELETE FROM classification_history WHERE id=$1', [id]);
  for (const fixture of fixtures.reverse()) await fixture.cleanup();
  history.length = 0; fixtures.length = 0;
});
afterAll(async () => { await database.pool.end(); });

async function fixture(source = 'native_intent') {
  const created = await createPolicyEngineIntegrationFixture(database, { libraryName: `Recovery ${randomUUID()}`,
    presetSignals: { keywords: { require_any: ['Owned-anchor'], semantics: 'identity' } },
    policyValues: { trust_patterns: false, trust_rag: false, trust_history: false, profile_weight: 0.25 } });
  fixtures.push(created);
  if (source === 'native_intent') {
    await query('DELETE FROM policy_presets WHERE policy_id=$1', [created.policyId]);
    const established = await applyPolicyInitialIntentEstablishment({ dbClient: database, policyId: created.policyId, actorId: 1,
      request: { schema_version: 1, idempotency_key: randomUUID(), declared_intent: { purpose: [{
        signal_type: 'keywords', operator: 'require_any', values: { require_any: ['Owned-anchor'] }, semantics: 'identity',
      }] } } });
    expect(established.establishment.applied).toBe(true);
  }
  jest.spyOn(policyEngine, 'checkAuthoritativeSignals').mockResolvedValue(null);
  jest.spyOn(policyEngine, 'getActivePolicies').mockImplementation(async () =>
    (await getActivePolicies({ dbClient: database, throwOnError: true })).filter(policy => policy.id === created.policyId));
  jest.spyOn(policyEngine, 'scoreProfileWithDiagnostics').mockResolvedValue({ score: 70, diagnostics: null });
  const libraries = (await query('SELECT * FROM libraries WHERE id=$1', [created.libraryId])).rows;
  const item = { tmdb_id: 884414, media_type: 'movie', title: 'Owned database item', keywords: ['Owned-anchor'] };
  return { created, libraries, item };
}

test.each(['native_intent', 'compatibility_bridge'])('production %s load/evaluation has private provenance, not a fresh-configuration lease', async source => {
  const { created, libraries, item } = await fixture(source), result = await policyEngine.evaluateItem(item);
  expect(result.policyIntentReadTrace).toMatchObject({ source, intent_version: source === 'native_intent' ? 1 : null });
  const args = { policyResult: result, metadata: item, libraries, signalContext: buildSignalContext(result, libraries, result.ranked) };
  const token = holdPolicyRecoverySuggestion(args);
  expect(readPolicyRecoverySuggestion(token, args)).toBe(libraries[0]);
  await query('UPDATE library_policies SET enabled=false WHERE id=$1', [created.policyId]);
  expect(readPolicyRecoverySuggestion(token, args)).toBe(libraries[0]); // Only the retained loaded snapshot was assessed.
  expect((await policyEngine.getActivePolicies())).toEqual([]);
  libraries[0].is_active = false;
  expect(readPolicyRecoverySuggestion(token, args)).toBeNull();
});

test.each(['genuine', 'copied'])('%s policy recovery persists pending state and resolves only through the existing explicit receipt', async state => {
  const { libraries, item } = await fixture();
  const engine = state === 'copied' ? { evaluateItem: async (...args) => ({ ...await policyEngine.evaluateItem(...args) }) } : policyEngine;
  const generate = jest.fn(async () => { throw new Error('Owned non-transient provider refusal'); });
  const owner = new ClassificationPolicyPathService({ logger, policyEngine: engine,
    classificationAiService: { aiClassify: generate }, classificationRoutingService: { ensureDecisionQuestion } });
  const { result } = await owner.execute({ metadata: item, libraries, relatedEvidence: [] });
  expect(generate).toHaveBeenCalledTimes(1);
  expect(result.method).toBe(state === 'genuine' ? 'signal_calculation' : 'fallback');
  expect(result.library).toBe(state === 'genuine' ? libraries[0] : null);
  expect(result.route_safety.automatic_route_allowed).toBe(false);
  const id = await persistence.logClassification(item, result); history.push(id);
  const row = (await query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
  expect(row.status).toBe('awaiting_decision');
  // Pending review preserves advice in metadata, not as a completed destination.
  expect(row.library_id).toBeNull();
  expect(JSON.stringify(row.metadata)).not.toMatch(/recoveryReference|policy_recovery_reference/u);
  const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: row, question: row.policy_question });
  const parsed = parsePolicyRuntimeQuestionAnswer({ contract_version: contract.version, contract_fingerprint: contract.fingerprint,
    action_id: 'confirm_destination', destination_library_id: libraries[0].id });
  expect(parsed.ok).toBe(true);
  const resolve = policyContext => resolvePolicyQuestion(id, libraries[0].id, null, 'owned-operator', false,
    { policyQuestionContext: policyContext, answerContract: parsed.answer });
  await expect(resolve({ ...context, isPolicyQuestionStale: () => true })).rejects.toMatchObject({ statusCode: 409 });
  await query('UPDATE libraries SET is_active=false WHERE id=$1', [libraries[0].id]);
  await expect(resolve(context)).rejects.toMatchObject({ statusCode: 400 });
  await query('UPDATE libraries SET is_active=true WHERE id=$1', [libraries[0].id]);
  expect(await resolve(context)).toMatchObject({ success: true, shouldRoute: true, libraryId: libraries[0].id });
  expect(await resolve(context)).toMatchObject({ idempotent: true, alreadyResolved: true, shouldRoute: false });
});

test.each(['native_intent', 'compatibility_bridge'])('real %s selection binds one later PostgreSQL profile observation without new freshness reads', async source => {
  const { created, libraries, item } = await fixture(source);
  await query(`INSERT INTO media_server_items(library_id,external_id,title,media_type,genres,content_rating,studio)
    VALUES($1,'owned-observation','PRIVATE ITEM TITLE','movie',ARRAY['Owned database genre'],'PG','Owned database studio')`, [created.libraryId]);
  const result = await policyEngine.evaluateItem(item);
  const args = { policyResult: result, metadata: item, libraries, signalContext: buildSignalContext(result, libraries, result.ranked) };
  const session = createPolicyVerificationAdviceSession(holdPolicyVerificationAdvice(args), args);
  const original = database.query.bind(database), reads = [];
  jest.spyOn(database, 'query').mockImplementation((sql, params, ...rest) => { reads.push({ sql, params }); return original(sql, params, ...rest); });
  await session.readProfile(id => libraryProfileService.getProfileStats(id));
  const projected = await session.buildPrompt({}, async context => context);
  expect(reads).toHaveLength(1); expect(reads[0].params).toEqual([created.libraryId]);
  expect(projected.libraryProfile).toMatchObject({ totalItems: 1, genreDistribution: [{ genre: 'Owned database genre', percentage: 100 }],
    observation: { itemCount: 1, traits: { genres: { observedCount: 1, unknownCount: 0 } } } });
  expect(projected.policySignals.confidence).toBe(result.confidence);
  expect(JSON.stringify(projected)).not.toContain('PRIVATE ITEM TITLE');
  const missing = createPolicyVerificationAdviceSession(null, args);
  await missing.readProfile(id => libraryProfileService.getProfileStats(id));
  expect(reads).toHaveLength(1); expect(await missing.buildPrompt({}, async context => context)).toEqual({ policySignals: {}, libraryProfile: null });
});

test('a loaded destination changed while the real profile query settles cannot attach its observation', async () => {
  const { libraries, item } = await fixture(), result = await policyEngine.evaluateItem(item);
  const args = { policyResult: result, metadata: item, libraries, signalContext: buildSignalContext(result, libraries, result.ranked) };
  const session = createPolicyVerificationAdviceSession(holdPolicyVerificationAdvice(args), args);
  const lookup = jest.fn(async id => { const stats = await libraryProfileService.getProfileStats(id); libraries[0].is_active = false; return stats; });
  await session.readProfile(lookup);
  expect(lookup).toHaveBeenCalledTimes(1); expect(lookup).toHaveBeenCalledWith(libraries[0].id);
  expect(await session.buildPrompt({}, async context => context)).toEqual({ policySignals: {}, libraryProfile: null });
});
