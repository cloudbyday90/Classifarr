/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, afterEach, beforeAll, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
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
const { runPolicyRecheckStage, runAiRerunStage } = await import('../../services/classificationRagLoopStages.mjs');
const { createRagRecheckAdviceSession } = await import('../../services/ragRecheckVerificationAdvice.mjs');
const { ragRecheckStageContext } = await import('../fixtures/ragRecheckAdviceFixture.mjs');
const { nonadoptedRagContext } = await import('../fixtures/nonadoptedRagVerificationFixture.mjs');
const { enterNonadoptedRagVerification } = await import('../../services/nonadoptedRagVerification.mjs');
const { enterAdoptedRagVerification } = await import('../../services/adoptedRagVerification.mjs');
const { loadCandidateBoundVerificationDailyOutcomeMetrics } = await import('../../services/classificationCandidateBoundVerificationMetricsRepository.mjs');
const { loadClassificationDecisionPathTelemetry } = await import('../../services/classificationDecisionPathTelemetryRepository.mjs');
const { publishCurrentPolicyReviewFrame, savedCurrentPolicyReviewMetadata } = await import('../../services/currentPolicyReviewFrameLive.mjs');
const { ragLoopResilienceManager } = await import('../../services/ragLoopResilienceManager.mjs');
const { ClassificationPolicyPathService } = await import('../../services/classificationPolicyPathService.mjs');
const { ClassificationPersistenceService } = await import('../../services/classificationPersistenceService.mjs');
const { ensureDecisionQuestion } = await import('../../services/classificationRoutingServiceShared.mjs');
const { policyQuestionBuilder } = await import('../../services/policyQuestionBuilder.mjs');
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

for (const source of ['native_intent', 'compatibility_bridge']) {
  test.each(['genuine', 'copied'])(`real ${source} %s RAG stage binds its profile and invocation-owned result`, async kind => {
    const { libraries, item, created } = await fixture(source), expanded = { ...item, overview: 'Expanded owned metadata' };
    await query(`INSERT INTO media_server_items(library_id,external_id,title,media_type,genres)
      VALUES($1,'rag-observation','PRIVATE RAG ITEM','movie',ARRAY['Owned RAG observation'])`, [created.libraryId]);
    if (kind === 'copied') {
      const evaluate = policyEngine.evaluateItem.bind(policyEngine);
      jest.spyOn(policyEngine, 'evaluateItem').mockImplementation(async (...args) => ({ ...await evaluate(...args) }));
    }
    jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
    const { ctx } = ragRecheckStageContext({ item: expanded, libraries });
    const stage = await runPolicyRecheckStage(ctx);
    expect(stage.policyAfter.action).toBe('prompt_confirm'); expect(stage.policyGate.shouldAdopt).toBe(true);
    const original = database.query.bind(database), reads = [];
    jest.spyOn(database, 'query').mockImplementation((sql, params, ...rest) => { reads.push({ sql, params }); return original(sql, params, ...rest); });
    const aiClassify = jest.fn(async (metadata, pool, signalContext, options) => {
      enterAdoptedRagVerification(options.adoptedRagVerification, { metadata, libraries: pool, signalContext }, options.verificationCandidate);
      expect(metadata).toBe(expanded); expect(signalContext.ranked).toBe(stage.policyAfter.ranked);
      const session = createRagRecheckAdviceSession(options.ragRecheckVerificationAdvice, { metadata, libraries: pool, signalContext });
      await session.readProfile(id => libraryProfileService.getProfileStats(id));
      const packet = await session.buildPrompt({}, async value => value);
      if (kind === 'genuine') {
        expect(packet.policySignals.confidence).toBe(stage.policyAfter.confidence);
        expect(packet.libraryProfile).toMatchObject({ totalItems: 1, genreDistribution: [{ genre: 'Owned RAG observation', percentage: 100 }] });
      } else expect(packet).toEqual({ policySignals: {}, libraryProfile: null });
      expect(JSON.stringify(packet)).not.toMatch(/PRIVATE RAG ITEM|EARLIER PASS SENTINEL/u);
      return { library: pool[0], confidence: stage.policyAfter.confidence, verified_by_ai: true };
    });
    const result = await runAiRerunStage({ ...ctx, policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate,
      policyRecheckStage: stage, aiClassify });
    expect(aiClassify).toHaveBeenCalledTimes(kind === 'genuine' ? 1 : 0); expect(result.aiCallsUsed).toBe(kind === 'genuine' ? 2 : 1);
    if (kind === 'genuine') {
      expect(result.pass2Candidate.signalContext).toBe(aiClassify.mock.calls[0][2]);
      expect(result.pass2Candidate.signalContext.breakdown).toBeUndefined();
      expect(result.pass2Candidate.ai_advisory).toBeNull();
    }
    expect(reads).toHaveLength(kind === 'genuine' ? 1 : 0);
    if (kind === 'genuine') expect(reads[0].params).toEqual([created.libraryId]);
    expect(JSON.stringify(result)).not.toContain('ragRecheckVerificationAdvice');
  });
}

