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
const { runPolicyRecheckStage, runAiRerunStage } = await import('../../services/classificationRagLoopStages.mjs');
const { ragRecheckStageContext } = await import('../fixtures/ragRecheckAdviceFixture.mjs');
const { ragLoopResilienceManager } = await import('../../services/ragLoopResilienceManager.mjs');
const { publishCurrentPolicyReviewFrame, savedCurrentPolicyReviewMetadata } = await import('../../services/currentPolicyReviewFrameLive.mjs');
const { ClassificationPersistenceService } = await import('../../services/classificationPersistenceService.mjs');
const { libraryProfileService } = await import('../../services/libraryProfileService.mjs');
const { ensureDecisionQuestion } = await import('../../services/classificationRoutingServiceShared.mjs');
const { evaluateClassificationRouteSafety } = await import('../../services/classificationRouteSafetyGate.mjs');
const { resolveRuntimeQuestionInTransaction } = await import('../../services/clarificationPolicyResolution.mjs');
const { buildPolicyRuntimeQuestionAnswerContract, parsePolicyRuntimeQuestionAnswer } = await import('../../services/policyRuntimeQuestionAnswerContract.mjs');
const { loadCandidateBoundVerificationDailyOutcomeMetrics } = await import('../../services/classificationCandidateBoundVerificationMetricsRepository.mjs');
const context = { extractQuestionContext: () => ({}), getPolicyQuestionContextVersion: async () => 1,
  stampPolicyQuestionContext: value => value, isPolicyQuestionStale: () => false };
const persistence = new ClassificationPersistenceService({ policyQuestionContext: context });
const fixtures = [], history = [];
beforeAll(async () => {
  database = createReadinessDatabase();
  await query("INSERT INTO users(id,username,password_hash,role) VALUES(1,'auto-review-admin','synthetic-only','admin') ON CONFLICT(id) DO NOTHING");
});
afterEach(async () => {
  jest.restoreAllMocks();
  for (const id of history) await query('DELETE FROM classification_history WHERE id=$1', [id]);
  for (const cleanup of fixtures.reverse()) await cleanup();
  history.length = 0; fixtures.length = 0;
});
afterAll(async () => { await database.pool.end(); });

