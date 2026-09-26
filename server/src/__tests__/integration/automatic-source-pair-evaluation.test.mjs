/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, test, jest } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createAutomaticSourcePairRepository, readAutomaticSourcePairStatus } from '../../services/automaticSourcePairRepository.mjs';
import { createAutomaticSourcePairEvaluation, AUTOMATIC_SOURCE_PAIR_LOCK } from '../../services/automaticSourcePairEvaluation.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { recordDescriptionRepresentation } from '../../services/inventoryDescriptionRepresentationCheckpoint.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';
import { createInventoryDiscoveryAdmission } from '../../services/inventoryDiscoveryAdmission.mjs';
import { sourcePairFixture, sourcePairIdentity as identity } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { captureCachedAdjudication } from '../../services/cachedAdjudicationCapture.mjs';
import { createCachedAdjudicationWriter } from '../../services/cachedAdjudicationRepository.mjs';
import { FRESH_POLICY_CONFIG_SQL } from '../../services/freshInventoryPolicyRuntime.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { readEvaluationHistory } from '../../services/evaluationHistoryRepository.mjs';
import { runAutomaticSourcePairThread } from '../../services/automaticSourcePairThreadClient.mjs';
import { createProgressingSourcePairEvaluation } from '../../services/sourcePairWindowProgression.mjs';
import { selectSourcePairSweepSnapshot } from '../../services/sourcePairCoverageSweep.mjs';

let client, database, repository, worker, fixture, cache;
const makeWorker = () => createAutomaticSourcePairEvaluation({ repository, withSessionAdvisoryLock: database.withSessionAdvisoryLock,
  withAdmission: createInventoryDiscoveryAdmission({ ...database,
    readMemory: () => ({ available: 4e9, constrained: 8e9, total: 8e9 }) }) });
const status = () => readAutomaticSourcePairStatus(client);
const stored = async () => (await client.query('SELECT * FROM automatic_source_pair_evaluation')).rows[0];
const due = () => client.query(`UPDATE automatic_source_pair_evaluation SET observed_at=now()-interval '10 minutes',
  evaluated_at=CASE WHEN evaluated_at IS NULL THEN NULL ELSE LEAST(evaluated_at,now()-interval '10 minutes') END,
  next_check_at=now()-interval '1 minute'`);

beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`CREATE TEMP TABLE libraries(id integer,name text,media_type text,is_active boolean);
    CREATE TEMP TABLE media_server_items(id serial,library_id integer,media_server_id integer,external_id text,
      media_type text,tmdb_id integer,imdb_id text,tvdb_id integer,metadata jsonb,genres jsonb,studio text,content_rating text,
      title text DEFAULT 'Synthetic test item',year integer);
    CREATE TEMP TABLE library_policies(LIKE public.library_policies INCLUDING DEFAULTS);
    CREATE TEMP TABLE policy_intents(LIKE public.policy_intents INCLUDING DEFAULTS);
    CREATE TEMP TABLE policy_intent_rules(LIKE public.policy_intent_rules INCLUDING DEFAULTS);
    CREATE TEMP TABLE policy_intent_template_applications(LIKE public.policy_intent_template_applications INCLUDING DEFAULTS);
    CREATE TEMP TABLE policy_presets(LIKE public.policy_presets INCLUDING DEFAULTS);
    CREATE TEMP TABLE media_source_observations(library_id integer,media_server_id integer,external_id text,last_seen_at timestamptz);
    CREATE TEMP TABLE classification_history(id integer,media_type text,tmdb_id integer,metadata jsonb,created_at timestamptz,library_id integer,status text);
    CREATE TEMP TABLE classification_corrections(id integer,classification_id integer,corrected_library_id integer,original_library_id integer,corrected_by text,created_at timestamp);
    CREATE TEMP TABLE policy_feedback_evaluation(id integer,media_type text,tmdb_id integer,selected_library_id integer,
      was_correction boolean,responded_at timestamptz,evaluation_correct boolean);
    CREATE TEMP TABLE ai_provider_config(id integer,rag_enabled boolean,embedding_provider_mode text,primary_provider text,
      embedding_model text,embedding_ollama_host text,embedding_ollama_port integer,embedding_ollama_model text,
      ollama_host text,ollama_port integer,ollama_model text,configuration_revision integer);
    CREATE TEMP TABLE task_queue(status text,next_retry_at timestamptz);
    CREATE TEMP TABLE media_server_sync_status(id integer,library_id integer,status text,created_at timestamptz);
    CREATE TEMP TABLE inventory_description_vector_cache(LIKE public.inventory_description_vector_cache INCLUDING ALL);
    CREATE TEMP TABLE inventory_description_representation_checkpoint(LIKE public.inventory_description_representation_checkpoint INCLUDING ALL);
    CREATE TEMP TABLE automatic_source_pair_evaluation(LIKE public.automatic_source_pair_evaluation INCLUDING ALL);
    CREATE TEMP TABLE automatic_source_pair_sweep(LIKE public.automatic_source_pair_sweep INCLUDING ALL);
    CREATE TEMP TABLE cached_adjudication_batch(LIKE public.cached_adjudication_batch INCLUDING ALL);
    CREATE TEMP TABLE adjudication_capture_budget(LIKE public.adjudication_capture_budget INCLUDING ALL);
    CREATE TEMP TABLE automatic_evaluation_history(LIKE public.automatic_evaluation_history INCLUDING ALL);
    INSERT INTO adjudication_capture_budget(singleton) VALUES(true);
    INSERT INTO ai_provider_config VALUES(1,true,'same','ollama','test',NULL,NULL,NULL,'localhost',11434,NULL,1);`);
  fixture = sourcePairFixture(48);
  for (const library of fixture.libraries) await client.query('INSERT INTO libraries VALUES($1,$2,$3,true)', [library.id, library.name, library.media_type]);
  for (const row of fixture.rows) await client.query(`INSERT INTO media_server_items
    (library_id,media_server_id,external_id,media_type,tmdb_id,metadata,genres,studio,content_rating)
    VALUES($1,$2,$3,$4,$5,jsonb_build_object('overview',$6::text),$7::jsonb,$8,$9)`,
  [row.library_id,row.media_server_id,row.external_id,row.media_type,row.tmdb_id,row.overview,JSON.stringify(row.genres),row.studio,row.content_rating]);
  database = { ...createIntegrationDatabaseModuleMock(), withTransaction: async callback => {
    await client.query('BEGIN');
    try { const value = await callback(client); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } };
  cache = createInventoryDescriptionVectorCache({ query: (...args) => client.query(...args) });
  const entries = [...fixture.vectors].map(([hash, vector]) => ({ hash, vector }));
  for (let offset=0; offset<entries.length; offset+=8) await cache.write(identity,entries.slice(offset,offset+8));
  await recordDescriptionRepresentation(client, identity, JSON.stringify(resolveLocalStudyEmbeddingConfig(fixture.config)));
  repository = createAutomaticSourcePairRepository(database); worker = makeWorker();
});
afterEach(() => { worker?.stop(); client?.release(true); client=null; });