async function currentReviewResult(item, libraries, { currentAdvisory = null, adopted = false, retained = null } = {}) {
  const earlier = { id: 2001, name: 'Earlier destination', media_type: 'movie', is_active: true };
  if (!libraries.some(row => row.id === earlier.id)) libraries.push(earlier);
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const ctx = adopted ? ragRecheckStageContext({ item, libraries }, { earlier }).ctx : nonadoptedRagContext({ item, libraries }, { earlier });
  Object.assign(ctx.signalContext, { relatedEvidenceSummary: { source: 'EARLIER SUMMARY SENTINEL' },
    signals: { earlier_signal: 99 }, ragContext: { similarItems: [{ similarity: 0.99, title: 'EARLIER RETRIEVAL SENTINEL' }] } });
  ctx.baselineResult.ai_advisory = { version: 'classification.ai_advisory.v1', status_id: 'earlier_advisory',
    mode: 'verification', source_format: 'earlier_pass', message: 'EARLIER ADVISORY SENTINEL',
    deterministic_candidate: { library_id: earlier.id, library_name: earlier.name }, proposed_destination: null };
  if (retained) {
    ctx.baselineResult.candidate_bound_verification = { version: 'classification.candidate_bound_verification.v1', status_id: 'abstained' };
    if (retained === 'cap') ctx.config.policy_recheck_max_ai_calls_per_item = 1;
  }
  const stage = await runPolicyRecheckStage(ctx);
  expect(stage.policyGate.shouldAdopt).toBe(adopted);
  const aiClassify = jest.fn(async (metadata, pool, signalContext, options) => {
      if (retained === 'rejected') throw new Error('Owned verification operation failure');
      if (!adopted) enterNonadoptedRagVerification(options.nonadoptedRagVerification, { metadata, libraries: pool, signalContext }, options.verificationCandidate).assertCurrent();
      else enterAdoptedRagVerification(options.adoptedRagVerification, { metadata, libraries: pool, signalContext }, options.verificationCandidate).assertCurrent();
      return { library: pool[0], confidence: signalContext.confidence, verified_by_ai: currentAdvisory === null,
        ...(currentAdvisory ? { ai_advisory: currentAdvisory } : {}) };
  });
  const rerun = await runAiRerunStage({ ...ctx, policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate, policyRecheckStage: stage, aiClassify });
  if (retained) {
    expect(aiClassify).toHaveBeenCalledTimes(retained === 'cap' ? 0 : 1);
    expect(rerun.pass2Candidate).toBe(stage.pass2Candidate);
    expect(rerun.pass2Candidate.candidate_bound_verification).toBeNull();
    expect(ctx.baselineResult.candidate_bound_verification.status_id).toBe('abstained');
  } else {
    expect(rerun.pass2Candidate.signalContext).toBe(aiClassify.mock.calls[0][2]);
    expect(rerun.pass2Candidate.ai_advisory).toBe(currentAdvisory);
  }
  const result = publishCurrentPolicyReviewFrame(rerun.pass2Candidate, { ...rerun.pass2Candidate });
  await ensureDecisionQuestion({ metadata: item, result, libraries, policyResult: stage.policyAfter });
  return result;
}