async function fixture(source = 'native_intent', { hold = 'authority', copied = false, low = false } = {}) {
  const created = await createPolicyEngineIntegrationFixture(database, { libraryName: `Current B ${randomUUID()}`,
    presetSignals: { keywords: { require_any: ['Owned-anchor'], semantics: 'identity' } },
    policyValues: { trust_patterns: true, trust_rag: false, trust_history: false, preset_weight: 0.35,
      profile_weight: 0.25, pattern_weight: 0.15, ...(low ? { auto_classify_threshold: 50, prompt_threshold: 40 } : {}) } });
  fixtures.push(created.cleanup);
  const earlier = (await query(`INSERT INTO libraries(media_server_id,external_id,name,media_type,is_active)
    VALUES($1,$2,'Original A','movie',true) RETURNING *`, [created.mediaServerId, randomUUID()])).rows[0];
  fixtures.push(() => query('DELETE FROM libraries WHERE id=$1', [earlier.id]));
  if (source === 'native_intent') {
    await query('DELETE FROM policy_presets WHERE policy_id=$1', [created.policyId]);
    await applyPolicyInitialIntentEstablishment({ dbClient: database, policyId: created.policyId, actorId: 1,
      request: { schema_version: 1, idempotency_key: randomUUID(), declared_intent: { purpose: [{
        signal_type: 'keywords', operator: 'require_any', values: { require_any: ['Owned-anchor'] }, semantics: 'identity',
      }] } } });
  }
  jest.spyOn(policyEngine, 'checkAuthoritativeSignals').mockResolvedValue(null);
  jest.spyOn(policyEngine, 'getActivePolicies').mockImplementation(async () =>
    (await getActivePolicies({ dbClient: database, throwOnError: true })).filter(policy => policy.id === created.policyId));
  jest.spyOn(policyEngine, 'scoreProfileWithDiagnostics').mockResolvedValue({ score: low ? 35 : 100, diagnostics: null });
  jest.spyOn(policyEngine, 'scorePatterns').mockResolvedValue(low ? 35 : 100);
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  if (copied) {
    const evaluate = policyEngine.evaluateItem.bind(policyEngine);
    jest.spyOn(policyEngine, 'evaluateItem').mockImplementation(async (...args) => ({ ...await evaluate(...args) }));
  }
  const libraries = [(await query('SELECT * FROM libraries WHERE id=$1', [created.libraryId])).rows[0], earlier];
  const item = { tmdb_id: 884414, media_type: 'movie', title: 'Owned automatic database item', keywords: ['Owned-anchor'] };
  const { ctx } = ragRecheckStageContext({ item, libraries }, { earlier });
  const original = { action: 'prompt_confirm', confidence: low ? 10 : 80, ranked: [{ library_id: earlier.id,
    policy_id: created.policyId + 100000, score: low ? 10 : 80, auto_classify_threshold: 95, prompt_threshold: 60 }] };
  Object.assign(ctx.signalContext, { ranked: original.ranked, confidence: original.confidence, suggestedLibrary: earlier });
  Object.assign(ctx.signalContext, { relatedEvidenceSummary: { source: 'EARLIER SUMMARY SENTINEL' },
    signals: { earlier_signal: 99 }, ragContext: { similarItems: [{ similarity: 0.99, title: 'EARLIER RETRIEVAL SENTINEL' }] } });
  ctx.baselineResult.ai_advisory = { version: 'classification.ai_advisory.v1', status_id: 'earlier_advisory',
    mode: 'verification', source_format: 'earlier_pass', message: 'EARLIER ADVISORY SENTINEL',
    deterministic_candidate: { library_id: earlier.id, library_name: earlier.name }, proposed_destination: null };
  Object.assign(ctx.baselineResult, { confidence: original.confidence, candidate_bound_verification: {
    version: 'classification.candidate_bound_verification.v1', status_id: 'confirmed' } });
  if (hold === 'authority') ctx.baselineResult.ai_authority = { sideEffects: { canRoute: false, canLearn: false } };
  ctx.policyResult = original;
  const stage = await runPolicyRecheckStage(ctx), aiClassify = jest.fn();
  expect(stage.policyAfter.action).toBe('auto_classify'); expect(stage.policyGate.shouldAdopt).toBe(true);
  const rerun = await runAiRerunStage({ ...ctx, policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate,
    policyRecheckStage: stage, aiClassify });
  expect(aiClassify).not.toHaveBeenCalled(); expect(rerun.aiCallsUsed).toBe(1);
  expect(rerun.pass2Candidate).toBe(stage.pass2Candidate);
  expect(stage.pass2Candidate.candidate_bound_verification).toBeNull();
  expect(ctx.baselineResult.candidate_bound_verification.status_id).toBe('confirmed');
  expect(stage.pass2Candidate.signalContext).toEqual(copied ? null : {
    ranked: stage.policyAfter.ranked, confidence: stage.policyAfter.confidence, suggestedLibrary: libraries[0] });
  expect(stage.pass2Candidate.ai_advisory).toBeNull();
  expect(ctx.baselineResult.ai_advisory.message).toBe('EARLIER ADVISORY SENTINEL');
  const result = publishCurrentPolicyReviewFrame(stage.pass2Candidate, { ...stage.pass2Candidate });
  await ensureDecisionQuestion({ metadata: item, result, libraries, policyResult: stage.policyAfter });
  item.policyResult = original;
  return { item, libraries, result, stage, original, ctx };
}
async function save(value, writer = persistence) {
  const id = await writer.logClassification(value.item, value.result); history.push(id);
  return (await query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
}
const contract = row => buildPolicyRuntimeQuestionAnswerContract({ classification: row, question: row.policy_question });

test.each(['native_intent', 'compatibility_bridge'])('%s unavailable optional proof adds no automatic routing hold', async source => {
  const value = await fixture(source, { copied: true, hold: null });
  expect(value.result.signalContext).toBeNull(); expect(value.result.ai_advisory).toBeNull();
  expect(value.result.needs_clarification).toBe(false);
  const row = await save(value);
  expect(row.status).toBe('completed'); expect(row.library_id).toBe(value.libraries[0].id);
  expect(evaluateClassificationRouteSafety({ result: value.result }).automatic_route_allowed).toBe(true);
  expect(row.metadata.classification_details).not.toHaveProperty('current_policy_review');
});

test.each(['native_intent', 'compatibility_bridge'].flatMap(source =>
  ['awaiting_decision', 'completed', 'pending_retry'].flatMap(status => [false, true].map(explicit => [source, status, explicit]))))(
  '%s automatic %s persists current support with explicit top-level evidence=%s', async (source, status, explicit) => {
    const value = await fixture(source, { hold: status === 'awaiting_decision' ? 'authority' : null });
    if (status === 'pending_retry') value.result.needs_retry = true;
    const signals = { explicit_current_signal: 81 }, rag = { similarItems: [{ similarity: 0.83,
      textSimilarity: 0.7, imageSimilarity: 0.91, textWeight: 0.4, imageWeight: 0.6 }] };
    if (explicit) { value.result.signals = signals; value.result.ragContext = rag; }
    const row = await save(value);
    expect(row.status).toBe(status); expect(row.signals_json).toEqual(explicit ? signals : null);
    expect(row.metadata.classification_details.rag_details).toEqual(explicit ? { combined_similarity: 0.83,
      text_similarity: 0.7, image_similarity: 0.91, text_weight: 0.4, image_weight: 0.6 } : null);
    expect(row.metadata.classification_details.ai_advisory).toBeNull();
    expect(row.metadata.policyResult).toEqual(value.original);
    expect(JSON.stringify(row)).not.toMatch(/EARLIER ADVISORY SENTINEL|EARLIER SUMMARY SENTINEL|EARLIER RETRIEVAL SENTINEL/u);
    if (explicit) { expect(value.result.signals).toBe(signals); expect(value.result.ragContext).toBe(rag); }
    if (status === 'awaiting_decision') {
      expect(row.metadata.classification_details.current_policy_review.version).toBe('policy.current_review.v3');
      expect(contract(row).decision_summary.ai_advisory).toBeNull();
    } else expect(row.metadata.classification_details).not.toHaveProperty('current_policy_review');
  });

test.each(['native_intent', 'compatibility_bridge'])('%s real load/decision/writer retains the current automatic reference and hold', async source => {
  const value = await fixture(source), discord = jest.spyOn(persistence, '_sendAwaitingDecisionDiscordNotification').mockResolvedValue();
  const row = await save(value), frame = row.metadata.classification_details.current_policy_review;
  expect(row.status).toBe('awaiting_decision'); expect(row.library_id).toBeNull();
  expect(frame).toMatchObject({ version: 'policy.current_review.v3', classification_id: String(row.id), status: 'recorded',
    method: 'policy_auto', policy: { action: 'auto_classify', confidence: value.stage.policyAfter.confidence } });
  expect(frame.policy.ranked[0].library_id).toBe(value.libraries[0].id);
  expect(frame.policy.ranked[0].detail.card.purpose_evidence.origin).toBe(source === 'native_intent' ? 'declared_native' : 'unverified');
  expect(row.metadata.policyResult).toEqual(value.original);
  expect(row.metadata.classification_details.candidate_bound_verification).toBeNull();
  expect(contract(row).recommendation.leading_destination).toMatchObject({ library_id: value.libraries[0].id,
    evidence_score: Math.round(value.stage.policyAfter.confidence) });
  expect(contract(row).decision_summary.deterministic.safety_gate.id).toBe('ai_advisory_cannot_route');
  expect(discord).toHaveBeenCalledTimes(1);
  expect(discord.mock.calls[0][1].classification_details.current_policy_review).toEqual(frame);
  expect(savedCurrentPolicyReviewMetadata(value.result, value.item).classification_details.current_policy_review).toEqual(frame);
});

test.each(['completed', 'pending_retry', 'initial automatic', 'unknown completed copy'])('%s takes the ordinary writer without a v3 frame', async kind => {
  const value = await fixture('native_intent', { hold: null });
  expect(value.result.needs_clarification).toBe(false);
  if (kind === 'pending_retry') value.result.needs_retry = true;
  if (kind === 'initial automatic') value.result = { library: value.libraries[0], confidence: 100, method: 'policy_auto' };
  if (kind === 'unknown completed copy') value.result = { ...value.result };
  const row = await save(value);
  expect(row.status).toBe(kind === 'pending_retry' ? 'pending_retry' : 'completed');
  expect(row.metadata.classification_details).not.toHaveProperty('current_policy_review');
  expect(row.metadata.classification_details.candidate_bound_verification).toBeNull();
});

test.each(['low configured threshold', 'administrator hold'])('%s preserves the actual hold and current evidence', async kind => {
  let previous;
  if (kind === 'administrator hold') {
    previous = (await query("SELECT value FROM settings WHERE key='require_all_confirmations'")).rows[0];
    await query("INSERT INTO settings(key,value) VALUES('require_all_confirmations','true') ON CONFLICT(key) DO UPDATE SET value='true'");
  }
  try {
    const value = await fixture('native_intent', { hold: null, low: kind === 'low configured threshold' });
    const row = await save(value);
    expect(row.status).toBe('awaiting_decision');
    expect(row.metadata.classification_details.current_policy_review.status).toBe('recorded');
    expect(contract(row).recommendation.leading_destination.library_id).toBe(value.libraries[0].id);
    expect(contract(row).decision_summary.deterministic.safety_gate.id).toBe(kind === 'administrator hold' ? 'administrative_confirmation_required' : 'low_confidence_review_required');
  } finally {
    if (kind === 'administrator hold') {
      if (previous) await query("UPDATE settings SET value=$1 WHERE key='require_all_confirmations'", [previous.value]);
      else await query("DELETE FROM settings WHERE key='require_all_confirmations'");
    }
  }
});

test.each(['copied evaluation', 'unknown result copy', 'pre-insert mutation'])('%s writes a v3 gap without original recommendation fallback', async kind => {
  const value = await fixture('native_intent', { copied: kind === 'copied evaluation' });
  if (kind === 'unknown result copy') value.result = { ...value.result };
  const ordinary = persistence.pendingDecisionLifecycleService;
  const writer = kind !== 'pre-insert mutation' ? persistence : new ClassificationPersistenceService({ policyQuestionContext: context,
    pendingDecisionLifecycleService: { persist: args => ordinary.persist({ ...args, insert: async (...params) => {
      value.stage.policyAfter.ranked[0].score--; return args.insert(...params);
    } }) } });
  const row = await save(value, writer);
  expect(row.metadata.classification_details.current_policy_review).toMatchObject({ version: 'policy.current_review.v3',
    classification_id: String(row.id), status: 'evidence_gap', policy: null });
  expect(contract(row).recommendation.leading_destination).toBeNull();
  expect(contract(row).recommendation.policy_destination).toBeNull();
  expect(contract(row).allowed_actions.find(action => action.id === 'confirm_destination').available).toBe(true);
});

test.each(['awaiting_decision', 'completed'])('creation cohort uses derived %s, not flags mutated during a later wait', async status => {
  const value = await fixture('native_intent', { hold: status === 'awaiting_decision' ? 'authority' : null });
  const ordinary = persistence.pendingDecisionLifecycleService;
  let writer = persistence;
  if (status === 'awaiting_decision') writer = new ClassificationPersistenceService({ policyQuestionContext: context,
    pendingDecisionLifecycleService: { persist: args => ordinary.persist({ ...args, insert: async (...params) => {
      value.result.needs_clarification = false; return args.insert(...params);
    } }) } });
  else jest.spyOn(libraryProfileService, 'getProfileStats').mockImplementation(async () => {
    value.result.needs_clarification = true; return null;
  });
  const row = await save(value, writer); expect(row.status).toBe(status);
  if (status === 'awaiting_decision') expect(row.metadata.classification_details.current_policy_review.version).toBe('policy.current_review.v3');
  else expect(row.metadata.classification_details).not.toHaveProperty('current_policy_review');
});

test.each(['current B', 'original A'])('loopback HTTP %s explicit choice has stale protection and one completed receipt', async choice => {
  const value = await fixture(), row = await save(value), destination = value.libraries[choice === 'current B' ? 0 : 1].id;
  const app = express(), routed = jest.fn(); app.use(express.json());
  app.post('/answer', async (req, res) => {
    const parsed = parsePolicyRuntimeQuestionAnswer(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.reason });
    try {
      const { resolution: outcome } = await resolveRuntimeQuestionInTransaction(row.id, req.body, 'owned-operator',
        { policyQuestionContext: context });
      if (outcome.shouldRoute) routed(); return res.json(outcome);
    } catch (error) { return res.status(error.statusCode || 500).json({ code: error.code }); }
  });
  const current = contract(row), body = { contract_version: current.version, contract_fingerprint: current.fingerprint,
    action_id: 'confirm_destination', destination_library_id: destination };
  const earlierRow = structuredClone(row);
  earlierRow.metadata.classification_details.ai_advisory = value.ctx.baselineResult.ai_advisory;
  const earlierContract = contract(earlierRow);
  expect(earlierContract.recommendation).toEqual(current.recommendation);
  expect(earlierContract.fingerprint).not.toBe(current.fingerprint);
  expect((await request(app).post('/answer').send({ ...body, contract_fingerprint: earlierContract.fingerprint })).status).toBe(409);
  expect((await request(app).post('/answer').send({ ...body, contract_fingerprint: '0'.repeat(64) })).status).toBe(409);
  expect(routed).not.toHaveBeenCalled();
  expect((await request(app).post('/answer').send(body)).body).toMatchObject({ success: true, shouldRoute: true });
  await query("UPDATE classification_history SET method='manual_correction' WHERE id=$1", [row.id]);
  expect((await request(app).post('/answer').send(body)).body).toMatchObject({ idempotent: true, shouldRoute: false });
  expect(routed).toHaveBeenCalledTimes(1);
});