test('recurring capture resumes after a provider interruption, charges unknown attempts, and rotates only after replay', async () => {
  await client.query(`UPDATE ai_provider_config SET ollama_model='test:latest';
    INSERT INTO library_policies(id,library_id,name,enabled,created_at,updated_at)
    SELECT id,id,'Private policy',true,now()-interval '2 days',now()-interval '2 days' FROM libraries`);
  await worker.run();
  expect((await readEvaluationHistory(database)).groups[0]).toMatchObject({ selected: 25, paired: 0, gaps: { cache_missing: 25 } });
  const budget = createAdjudicationBudgetRepository(database);
  await budget.configure({ dailyCalls: 100,dailyTokens: 844800 });
  let attempts = 0, firstPrompt;
  const generate = jest.fn(async ({ prompt,onGenerationCall }) => {
    await onGenerationCall(); attempts++;
    if (attempts === 1) firstPrompt = prompt;
    if (attempts === 2) throw new Error('PRIVATE interrupted provider response');
    return { response: '{"decision":"ABSTAIN","library_number":null}',latencyMs: 5,promptTokens: 100,outputTokens: 10,
      outputLimitReached: false,contextLimitSuspected: false,inputTruncation: 'unknown' };
  });
  const makeCapture = () => createAdjudicationBudgetWorker({ budget,repository,
    withAdmission: createInventoryDiscoveryAdmission({ ...database,readMemory: () => ({ available: 4e9,constrained: 8e9,total: 8e9 }) }),
    readConfig: async () => (await client.query(FRESH_POLICY_CONFIG_SQL)).rows[0],
    createClient: () => ({ inspect: async () => ({ model: 'test:latest',digest: 'a'.repeat(64),contextLength: 8192 }),generate }) });
  let captureWorker = makeCapture();
  expect(await captureWorker.run()).toEqual({ status: 'unavailable' }); captureWorker.stop();
  expect((await budget.read()).calls_reserved).toBe(2);
  expect((await client.query('SELECT jsonb_array_length(progress->\'records\') AS total FROM adjudication_capture_budget')).rows[0].total).toBe(1);
  for (let attempt = 0; attempt < 12 && !(await budget.read()).published_fingerprint; attempt++) {
    await client.query('UPDATE adjudication_capture_budget SET next_check_at=now()');
    captureWorker = makeCapture();
    expect((await captureWorker.run()).status).toBe('captured'); captureWorker.stop();
  }
  const complete = await budget.read(); expect(complete.published_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(complete.calls_reserved).toBe(attempts);
  expect(generate.mock.calls.filter(([input]) => input.prompt === firstPrompt)).toHaveLength(1);
  expect(complete.selection_offset).toBe(0);
  // Before replay consumes this cache, no new generation or rotation is permitted.
  await client.query('UPDATE adjudication_capture_budget SET next_check_at=now()');
  captureWorker = makeCapture(); expect(await captureWorker.run()).toEqual({ status: 'waiting_for_replay' }); captureWorker.stop();
  expect(generate).toHaveBeenCalledTimes(attempts);
  const waiting = await budget.read();
  await due(); await worker.run();
  expect((await status()).report.aiReplay).toMatchObject({ selected: 23, paired: 0, selectionOffset: 25 });
  expect(await budget.read()).toEqual(waiting);
  await due(); await worker.run();
  expect((await status()).report.aiReplay).toMatchObject({ selected: 25,paired: 25,selectionOffset: 0 });
  expect((await readEvaluationHistory(database)).groups[0]).toMatchObject({ selected: 48,paired: 25, gaps: { cache_missing: 23 } });
  expect(await budget.read()).toMatchObject({ selection_offset: 25, revision: complete.revision + 1, published_fingerprint: null });
  await client.query('UPDATE adjudication_capture_budget SET next_check_at=now()');
  captureWorker = makeCapture(); expect((await captureWorker.run()).status).toBe('captured'); captureWorker.stop();
  expect((await budget.read()).selection_offset).toBe(25);
  await due(); await worker.run();
  expect((await status()).report.aiReplay).toMatchObject({ selected: 23,selectionOffset: 25 });
});

// Seed exact synthetic responses directly; no provider client or capture permission is involved.
async function fillCurrentWindow(response = '{"decision":"ABSTAIN","library_number":null}', sweep = false) {
  const original = await repository.readSnapshot(), state = await repository.readState();
  const snapshot = sweep ? selectSourcePairSweepSnapshot(original, state) : original;
  const prepared = await runAutomaticSourcePairThread(snapshot, state, new AbortController().signal, { includePlan: true });
  expect(prepared.plan.length).toBeGreaterThan(0);
  await createCachedAdjudicationWriter(database)({ version: 'cached_adjudication.v1',
    configuration: snapshot.inputs.source.adjudicationConfig.fingerprint,
    identity: { model: 'test:latest', digest: 'a'.repeat(64), contextLength: 8192 },
    records: prepared.plan.map(request => ({ key: request.key, generated: { response,
      latencyMs: 5, promptTokens: 100, outputTokens: 10, outputLimitReached: false,
      contextLimitSuspected: false, inputTruncation: 'unknown' } })) });
}

test('300 movie/TV cases are surveyed over 12 bounded ticks despite early gaps, preserving unfinished capture across restart', async () => {
  fixture = sourcePairFixture(300);
  await client.query(`TRUNCATE media_server_items,inventory_description_vector_cache;
    UPDATE ai_provider_config SET ollama_model='test:latest';
    INSERT INTO library_policies(id,library_id,name,enabled,created_at,updated_at)
    SELECT id,id,'Synthetic policy',true,now()-interval '2 days',now()-interval '2 days' FROM libraries;
    INSERT INTO libraries VALUES(5,'Ignored audio','music',true)`);
  for (const row of fixture.rows) await client.query(`INSERT INTO media_server_items
    (library_id,media_server_id,external_id,media_type,tmdb_id,metadata,genres,studio,content_rating)
    VALUES($1,$2,$3,$4,$5,jsonb_build_object('overview',$6::text),$7::jsonb,$8,$9)`,
  [row.library_id,row.media_server_id,row.external_id,row.media_type,row.tmdb_id,row.overview,JSON.stringify(row.genres),row.studio,row.content_rating]);
  await client.query(`INSERT INTO media_server_items(library_id,media_server_id,external_id,media_type,metadata)
    VALUES(5,1,'music','music','{"overview":"Music is not evaluation content"}')`);
  const entries = [...fixture.vectors].map(([hash, vector]) => ({ hash, vector }));
  for (let offset = 0; offset < entries.length; offset += 8) await cache.write(identity, entries.slice(offset, offset + 8));
  const snapshot = await repository.readSnapshot();
  // Pin model provenance, not responses: the first window is still entirely missing.
  const batch = { version: 'cached_adjudication.v1', configuration: snapshot.inputs.source.adjudicationConfig.fingerprint,
    identity: { model: 'test:latest', digest: 'a'.repeat(64), contextLength: 8192 }, records: [] };
  await createCachedAdjudicationWriter(database)(batch);
  await client.query(`UPDATE adjudication_capture_budget SET progress_key=repeat('b',64),progress=$1::jsonb,
    captured_at=now(),expires_at=now()+interval '1 day'`, [JSON.stringify(batch)]);
  const captureBefore = (await client.query('SELECT * FROM adjudication_capture_budget')).rows;
  const itemsBefore = (await client.query('SELECT * FROM media_server_items ORDER BY id')).rows;
  const policiesBefore = (await client.query('SELECT * FROM library_policies ORDER BY id')).rows;
  for (let tick = 0; tick < 12; tick++) {
    if (tick === 1) await fillCurrentWindow(undefined, true);
    if (tick === 6) { worker.stop(); worker = makeWorker(); }
    if (tick) await due();
    expect(await worker.run()).toEqual({ status: 'evaluated' });
    const report = (await status()).report;
    expect(report).toMatchObject({ sampled: 300, coverage: { movie: 150, tv: 150 },
      aiReplay: { eligible: 300, selected: 25, selectionOffset: tick * 25, paired: tick === 1 ? 25 : 0,
        limits: { providerCalls: 0, routingWrites: 0, promotionAllowed: false } } });
    expect((await repository.readSnapshot()).inputs.source.adjudicationSelectionOffset).toBe(0);
    expect((await client.query('SELECT * FROM adjudication_capture_budget')).rows).toEqual(captureBefore);
  }
  expect((await repository.readSnapshot()).sweepCursor).toMatchObject({ revision: 12, selectionOffset: 0 });
  const summary = await readEvaluationHistory(database);
  expect(summary).toMatchObject({ windows: 12, revisions: 1, providerCalls: 0, routingWrites: 0,
    groups: [{ selected: 300, paired: 25, gaps: { cache_missing: 275 } }] });
  expect(summary.groups[0].moviePaired).toBeGreaterThan(0);
  expect(summary.groups[0].tvPaired).toBeGreaterThan(0);
  expect(JSON.stringify(summary)).not.toMatch(/PRIVATE|localhost|progress_key|evidence_revision/);
  expect((await client.query('SELECT * FROM media_server_items ORDER BY id')).rows).toEqual(itemsBefore);
  expect((await client.query('SELECT * FROM library_policies ORDER BY id')).rows).toEqual(policiesBefore);
});

test('disabled capture advances complete cached windows, resumes at missing evidence after restart and wraps safely', async () => {
  await client.query(`UPDATE ai_provider_config SET ollama_model='test:latest';
    INSERT INTO library_policies(id,library_id,name,enabled,created_at,updated_at)
    SELECT id,id,'Private policy',true,now()-interval '2 days',now()-interval '2 days' FROM libraries;
    INSERT INTO libraries VALUES(5,'Music','music',true);
    INSERT INTO media_server_items(library_id,media_server_id,external_id,media_type,metadata)
    VALUES(5,1,'music','music','{"overview":"Excluded music"}');
    DELETE FROM adjudication_capture_budget`);
  const dataBefore = (await client.query('SELECT * FROM media_server_items ORDER BY id')).rows;
  const policiesBefore = (await client.query('SELECT * FROM library_policies ORDER BY id')).rows;
  const budget = createAdjudicationBudgetRepository(database);
  await fillCurrentWindow(); await worker.run();
  expect((await status()).report.aiReplay).toMatchObject({ selected: 25, paired: 25, selectionOffset: 0 });
  expect(await budget.read()).toMatchObject({ revision: 1, selection_offset: 25, daily_calls: 0, calls_reserved: 0, status: 'disabled' });
  const first = await stored();
  expect(await worker.run()).toEqual({ status: 'cooldown' });
  worker.stop(); worker = makeWorker(); await due(); await worker.run();
  expect((await status()).report.aiReplay).toMatchObject({ selected: 23, paired: 0, selectionOffset: 25 });
  expect((await budget.read()).revision).toBe(1);
  // Invalid responses are retained as failures rather than retried until success.
  await fillCurrentWindow('not valid JSON'); await due(); await worker.run();
  expect((await status()).report.aiReplay).toMatchObject({ selectionOffset: 0, paired: 0 });
  expect((await budget.read()).revision).toBe(1);
  await due(); await worker.run();
  expect((await status()).report.aiReplay).toMatchObject({ selected: 23, paired: 0, selectionOffset: 25,
    baseline: { hits: 23, invalid: 23, misses: 0 }, sourceAware: { hits: 23, invalid: 23, misses: 0 } });
  expect(await budget.read()).toMatchObject({ revision: 2, selection_offset: 0, daily_calls: 0, calls_reserved: 0, tokens_reserved: 0 });
  expect((await stored()).cohort).toEqual(first.cohort);
  expect((await readEvaluationHistory(database)).groups[0]).toMatchObject({ selected: 48, paired: 25 });
  expect((await client.query('SELECT * FROM media_server_items ORDER BY id')).rows).toEqual(dataBefore);
  expect((await client.query('SELECT * FROM library_policies ORDER BY id')).rows).toEqual(policiesBefore);
});

test('cursor failure rolls back report and history; older publication cannot advance after a successful save', async () => {
  await client.query(`UPDATE ai_provider_config SET ollama_model='test:latest';
    INSERT INTO library_policies(id,library_id,name,enabled,created_at,updated_at)
    SELECT id,id,'Private policy',true,now()-interval '2 days',now()-interval '2 days' FROM libraries`);
  await fillCurrentWindow();
  const snapshot = await repository.readSnapshot(), signal = new AbortController().signal;
  const result = await createProgressingSourcePairEvaluation({ repository, evaluate: runAutomaticSourcePairThread })(snapshot, null, signal);
  expect(result.replayWindow).toEqual({ revision: 0, selectionOffset: 0, nextOffset: 25 });
  await client.query('ALTER TABLE adjudication_capture_budget ADD CONSTRAINT test_no_advance CHECK (selection_offset=0)');
  await expect(repository.save(result.fingerprint, result.report, snapshot.observedAt, signal, result)).rejects.toMatchObject({ code: '23514' });
  expect(await stored()).toBeUndefined();
  expect((await client.query('SELECT * FROM automatic_evaluation_history')).rows).toHaveLength(0);
  expect((await client.query('SELECT * FROM automatic_source_pair_sweep')).rows).toHaveLength(0);
  expect((await client.query('SELECT revision,selection_offset FROM adjudication_capture_budget')).rows[0]).toEqual({ revision: 0, selection_offset: 0 });
  await client.query('ALTER TABLE adjudication_capture_budget DROP CONSTRAINT test_no_advance');
  expect(await repository.save(result.fingerprint, result.report, snapshot.observedAt, signal, result)).toBe(true);
  expect((await client.query('SELECT revision,selection_offset FROM adjudication_capture_budget')).rows[0]).toEqual({ revision: 1, selection_offset: 25 });
  const before = (await client.query('SELECT * FROM automatic_evaluation_history')).rows;
  expect(await repository.save(result.fingerprint, result.report, snapshot.observedAt, signal, result)).toBe(true);
  expect((await client.query('SELECT * FROM automatic_evaluation_history')).rows).toEqual(before);
  expect((await client.query('SELECT revision FROM adjudication_capture_budget')).rows[0].revision).toBe(1);
  expect((await client.query('SELECT revision FROM automatic_source_pair_sweep')).rows[0].revision).toBe(1);
  const earlier = new Date(Date.parse(snapshot.observedAt) - 1).toISOString();
  expect(await repository.save(result.fingerprint, result.report, earlier, signal,
    { ...result, cohortCreatedAt: new Date(Date.parse(earlier) - 1000).toISOString() })).toBe(false);
  expect((await client.query('SELECT revision FROM adjudication_capture_budget')).rows[0].revision).toBe(1);
});

test('explicit bounded capture fills exact requests for the automatic worker and expires without model calls', async () => {
  await client.query(`UPDATE ai_provider_config SET ollama_model='test:latest';
    INSERT INTO library_policies(id,library_id,name,enabled,created_at,updated_at)
    SELECT id,id,'Private policy',true,now()-interval '2 days',now()-interval '2 days' FROM libraries`);
  const generate = jest.fn(async ({ onGenerationCall }) => { onGenerationCall(); return {
    response: '{"decision":"ABSTAIN","library_number":null}', latencyMs: 5, promptTokens: 100, outputTokens: 10,
    outputLimitReached: false, contextLimitSuspected: false, inputTruncation: 'unknown' }; });
  const result = await captureCachedAdjudication({ maxCalls: 3 }, { repository,
    readConfig: async () => (await client.query(FRESH_POLICY_CONFIG_SQL)).rows[0],
    createClient: () => ({ inspect: async () => ({ model: 'test:latest', digest: 'a'.repeat(64), contextLength: 8192 }), generate }),
    save: createCachedAdjudicationWriter(database), withAdmission: (callback, { signal }) => callback(signal) });
  expect(result).toMatchObject({ status: 'complete', calls: 3, stored: 3 });
  expect(await worker.run()).toEqual({ status: 'evaluated' });
  const warm = (await status()).report.aiReplay;
  expect(warm.baseline.hits + warm.sourceAware.hits).toBeGreaterThan(0);
  expect(warm.limits.providerCalls).toBe(0); expect(generate).toHaveBeenCalledTimes(3);
  await client.query("UPDATE cached_adjudication_batch SET captured_at=now()-interval '8 days',expires_at=now()-interval '1 day'");
  await due(); expect(await worker.run()).toEqual({ status: 'evaluated' });
  expect((await status()).report.aiReplay.baseline.hits).toBe(0);
  expect((await status()).report.aiReplay.selectionOffset).toBe(25);
  expect((await client.query('SELECT * FROM cached_adjudication_batch')).rows).toHaveLength(0);
  expect(generate).toHaveBeenCalledTimes(3);
});

test('policy drift starts a new survey scope without resetting capture ownership', async () => {
  await client.query(`UPDATE ai_provider_config SET ollama_model='test:latest';
    INSERT INTO library_policies(id,library_id,name,enabled,created_at,updated_at)
    SELECT id,id,'Private policy',true,now()-interval '2 days',now()-interval '2 days' FROM libraries`);
  await worker.run();
  const first = await repository.readSnapshot();
  expect(first.sweepCursor).toMatchObject({ revision: 1, selectionOffset: 25 });
  const captureBefore = (await client.query('SELECT * FROM adjudication_capture_budget')).rows;
  await client.query('UPDATE library_policies SET updated_at=now() WHERE id=1'); await due();
  await worker.run();
  const second = await repository.readSnapshot();
  expect((await status()).report.aiReplay.selectionOffset).toBe(0);
  expect(second.sweepCursor).toMatchObject({ revision: 2, selectionOffset: 25 });
  expect(second.sweepCursor.evidenceRevision).not.toBe(first.sweepCursor.evidenceRevision);
  expect((await client.query('SELECT * FROM adjudication_capture_budget')).rows).toEqual(captureBefore);
});

test('real worker automatically compares both media, persists private cohort, and resumes unchanged after restart', async () => {
  await client.query("INSERT INTO policy_feedback_evaluation VALUES(1,'movie',1,2,true,now(),true)");
  const before = (await client.query('SELECT * FROM media_server_items ORDER BY id')).rows;
  expect((await status()).status).toBe('never_run');
  expect(await worker.run()).toEqual({ status: 'evaluated' });
  expect(await status()).toMatchObject({ status: 'complete', report: { status: 'complete', sampled: 48,
    coverage: { movie: 24,tv: 24,sourceOnly: 24,tmdbLinked: 24 }, metrics: { correctionCases: 1 },
    policyReplay: { status: 'no_policies' } } });
  expect(JSON.stringify(await status())).not.toMatch(/PRIVATE|cohort_created_at|"cohort"|localhost/);
  expect(await worker.run()).toEqual({ status: 'cooldown' });
  await due(); const previous = await stored(); worker.stop(); worker=makeWorker();
  expect(await worker.run()).toEqual({ status: 'unchanged' });
  const next = await stored(); expect(next.evaluated_at).toEqual(previous.evaluated_at); expect(next.cohort).toEqual(previous.cohort);
  expect((await client.query('SELECT * FROM media_server_items ORDER BY id')).rows).toEqual(before);
});

test('real policy snapshot replays both arms, filters music, and regrades after policy edits without changing the cohort', async () => {
  await client.query(`INSERT INTO library_policies(id,library_id,name,enabled,created_at,updated_at)
    SELECT id,id,'Private policy',true,now()-interval '2 days',now()-interval '2 days' FROM libraries;
    INSERT INTO libraries VALUES(5,'Music','music',true);
    INSERT INTO library_policies(id,library_id,name,enabled) VALUES(5,5,'Music policy',true);
    INSERT INTO policy_feedback_evaluation VALUES(1,'movie',1,2,true,now()-interval '1 day',true)`);
  const policiesBefore = (await client.query('SELECT * FROM library_policies ORDER BY id')).rows;
  expect((await worker.run()).status).toBe('evaluated');
  const first = await stored();
  expect(first.report).toMatchObject({ version: 'automatic_source_pair.v3', policyReplay: { status: 'complete',
    eligibleLabels: 1, metrics: { cases: 48, paired: 48, labeledPairs: 1 },
    byMedia: { movie: { cases: 24 }, tv: { cases: 24 } } } });
  expect((await client.query('SELECT * FROM library_policies ORDER BY id')).rows).toEqual(policiesBefore);
  await due(); worker.stop(); worker=makeWorker();
  expect((await worker.run()).status).toBe('evaluated');
  expect((await status()).report.aiReplay.selectionOffset).toBe(25);
  await client.query('UPDATE library_policies SET updated_at=now() WHERE id=1'); await due();
  expect((await worker.run()).status).toBe('evaluated');
  const next = await stored(); expect(next.cohort).toEqual(first.cohort);
  expect(next.report.policyReplay.eligibleLabels).toBe(0);
  await client.query(`UPDATE automatic_source_pair_evaluation SET report=jsonb_set(report,'{policyReplay,limits,promotionAllowed}','true')`);
  expect(await status()).toMatchObject({ status: 'invalid', report: null });
});

test('oversized policy population fails closed with bounded retry and recovers after removal', async () => {
  await client.query(`INSERT INTO library_policies(id,library_id,name,enabled)
    SELECT n,1,'Synthetic policy',true FROM generate_series(1,65) n`);
  expect(await worker.run()).toEqual({ status: 'failed', reason: 'evidence_budget' });
  expect(await status()).toMatchObject({ status: 'failed', report: null, failure_code: 'evidence_budget' });
  await client.query('DELETE FROM library_policies'); await due();
  expect((await worker.run()).status).toBe('evaluated');
});

test('cache miss self-heals and vector/config/feedback/source changes invalidate the result', async () => {
  const [hash, vector] = [...fixture.vectors][0];
  await client.query('DELETE FROM inventory_description_vector_cache WHERE description_hash=$1',[hash]);
  await worker.run(); expect((await status()).report).toMatchObject({ status: 'cache_incomplete',metrics: null });
  const cohort=(await stored()).cohort;
  await cache.write(identity,[{hash,vector}]); await due(); await worker.run();
  expect((await status()).report.status).toBe('complete'); expect((await stored()).cohort).toEqual(cohort);
  await client.query("INSERT INTO policy_feedback_evaluation VALUES(1,'movie',1,2,true,now(),true)");
  await due(); expect((await worker.run()).status).toBe('evaluated');
  expect((await status()).report.metrics.correctionCases).toBe(1);
  await client.query("UPDATE media_server_items SET metadata='{}' WHERE id=1");
  await due(); await worker.run(); expect((await status()).report.cohortReason).toBe('source_changed');
});

test.each(['stale','future','changed','absent'])('representation %s defers without a provider call and later recovers', async kind => {
  if (kind==='stale') await client.query("UPDATE inventory_description_representation_checkpoint SET verified_at=now()-interval '11 minutes'");
  if (kind==='future') await client.query("UPDATE inventory_description_representation_checkpoint SET verified_at=now()+interval '1 day'");
  if (kind==='changed') await client.query("UPDATE ai_provider_config SET embedding_model='other'");
  if (kind==='absent') await client.query('DELETE FROM inventory_description_representation_checkpoint');
  expect(await worker.run()).toEqual({ status: 'deferred',reason: 'representation_unavailable' });
  expect((await status()).report).toBeNull();
  await client.query("UPDATE ai_provider_config SET embedding_model='test'");
  await recordDescriptionRepresentation(client,identity,JSON.stringify(resolveLocalStudyEmbeddingConfig(fixture.config)));
  await due(); expect((await makeWorker().run()).status).toBe('evaluated');
});

test.each(['busy','disabled','unsupported_provider'])('readiness %s is persisted, backs off and clears old scores', async reason => {
  await worker.run(); await due();
  if(reason==='busy') await client.query("INSERT INTO task_queue VALUES('processing',now())");
  if(reason==='disabled') await client.query('UPDATE ai_provider_config SET rag_enabled=false');
  if(reason==='unsupported_provider') await client.query("UPDATE ai_provider_config SET primary_provider='cloud'");
  expect(await worker.run()).toEqual({ status: 'deferred',reason });
  const first=await stored(); expect(first.report).toBeNull(); expect(first.failure_count).toBe(1);
  expect(first.next_check_at.getTime()-first.observed_at.getTime()).toBe(300000);
  await due(); await makeWorker().run(); const second=await stored();
  expect(second.next_check_at.getTime()-second.observed_at.getTime()).toBe(600000);
});

test('music/conflicts/inactive libraries stay out; stale or malformed stored reports are withheld', async () => {
  await client.query("INSERT INTO libraries VALUES(5,'Music','music',true),(6,'Inactive','movie',false)");
  await client.query(`INSERT INTO media_server_items(library_id,media_server_id,external_id,media_type,tmdb_id,metadata)
    VALUES(5,1,'music','music',99,'{"overview":"Music"}'),(6,1,'inactive','movie',98,'{"overview":"Inactive"}');
    INSERT INTO media_source_observations VALUES(1,1,'PRIVATE-source-4',now())`);
  await worker.run(); expect((await status()).report.sampled).toBe(47);
  await client.query("UPDATE automatic_source_pair_evaluation SET observed_at=now()-interval '16 minutes',evaluated_at=now()-interval '16 minutes'");
  expect(await status()).toMatchObject({status:'stale',report:null});
  await due(); await worker.run();
  await client.query(`UPDATE automatic_source_pair_evaluation SET report=report||'{"secret":"PRIVATE"}'`);
  expect(await status()).toMatchObject({status:'invalid',report:null});
  await due(); await worker.run(); expect((await status()).status).toBe('complete');
});

test('database-wide lock prevents overlapping replicas and owner disconnect allows recovery', async () => {
  const holder=await getPool().connect();
  try {
    await holder.query('SELECT pg_advisory_lock($1)',[AUTOMATIC_SOURCE_PAIR_LOCK]);
    expect(await worker.run()).toEqual({status:'busy'}); expect((await status()).status).toBe('never_run');
  } finally { holder.release(true); }
  expect((await worker.run()).status).toBe('evaluated');
});

test('publication protects newer snapshots, schema rejects unbounded reports and failures expire old cohort references', async () => {
  await worker.run(); const row=await stored();
  expect(await repository.save(row.input_fingerprint,row.report,new Date(row.observed_at.getTime()-1).toISOString(),undefined,
    {cohort:row.cohort,cohortCreatedAt:new Date(row.cohort_created_at.getTime()-1000).toISOString()})).toBe(false);
  await expect(client.query("UPDATE automatic_source_pair_evaluation SET report=jsonb_build_object('payload',repeat('x',20000))")).rejects.toThrow();
  await client.query("UPDATE automatic_source_pair_evaluation SET cohort_created_at=now()-interval '31 days'");
  await repository.fail('disabled'); expect((await stored()).cohort).toBeNull();
});

test('failure checkpoint is queryable even when the first snapshot was unavailable', async () => {
  await repository.fail('representation_unavailable');
  expect(await status()).toMatchObject({status:'failed',failure_code:'representation_unavailable',report:null});
});

test('real private CLI returns only the persisted aggregate and never starts an evaluation', async () => {
  await worker.run();
  // This suite owns an isolated test database. Only the aggregate needs to be visible to the child process.
  await client.query('INSERT INTO public.automatic_source_pair_evaluation SELECT * FROM pg_temp.automatic_source_pair_evaluation');
  try {
    const options=getPool().options;
    const {stdout,stderr}=await promisify(execFile)(process.execPath,
      [fileURLToPath(new URL('../../scripts/runOperatorCorrectionPolicyEvaluation.mjs',import.meta.url)),'--automatic-source-pair-status'], {
        timeout:30000,env:{...process.env,POSTGRES_HOST:options.host,POSTGRES_PORT:String(options.port),POSTGRES_DB:options.database,
          POSTGRES_USER:options.user,POSTGRES_PASSWORD:options.password},
      });
    expect(JSON.parse(stdout)).toMatchObject({status:'complete',report:{sampled:48},providerCalls:0,routingWrites:0});
    expect(stdout).not.toMatch(/PRIVATE|"cohort"|localhost/); expect(stderr).toBe('');
  } finally { await client.query('DELETE FROM public.automatic_source_pair_evaluation WHERE singleton=true'); }
});