test.each(['cap', 'rejected'])('retained %s writes no inherited verification count and preserves historical statuses', async retained => {
  const { libraries, item } = await fixture();
  const oldResult = await currentReviewResult(item, libraries, { adopted: true, retained: 'cap' });
  const oldId = await persistence.logClassification(item, oldResult); history.push(oldId);
  const oldStatus = { version: 'classification.candidate_bound_verification.v1', status_id: 'abstained' };
  await query(`UPDATE classification_history SET metadata=jsonb_set(metadata,
    '{classification_details,candidate_bound_verification}', $2::jsonb) WHERE id=$1`, [oldId, JSON.stringify(oldStatus)]);
  const range = { previousStart: new Date(Date.now() - 3600000), currentEnd: new Date(Date.now() + 3600000) };
  const metrics = () => loadCandidateBoundVerificationDailyOutcomeMetrics(database, range);
  const telemetry = () => loadClassificationDecisionPathTelemetry(database, { start: range.previousStart, end: range.currentEnd });
  const before = await metrics(), beforeTelemetry = await telemetry();
  expect(before.some(row => row.statusId === 'abstained' && row.outcomeCount > 0)).toBe(true);
  const result = await currentReviewResult(item, libraries, { adopted: true, retained });
  const id = await persistence.logClassification(item, result); history.push(id);
  const rows = (await query('SELECT id,metadata FROM classification_history WHERE id=ANY($1::bigint[])', [[oldId, id]])).rows;
  expect(rows.find(row => String(row.id) === String(id)).metadata.classification_details.candidate_bound_verification).toBeNull();
  expect(rows.find(row => String(row.id) === String(oldId)).metadata.classification_details.candidate_bound_verification).toEqual(oldStatus);
  expect(await metrics()).toEqual(before);
  expect((await telemetry()).strict_verification_abstention_count).toEqual(beforeTelemetry.strict_verification_abstention_count);
});

test.each([
  ['native_intent', false, null], ['compatibility_bridge', false, null], ['native_intent', true, null], ['compatibility_bridge', true, null],
  ['native_intent', true, 'cap'], ['compatibility_bridge', true, 'cap'],
  ['native_intent', true, 'rejected'], ['compatibility_bridge', true, 'rejected'],
])('current %s adopted=%s retained=%s evaluation survives the real writer, row binding and explicit receipt/replay', async (source, adopted, retained) => {
  const { libraries, item } = await fixture(source), result = await currentReviewResult(item, libraries, { adopted, retained });
  const original = { action: 'prompt_confirm', confidence: 80, ranked: [{ library_id: 2001, policy_id: 2001, score: 80 }] };
  item.policyResult = original;
  const discord = jest.spyOn(persistence, '_sendAwaitingDecisionDiscordNotification').mockResolvedValue();
  const id = await persistence.logClassification(item, result); history.push(id);
  const row = (await query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
  const frame = row.metadata.classification_details.current_policy_review;
  expect(frame).toMatchObject({ version: 'policy.current_review.v1', classification_id: String(id), status: 'recorded',
    identity_key: `movie:${item.tmdb_id}`, method: retained ? 'policy_recheck' : 'ai_verified', policy: { confidence: result.policyResult.confidence } });
  expect(frame.policy.ranked[0].detail.card.purpose_evidence.origin).toBe(source === 'native_intent' ? 'declared_native' : 'unverified');
  expect(row.metadata.policyResult).toEqual(original); expect(row.library_id).toBeNull();
  expect(discord).toHaveBeenCalledTimes(1);
  expect(discord.mock.calls[0][1].classification_details.current_policy_review).toEqual(frame);
  expect(savedCurrentPolicyReviewMetadata(result, item).classification_details.current_policy_review).toEqual(frame);
  expect(item.classification_details).toBeUndefined();
  const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: row, question: row.policy_question });
  expect(contract.recommendation.leading_destination.library_id).toBe(libraries[0].id);
  expect(contract.decision_summary.deterministic.score).toBe(Math.round(result.policyResult.ranked[0].score));
  const parsed = parsePolicyRuntimeQuestionAnswer({ contract_version: contract.version, contract_fingerprint: contract.fingerprint,
    action_id: 'confirm_destination', destination_library_id: libraries[0].id });
  const resolve = () => resolvePolicyQuestion(id, libraries[0].id, null, 'owned-operator', false,
    { policyQuestionContext: context, answerContract: parsed.answer });
  expect(await resolve()).toMatchObject({ success: true, shouldRoute: true });
  // Manual method changes invalidate new-frame presentation, but exact receipt recovery comes first.
  expect(await resolve()).toMatchObject({ idempotent: true, shouldRoute: false });
  expect((await query('SELECT metadata FROM classification_history WHERE id=$1', [id])).rows[0].metadata.classification_details.current_policy_review).toEqual(frame);
});