test.each(['rollback', 'lost acknowledgement', 'delayed acknowledgement'])('%s preserves atomic row/frame and notification boundaries', async kind => {
  const value = await fixture(); let inserted, committed, release;
  const didCommit = new Promise(resolve => { committed = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const writer = new ClassificationPersistenceService({ policyQuestionContext: context, pendingDecisionLifecycleService: {
    persist: async args => {
      const id = await database.withTransaction(async client => {
        inserted = await args.insert(client, []);
        if (kind === 'rollback') throw new Error('Owned rollback'); return inserted;
      });
      history.push(id); committed();
      if (kind === 'lost acknowledgement') throw new Error('Owned lost acknowledgement');
      await gate; return { classificationId: id };
    },
  } });
  const notify = jest.spyOn(writer, '_sendAwaitingDecisionDiscordNotification').mockResolvedValue();
  const pending = writer.logClassification(value.item, value.result);
  if (kind === 'rollback') {
    await expect(pending).rejects.toThrow('Owned rollback');
    expect((await query('SELECT id FROM classification_history WHERE id=$1', [inserted])).rowCount).toBe(0);
  } else if (kind === 'lost acknowledgement') {
    await expect(pending).rejects.toThrow('Owned lost acknowledgement');
    expect((await query('SELECT metadata FROM classification_history WHERE id=$1', [inserted])).rows[0].metadata.classification_details.current_policy_review.classification_id).toBe(String(inserted));
  } else {
    await didCommit; expect(notify).not.toHaveBeenCalled();
    expect(savedCurrentPolicyReviewMetadata(value.result, value.item)).toBe(value.item);
    release(); expect(await pending).toBe(inserted); expect(notify).toHaveBeenCalledTimes(1);
  }
  if (kind !== 'delayed acknowledgement') expect(notify).not.toHaveBeenCalled();
});

test('concurrent replacements preserve each row-owned frame', async () => {
  const value = await fixture(), first = value.result;
  const second = publishCurrentPolicyReviewFrame(value.stage.pass2Candidate, { ...value.stage.pass2Candidate });
  await ensureDecisionQuestion({ metadata: value.item, result: second, libraries: value.libraries, policyResult: value.stage.policyAfter });
  const ids = await Promise.all([persistence.logClassification(value.item, first), persistence.logClassification(value.item, second)]);
  history.push(...ids);
  const rows = (await query('SELECT * FROM classification_history WHERE id=ANY($1::bigint[]) ORDER BY id', [ids])).rows;
  expect(rows.map(row => row.status).sort()).toEqual(['awaiting_decision', 'reclassified']);
  for (const row of rows) {
    expect(row.metadata.classification_details.current_policy_review).toMatchObject({ classification_id: String(row.id), status: 'recorded' });
    // Supersession clears the question, but retains the immutable pre-operator evidence with History.
    expect(row.metadata.classification_details.current_policy_review.policy.ranked[0].library_id).toBe(value.libraries[0].id);
  }
});

test('single INSERT binds a BIGINT row beyond safe-number precision without conversion', async () => {
  const value = await fixture(), original = (await query('SELECT last_value FROM classification_history_id_seq')).rows[0].last_value;
  let id;
  try {
    await query("SELECT setval('classification_history_id_seq',9007199254740992,true)");
    const row = await save(value); id = row.id;
    expect(id).toBe('9007199254740993');
    expect(row.metadata.classification_details.current_policy_review.classification_id).toBe(id);
    expect(contract(row).recommendation.leading_destination.library_id).toBe(value.libraries[0].id);
  } finally {
    if (id) await query('DELETE FROM classification_history WHERE id=$1', [id]);
    await query("SELECT setval('classification_history_id_seq',$1,true)", [original]);
  }
});

test('new held and completed auto candidates cannot add inherited verification counts; historical evidence stays', async () => {
  const value = await fixture(), old = await save(value), status = { version: 'classification.candidate_bound_verification.v1', status_id: 'abstained' };
  await query(`UPDATE classification_history SET metadata=jsonb_set(metadata,
    '{classification_details,candidate_bound_verification}', $2::jsonb) WHERE id=$1`, [old.id, JSON.stringify(status)]);
  const range = { previousStart: new Date(Date.now() - 3600000), currentEnd: new Date(Date.now() + 3600000) };
  const before = await loadCandidateBoundVerificationDailyOutcomeMetrics(database, range);
  expect(before.some(row => row.statusId === 'abstained' && row.outcomeCount > 0)).toBe(true);
  await save(value);
  delete value.result.ai_authority;
  await ensureDecisionQuestion({ metadata: value.item, result: value.result, libraries: value.libraries, policyResult: value.stage.policyAfter });
  await save(value);
  expect(await loadCandidateBoundVerificationDailyOutcomeMetrics(database, range)).toEqual(before);
  expect((await query('SELECT metadata FROM classification_history WHERE id=$1', [old.id])).rows[0].metadata.classification_details.candidate_bound_verification).toEqual(status);
});