test.each([[false, null], [true, null], [true, 'cap'], [true, 'rejected']])('adopted=%s retained=%s pre-insert mutation after lifecycle waits saves a row-bound evidence gap', async (adopted, retained) => {
  const { libraries, item } = await fixture(), result = await currentReviewResult(item, libraries, { adopted, retained });
  const ordinary = persistence.pendingDecisionLifecycleService;
  const writer = new ClassificationPersistenceService({ policyQuestionContext: context, pendingDecisionLifecycleService: {
    persist: args => ordinary.persist({ ...args, insert: async (...params) => {
      result.policyResult.ranked[0].score++;
      return args.insert(...params);
    } }),
  } });
  const id = await writer.logClassification(item, result); history.push(id);
  const row = (await query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
  expect(row.metadata.classification_details.current_policy_review).toMatchObject({ classification_id: String(id), status: 'evidence_gap', policy: null });
  const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: row, question: row.policy_question });
  expect(contract.recommendation.leading_destination).toBeNull();
  expect(contract.allowed_actions.find(action => action.id === 'confirm_destination').available).toBe(true);
});

test.each([
  ['rollback', false, null], ['lost acknowledgement', false, null], ['delayed acknowledgement', false, null],
  ['rollback', true, null], ['lost acknowledgement', true, null], ['delayed acknowledgement', true, null],
  ['rollback', true, 'cap'], ['lost acknowledgement', true, 'cap'], ['delayed acknowledgement', true, 'cap'],
  ['rollback', true, 'rejected'], ['lost acknowledgement', true, 'rejected'], ['delayed acknowledgement', true, 'rejected'],
])('current row/frame %s adopted=%s retained=%s preserves ordinary transaction and notification semantics', async (kind, adopted, retained) => {
  const { libraries, item } = await fixture(), result = await currentReviewResult(item, libraries, { adopted, retained });
  let inserted, release, committed;
  const didCommit = new Promise(resolve => { committed = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const writer = new ClassificationPersistenceService({ policyQuestionContext: context, pendingDecisionLifecycleService: {
    persist: async args => {
      const classificationId = await database.withTransaction(async client => {
        inserted = await args.insert(client, []);
        if (kind === 'rollback') throw new Error('Owned rollback');
        return inserted;
      });
      history.push(classificationId); committed();
      if (kind === 'lost acknowledgement') throw new Error('Owned lost acknowledgement');
      await gate; return { classificationId };
    },
  } });
  const notify = jest.spyOn(writer, '_sendAwaitingDecisionDiscordNotification').mockResolvedValue();
  const pending = writer.logClassification(item, result);
  if (kind === 'rollback') {
    await expect(pending).rejects.toThrow('Owned rollback');
    expect((await query('SELECT id FROM classification_history WHERE id=$1', [inserted])).rowCount).toBe(0);
  } else if (kind === 'lost acknowledgement') {
    await expect(pending).rejects.toThrow('Owned lost acknowledgement');
    expect((await query('SELECT metadata FROM classification_history WHERE id=$1', [inserted])).rows[0].metadata.classification_details.current_policy_review.classification_id).toBe(String(inserted));
  } else {
    await didCommit; expect(notify).not.toHaveBeenCalled();
    expect(savedCurrentPolicyReviewMetadata(result, item)).toBe(item);
    release(); expect(await pending).toBe(inserted); expect(notify).toHaveBeenCalledTimes(1);
  }
  if (kind !== 'delayed acknowledgement') expect(notify).not.toHaveBeenCalled();
});

test('concurrent replacements retain each frame with its own row and supersede only the older pending row', async () => {
  const { libraries, item } = await fixture(), first = await currentReviewResult(item, libraries), second = await currentReviewResult(item, libraries, { adopted: true, retained: 'cap' });
  const ids = await Promise.all([persistence.logClassification(item, first), persistence.logClassification(item, second)]);
  history.push(...ids);
  const rows = (await query('SELECT * FROM classification_history WHERE id=ANY($1::bigint[]) ORDER BY id', [ids])).rows;
  expect(rows.map(row => row.status).sort()).toEqual(['awaiting_decision', 'reclassified']);
  for (const row of rows) expect(row.metadata.classification_details.current_policy_review).toMatchObject({ classification_id: String(row.id), status: 'recorded' });
});

test.each([[false, null], [true, null], [true, 'cap'], [true, 'rejected']])('adopted=%s retained=%s loopback pending/answer HTTP retains current fingerprints and exact completion', async (adopted, retained) => {
  const { libraries, item } = await fixture(), result = await currentReviewResult(item, libraries, { adopted, retained });
  item.policyResult = { action: 'prompt_confirm', confidence: 80, ranked: [{ library_id: 2001, score: 80 }] };
  const id = await persistence.logClassification(item, result); history.push(id);
  const app = express(), routed = jest.fn(); app.use(express.json());
  app.get('/pending', async (_req, res) => {
    const row = (await query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
    res.json(buildPolicyRuntimeQuestionAnswerContract({ classification: row, question: row.policy_question }));
  });
  app.post('/answer', async (req, res) => {
    const parsed = parsePolicyRuntimeQuestionAnswer(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.reason });
    try {
      const outcome = await resolvePolicyQuestion(id, parsed.answer.destinationLibraryId, null, 'owned-operator', false,
        { policyQuestionContext: context, answerContract: parsed.answer });
      if (outcome.shouldRoute) routed();
      return res.json(outcome);
    } catch (error) { return res.status(error.statusCode || 500).json({ code: error.code }); }
  });
  const first = (await request(app).get('/pending')).body;
  expect(first.recommendation.leading_destination.library_id).toBe(libraries[0].id);
  const answer = contract => ({ contract_version: contract.version, contract_fingerprint: contract.fingerprint,
    action_id: 'confirm_destination', destination_library_id: libraries[0].id });
  await query(`UPDATE classification_history SET metadata=jsonb_set(metadata,
    '{classification_details,current_policy_review,status}', '"evidence_gap"'::jsonb) WHERE id=$1`, [id]);
  expect((await request(app).post('/answer').send(answer(first))).status).toBe(409);
  expect(routed).not.toHaveBeenCalled();
  const gap = (await request(app).get('/pending')).body;
  expect(gap.recommendation.leading_destination).toBeNull();
  expect((await request(app).post('/answer').send(answer(gap))).body).toMatchObject({ success: true, shouldRoute: true });
  expect((await request(app).post('/answer').send(answer(gap))).body).toMatchObject({ idempotent: true, shouldRoute: false });
  expect(routed).toHaveBeenCalledTimes(1);
});

test.each([[false, null], [true, null], [true, 'cap'], [true, 'rejected']])('adopted=%s retained=%s actual History writer binds a BIGINT row beyond safe-number precision', async (adopted, retained) => {
  const { libraries, item } = await fixture(), result = await currentReviewResult(item, libraries, { adopted, retained });
  const original = (await query('SELECT last_value FROM classification_history_id_seq')).rows[0].last_value;
  let inserted;
  try {
    await query("SELECT setval('classification_history_id_seq',9007199254740992,true)");
    inserted = await persistence.logClassification(item, result); history.push(inserted);
    expect(inserted).toBe('9007199254740993');
    const row = (await query('SELECT * FROM classification_history WHERE id=$1', [inserted])).rows[0];
    expect(row.metadata.classification_details.current_policy_review.classification_id).toBe(inserted);
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: row, question: row.policy_question });
    expect(contract.recommendation.leading_destination.library_id).toBe(libraries[0].id);
  } finally {
    if (inserted) await query('DELETE FROM classification_history WHERE id=$1', [inserted]);
    await query("SELECT setval('classification_history_id_seq',$1,true)", [original]);
  }
});

test.each(['before invocation', 'after fulfillment'])('adopted proof loss %s saves a gap instead of reviving the original destination', async phase => {
  const { libraries, item } = await fixture();
  const earlier = { id: 2001, name: 'Earlier destination', media_type: 'movie', is_active: true };
  libraries.push(earlier);
  const { ctx } = ragRecheckStageContext({ item, libraries }, { earlier });
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const stage = await runPolicyRecheckStage(ctx);
  expect(stage.policyGate.shouldAdopt).toBe(true);
  const aiClassify = jest.fn(async (metadata, pool, signalContext, options) => {
    enterAdoptedRagVerification(options.adoptedRagVerification, { metadata, libraries: pool, signalContext }, options.verificationCandidate);
    stage.policyAfter.ranked[0].score++;
    return { library: pool[0], confidence: signalContext.confidence, verified_by_ai: true };
  });
  const rerun = await runAiRerunStage({ ...ctx, policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate,
    policyRecheckStage: phase === 'before invocation' ? { ...stage } : stage, aiClassify });
  expect(aiClassify).toHaveBeenCalledTimes(phase === 'before invocation' ? 0 : 1);
  expect(rerun.aiCallsUsed).toBe(phase === 'before invocation' ? 1 : 2);
  expect(rerun.pass2Candidate).toBe(stage.pass2Candidate);
  const result = publishCurrentPolicyReviewFrame(rerun.pass2Candidate, { ...rerun.pass2Candidate });
  await ensureDecisionQuestion({ metadata: item, result, libraries, policyResult: stage.policyAfter });
  item.policyResult = { action: 'prompt_confirm', confidence: 80, ranked: [{ library_id: earlier.id, score: 80 }] };
  const id = await persistence.logClassification(item, result); history.push(id);
  const row = (await query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
  expect(row.metadata.classification_details.current_policy_review).toMatchObject({ status: 'evidence_gap', policy: null, classification_id: String(id) });
  const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: row, question: row.policy_question });
  expect(contract.recommendation.leading_destination).toBeNull();
  expect(row.metadata.policyResult.ranked[0].library_id).toBe(earlier.id);
  const answer = parsePolicyRuntimeQuestionAnswer({ contract_version: contract.version, contract_fingerprint: contract.fingerprint,
    action_id: 'confirm_destination', destination_library_id: libraries[0].id }).answer;
  const resolve = () => resolvePolicyQuestion(id, libraries[0].id, null, 'owned-operator', false,
    { policyQuestionContext: context, answerContract: answer });
  expect(await resolve()).toMatchObject({ success: true, shouldRoute: true });
  expect(await resolve()).toMatchObject({ idempotent: true, shouldRoute: false });
});

test.each([
  ['confirmed', false], ['abstained', false], ['confirmed', true], ['abstained', true],
])('selected %s adopted=%s persists invocation-owned context/advisory and the bound review frame', async (outcome, adopted) => {
  const { libraries, item } = await fixture();
  const currentAdvisory = outcome === 'confirmed' ? null : {
    version: 'classification.ai_advisory.v1', status_id: 'verification_abstained', mode: 'verification',
    source_format: 'candidate_bound_abstain', message: 'Current invocation requires review',
    deterministic_candidate: { library_id: libraries[0].id, library_name: libraries[0].name }, proposed_destination: null,
  };
  const questionBuild = jest.spyOn(policyQuestionBuilder, 'build');
  const result = await currentReviewResult(item, libraries, { currentAdvisory, adopted });
  expect(questionBuild).toHaveBeenCalledWith(expect.objectContaining({
    relatedEvidenceSummary: null,
  }));
  expect(Object.keys(result.signalContext).sort()).toEqual(['confidence', 'ranked', 'suggestedLibrary']);
  expect(result.signalContext.ranked).toBe(result.policyResult.ranked);
  expect(result.signalContext.suggestedLibrary).toBe(libraries[0]);
  expect(result.signalContext.confidence).toBe(result.policyResult.confidence);
  expect(result.ai_advisory).toBe(currentAdvisory);
  expect(result.policy_question.meta.related_evidence_summary).toBeUndefined();
  const id = await persistence.logClassification(item, result); history.push(id);
  const row = (await query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
  expect(row.signals_json).toBeNull();
  expect(row.metadata.classification_details.rag_details).toBeNull();
  expect(row.metadata.classification_details.ai_advisory).toEqual(currentAdvisory);
  expect(row.metadata.classification_details.current_policy_review).toMatchObject({ status: 'recorded', classification_id: String(id) });
  expect(JSON.stringify(row)).not.toContain('EARLIER ADVISORY SENTINEL');
  expect(JSON.stringify(row)).not.toContain('EARLIER SUMMARY SENTINEL');
  const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: row, question: row.policy_question });
  expect(contract.decision_summary.ai_advisory.status_id).toBe(outcome === 'confirmed' ? 'advisory_unavailable' : 'historic_advisory_not_retained');
  expect(contract.recommendation.leading_destination.library_id).toBe(libraries[0].id);
  if (adopted && outcome === 'confirmed') {
    const oldRow = structuredClone(row);
    oldRow.metadata.classification_details.ai_advisory = {
      version: 'classification.ai_advisory.v1', status_id: 'earlier_advisory', mode: 'verification',
      source_format: 'earlier_pass', message: 'EARLIER ADVISORY SENTINEL',
      deterministic_candidate: { library_id: 2001, library_name: 'Earlier destination' }, proposed_destination: null,
    };
    const oldContract = buildPolicyRuntimeQuestionAnswerContract({ classification: oldRow, question: oldRow.policy_question });
    expect(oldContract.recommendation).toEqual(contract.recommendation);
    expect(oldContract.fingerprint).not.toBe(contract.fingerprint);
    const answer = fingerprint => parsePolicyRuntimeQuestionAnswer({ contract_version: contract.version,
      contract_fingerprint: fingerprint, action_id: 'confirm_destination', destination_library_id: libraries[0].id }).answer;
    const resolve = receipt => resolvePolicyQuestion(id, libraries[0].id, null, 'owned-operator', false,
      { policyQuestionContext: context, answerContract: receipt });
    await expect(resolve(answer(oldContract.fingerprint))).rejects.toMatchObject({ statusCode: 409 });
    expect((await query('SELECT status FROM classification_history WHERE id=$1', [id])).rows[0].status).toBe('awaiting_decision');
    expect(await resolve(answer(contract.fingerprint))).toMatchObject({ success: true, shouldRoute: true });
    expect(await resolve(answer(contract.fingerprint))).toMatchObject({ idempotent: true, shouldRoute: false });
  }
});

for (const source of ['native_intent', 'compatibility_bridge']) {
  test.each(['genuine', 'copied'])(`real ${source} %s non-adopted stage admits only coherent fresh verification`, async kind => {
    const { libraries, item, created } = await fixture(source), expanded = { ...item, overview: 'Owned fresh expansion' };
    const earlier = { id: 2001, name: 'Earlier destination', media_type: 'movie', is_active: true }; libraries.push(earlier);
    await query(`INSERT INTO media_server_items(library_id,external_id,title,media_type,genres)
      VALUES($1,'nonadopted-observation','PRIVATE NONADOPTED ITEM','movie',ARRAY['Owned fresh observation'])`, [created.libraryId]);
    if (kind === 'copied') {
      const evaluate = policyEngine.evaluateItem.bind(policyEngine);
      jest.spyOn(policyEngine, 'evaluateItem').mockImplementation(async (...args) => ({ ...await evaluate(...args) }));
    }
    jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
    const ctx = nonadoptedRagContext({ item: expanded, libraries }, { earlier });
    const stage = await runPolicyRecheckStage(ctx);
    expect(stage.policyAfter.action).toBe('prompt_confirm'); expect(stage.policyGate.shouldAdopt).toBe(false);
    const original = database.query.bind(database), reads = [];
    jest.spyOn(database, 'query').mockImplementation((sql, params, ...rest) => { reads.push({ sql, params }); return original(sql, params, ...rest); });
    const aiClassify = jest.fn(async (metadata, pool, signalContext, options) => {
      const session = enterNonadoptedRagVerification(options.nonadoptedRagVerification, { metadata, libraries: pool, signalContext }, options.verificationCandidate);
      expect(signalContext.confidence).toBe(stage.policyAfter.confidence); expect(signalContext.confidence).not.toBe(80);
      expect(signalContext.suggestedLibrary).toBe(libraries[0]); expect(signalContext.breakdown).toBeUndefined();
      session.assertCurrent(); await session.advice.readProfile(id => libraryProfileService.getProfileStats(id));
      const packet = await session.advice.buildPrompt({}, async value => value);
      expect(packet.libraryProfile.genreDistribution).toEqual([{ genre: 'Owned fresh observation', percentage: 100 }]);
      expect(packet.policySignals.confidence).toBe(stage.policyAfter.confidence);
      expect(JSON.stringify(packet)).not.toMatch(/PRIVATE NONADOPTED ITEM|EARLIER PASS SENTINEL/u);
      return { library: libraries[0], confidence: signalContext.confidence, verified_by_ai: true };
    });
    const result = await runAiRerunStage({ ...ctx, policyAfter: stage.policyAfter, existingCandidate: null, policyRecheckStage: stage, aiClassify });
    expect(aiClassify).toHaveBeenCalledTimes(kind === 'genuine' ? 1 : 0);
    expect(result.aiCallsUsed).toBe(kind === 'genuine' ? 2 : 1); expect(reads).toHaveLength(kind === 'genuine' ? 1 : 0);
    if (kind === 'genuine') {
      expect(reads[0].params).toEqual([created.libraryId]); expect(result.pass2Candidate.confidence).toBe(stage.policyAfter.confidence);
      expect(result.pass2Candidate.signalContext).toBe(aiClassify.mock.calls[0][2]);
      expect(result.pass2Candidate.signalContext).not.toBe(ctx.signalContext);
    } else expect(result.pass2Candidate).toBeNull();
    expect(JSON.stringify(result)).not.toContain('nonadoptedRagVerification');
  });
}
