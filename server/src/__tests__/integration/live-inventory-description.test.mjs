/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createLiveInventoryDescriptionRepository } from '../../services/liveInventoryDescriptionRepository.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { createDescriptionBenchmarkRepository } from '../../services/inventoryDescriptionBenchmarkRepository.mjs';
import { prepareDescriptionBenchmark } from '../../services/inventoryDescriptionBenchmarkSample.mjs';
import { createPolicyCandidateShortlistService } from '../../services/policyCandidateShortlistService.mjs';
import { createPolicyInventoryEvidenceService } from '../../services/policyInventoryEvidenceService.mjs';
import { projectRankedPolicyCandidates } from '../../services/policyCandidateRankingProjection.mjs';
import { selectContrastiveLibraryExamples } from '../../services/inventoryContrastiveExamples.mjs';
import { runContentFirstInventoryComparison } from '../../services/inventoryContentFirstComparison.mjs';
import { learnedRoutingFixture, learnedRoutingDependencies } from '../fixtures/learnedEvidenceRoutingFixture.mjs';
import { createLearnedEvidenceRoutingService } from '../../services/learnedEvidenceRoutingService.mjs';
import { projectLiveInventoryDescriptionEvidence } from '../../services/liveInventoryDescriptionEvidence.mjs';
import { buildPolicyCandidateAdjudicationContract } from '../../services/policyCandidateAdjudicationContract.mjs';
import { finalizePolicyCandidateAdjudication } from '../../services/policyCandidateAdjudicationResult.mjs';
import { hasCandidateConsensusReceipt } from '../../services/policyCandidateConsensusReceipt.mjs';
import { evaluateClassificationRouteSafety } from '../../services/classificationRouteSafetyGate.mjs';
import { createLiveInventoryModelCache } from '../../services/liveInventoryModelCache.mjs';
import { buildInventoryDescriptionCorpusSql, prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL } from '../../services/liveInventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../../services/sourceConflictAuthorityGuard.mjs';
import { buildLiveInventoryLearnedProfiles } from '../../services/liveInventoryLearnedProfile.mjs';
import { assessLiveLibraryMatch } from '../../services/liveLibraryMatchBaseline.mjs';

let client;
let repository;
let cache;
let profileCache;
let baselineCache;
const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
const hash = text => createHash('sha256').update(text).digest('hex');
const request = { key: 'movie:90', mediaType: 'movie', libraryIds: [10, 20], hash: hash('Query') };
beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`
    CREATE TEMP TABLE libraries (id integer, media_type text, is_active boolean);
    CREATE TEMP TABLE classification_history (id integer, tmdb_id integer, media_type text, metadata jsonb, created_at timestamptz);
    CREATE TEMP TABLE media_server_items (id serial, tmdb_id integer, media_type text, library_id integer,
      media_server_id integer DEFAULT 1, external_id text, metadata jsonb, genres jsonb, studio text, content_rating text);
    CREATE TEMP TABLE media_source_observations (library_id integer, media_server_id integer, external_id text, last_seen_at timestamptz);
    CREATE TEMP TABLE inventory_description_vector_cache (LIKE public.inventory_description_vector_cache INCLUDING ALL);
    INSERT INTO libraries VALUES (10,'movie',true), (20,'movie',true), (30,'movie',false), (40,'tv',true);
  `);
  const profiles = createLiveInventoryModelCache(), baselines = createLiveInventoryModelCache();
  profileCache = { get: jest.fn(profiles.get), set: jest.fn(profiles.set) };
  baselineCache = { get: jest.fn(baselines.get), set: jest.fn(baselines.set) };
  repository = createLiveInventoryDescriptionRepository({ profileCache, baselineCache, withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
  cache = createInventoryDescriptionVectorCache({ query: client.query.bind(client) });
});
afterEach(() => { client?.release(true); client = null; });

async function add(id, library, text, vector = [1, 0, 0], media = 'movie') {
  await client.query(`INSERT INTO media_server_items (tmdb_id,library_id,media_type,external_id,metadata)
    VALUES ($1::integer,$2,$3,$1::integer::text,$4::jsonb)`, [id, library, media, JSON.stringify({ overview: text })]);
  if (vector) await cache.write(identity, [{ hash: hash(text), vector }]);
}
const retrieve = (representation = identity) => repository.retrieve({ request, identity: representation, vector: [1, 0, 0] });

test('SQL-scoped TV evidence equals global-corpus evidence and retains exclusions across all same-media libraries', async () => {
  await client.query("INSERT INTO libraries VALUES (50,'tv',true),(60,'tv',true)");
  for (let id = 1; id <= 80; id++) {
    const vector = [Math.cos(id / 100), Math.sin(id / 100), 0];
    await add(id, 40, `Shared across media ${id}`, vector, 'tv');
    await add(id, 10, `Shared across media ${id}`, vector);
  }
  await add(1001, 60, 'Shared across media 1', null, 'tv');
  await add(90, 40, 'Shared across media 2', null, 'tv');
  await add(20, 60, 'Conflicting TV description', null, 'tv');
  await add(1002, 50, 'Rival TV description', [0, 1, 0], 'tv');
  await client.query("INSERT INTO media_source_observations VALUES (40,1,'3',now())");
  await client.query(`UPDATE media_server_items SET genres=CASE WHEN library_id=40 THEN '["Documentary"]'::jsonb ELSE '["Comedy"]'::jsonb END`);
  const input = { ...request, key: 'tv:90', mediaType: 'tv', libraryIds: [40, 50], matchLibraryId: 40,
    queryMetadata: { genres: ['documentary'] } };
  const queryVector = [Math.cos(.4), Math.sin(.4), 0];
  const all = (await client.query(buildInventoryDescriptionCorpusSql({ includeCandidateMetadata: true }), [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS])).rows;
  const scoped = (await client.query(LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, 'tv'])).rows;
  expect(scoped).toEqual(all.filter(row => row.media_type === 'tv'));
  expect(all.some(row => row.media_type === 'movie')).toBe(true);
  expect(scoped.some(row => row.library_id === 60)).toBe(true);
  expect(scoped.some(row => row.library_id === 40 && row.tmdb_id === 3)).toBe(false);
  const corpus = prepareInventoryDescriptionCorpus(all);
  const globalProfiles = buildLiveInventoryLearnedProfiles({ rows: all, corpus, request: input });
  const globalBaseline = await assessLiveLibraryMatch({ rows: all, corpus, request: input, identity, vector: queryVector,
    query: client.query.bind(client) });
  const result = await repository.retrieve({ request: input, identity, vector: queryVector });
  expect(result[0].learnedProfile).toEqual(globalProfiles.get(40));
  expect(result[0].matchBaseline).toEqual(globalBaseline);
  expect(result[0].matchBaseline.sharedDescriptionsExcluded).toBe(1);
  expect(result[0].items.every(item => !['Shared across media 2', 'Shared across media 3', 'Shared across media 20'].includes(item.description))).toBe(true);
  expect(await repository.retrieve({ request: input, identity, vector: queryVector })).toEqual(result);
});

test('unrelated-media corpus overflow no longer blocks a bounded live movie request', async () => {
  await add(1, 10, 'Movie evidence');
  await add(2, 20, 'Other movie evidence', [0, 1, 0]);
  await client.query(`INSERT INTO media_server_items (tmdb_id,library_id,media_type,external_id,metadata)
    SELECT id,40,'tv',id::text,jsonb_build_object('overview','TV synopsis ' || id) FROM generate_series(1,10001) id`);
  const global = (await client.query(buildInventoryDescriptionCorpusSql(), [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS])).rows;
  expect(() => prepareInventoryDescriptionCorpus(global)).toThrow('document_limit_exceeded');
  expect((await retrieve()).map(candidate => candidate.eligible)).toEqual([1, 1]);
  await expect(repository.readLearnedProfiles({ request: { ...request, key: 'tv:90', mediaType: 'tv', libraryIds: [40] } }))
    .rejects.toThrow('document_limit_exceeded');
});

test('fresh database descriptions and learned baseline resolve soft review; subsequent membership drift keeps review', async () => {
  await client.query('UPDATE libraries SET id=1 WHERE id=10; UPDATE libraries SET id=2 WHERE id=20');
  for (let id = 1; id <= 160; id++) {
    const angle = id <= 80 ? 2 + id / 100 : (id - 80) / 100;
    await add(id, id <= 80 ? 1 : 2, `Distinct synthetic synopsis ${id}`, [Math.cos(angle), Math.sin(angle), 0]);
  }
  await client.query(`UPDATE media_server_items SET genres=CASE WHEN library_id=2 THEN '["Documentary"]'::jsonb ELSE '["Comedy"]'::jsonb END`);
  const input = learnedRoutingFixture();
  input.metadata.tmdb_id = 9999;
  input.libraries = input.libraries.slice(0, 2);
  input.policies = input.policies.slice(0, 2);
  input.policyResult.ranked = input.policyResult.ranked.slice(0, 2);
  input.contract = buildPolicyCandidateAdjudicationContract({ ...input, mediaType: 'movie' });
  const liveRequest = { key: 'movie:9999', hash: hash(input.metadata.overview), mediaType: 'movie',
    libraryIds: [1, 2], queryMetadata: { genres: ['documentary'] } };
  const queryVector = [Math.cos(.4), Math.sin(.4), 0];
  const read = async matchLibraryId => ({ statusId: 'available', candidates: await repository.retrieve({
    request: { ...liveRequest, ...(matchLibraryId === undefined ? {} : { matchLibraryId }) }, identity, vector: queryVector,
  }) });
  const supplied = await read();
  input.evidence.candidates = supplied.candidates.map(candidate => ({ libraryId: candidate.libraryId,
    mediaType: 'movie', currentLibrary: { directMatch: false },
    descriptionEvidence: projectLiveInventoryDescriptionEvidence({ ...candidate, statusId: supplied.statusId }, true) }));
  input.result = finalizePolicyCandidateAdjudication(input);
  const dependencies = { ...learnedRoutingDependencies(input), retriever: { retrieve: options => read(options.matchLibraryId) } };
  const service = createLearnedEvidenceRoutingService(dependencies);
  const result = await service.resolve({ ...input, learnedContext: await service.prepare(input) });
  expect(hasCandidateConsensusReceipt(result, { metadata: input.metadata })).toBe(true);
  expect(result.confidence).toBe(45);
  expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(true);
  const profileFits = profileCache.set.mock.calls.length;
  expect(baselineCache.set).toHaveBeenCalledTimes(1);
  const warm = await service.resolve({ ...input, learnedContext: await service.prepare(input) });
  expect(hasCandidateConsensusReceipt(warm, { metadata: input.metadata })).toBe(true);
  expect(warm.confidence).toBe(result.confidence);
  expect(profileCache.set).toHaveBeenCalledTimes(profileFits);
  expect(baselineCache.set).toHaveBeenCalledTimes(1);
  await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days'");
  expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
  expect(baselineCache.set).toHaveBeenCalledTimes(1);
  await client.query('UPDATE inventory_description_vector_cache SET created_at=now()');
  const changed = createLearnedEvidenceRoutingService({ ...dependencies, readPolicy: async () => {
    await client.query('UPDATE media_server_items SET library_id=1 WHERE tmdb_id=81');
    return input.policyResult;
  } });
  expect(await changed.resolve({ ...input, learnedContext: await changed.prepare(input) })).toBe(input.result);
  expect((await client.query('SELECT count(*)::integer AS count FROM inventory_description_vector_cache')).rows[0].count).toBe(160);
  expect((await client.query('SELECT count(*)::integer AS count FROM classification_history')).rows[0].count).toBe(0);
});

test('cached baseline refreshes for real vector rewrites and refuses deleted vectors or inactive libraries', async () => {
  for (let id = 1; id <= 80; id++) await add(id, 10, `Baseline ${id}`, [Math.cos(id / 100), Math.sin(id / 100), 0]);
  const run = () => repository.retrieve({ request: { ...request, matchLibraryId: 10 }, identity,
    vector: [Math.cos(.4), Math.sin(.4), 0] });
  const first = (await run())[0].matchBaseline;
  expect(first.status).toBe('familiar');
  expect((await run())[0].matchBaseline).toEqual(first);
  expect(baselineCache.set).toHaveBeenCalledTimes(1);
  await client.query("UPDATE inventory_description_vector_cache SET embedding='[1,0,0]'::vector WHERE description_hash=$1", [hash('Baseline 1')]);
  const edited = (await run())[0].matchBaseline;
  expect(edited.snapshotId).not.toBe(first.snapshotId);
  expect(baselineCache.set).toHaveBeenCalledTimes(2);
  await client.query('DELETE FROM inventory_description_vector_cache WHERE description_hash=$1', [hash('Baseline 1')]);
  expect((await run())[0].matchBaseline.status).toBe('incomplete');
  expect(baselineCache.set).toHaveBeenCalledTimes(2);
  await client.query('UPDATE libraries SET is_active=false WHERE id=10');
  expect((await run())[0].matchBaseline.status).toBe('sparse');
});

test('current PostgreSQL description/metadata evidence restores a weak score and loses support after edits', async () => {
  for (let id = 1; id <= 24; id++) {
    await add(id, id <= 12 ? 10 : 20, `Distinct evidence ${id}`, id <= 12 ? [1, .1, 0] : [0, 1, 0]);
  }
  await client.query(`UPDATE media_server_items SET genres=CASE WHEN library_id=10 THEN '["Documentary"]'::jsonb ELSE '["Comedy"]'::jsonb END`);
  const policies = [10, 20].map(id => ({ id, library_id: id, library_media_type: 'movie', enabled: true, trust_rag: true }));
  const evaluations = policies.map(policy => ({ policy_id: policy.id, library_id: policy.library_id, score: 75,
    candidate_diagnostics: { primary_viability: 'compatibility_only', evidence_class: 'compatibility_only',
      primary_anchor_eligible: false, suppression_reasons: ['weak_primary_evidence'] } }));
  const service = createPolicyInventoryEvidenceService({ retriever: { retrieve: async ({ contract }) => ({
    statusId: 'available', candidates: await repository.retrieve({ identity, vector: [1, 0, 0],
      request: { ...request, libraryIds: contract.candidates.map(candidate => candidate.libraryId), queryMetadata: { genres: ['documentary'] } } }),
  }) } });
  const input = { evaluations, policies, item: { media_type: 'movie', tmdb_id: 90, overview: 'Query' } };
  expect(projectRankedPolicyCandidates(await service.apply(input))[0]).toMatchObject({ library_id: 10, score: 75 });
  await client.query(`UPDATE media_server_items SET genres='["Comedy"]'::jsonb WHERE library_id=10`);
  expect(projectRankedPolicyCandidates(await service.apply(input))[0].score).toBe(45);
  expect((await client.query('SELECT count(*)::integer AS count FROM inventory_description_vector_cache')).rows[0].count).toBe(24);
});

test('real cosine ranking compares all candidates, excludes self and duplicates, and bounds each candidate', async () => {
  await add(90, 10, 'Query');
  await add(90, 20, 'Query');
  await add(91, 10, 'Query');
  await add(1, 10, 'Shared');
  await add(2, 10, 'Shared');
  await add(1, 20, 'Shared');
  await add(3, 10, 'Voyage', [1, 1, 0]);
  await add(4, 10, 'Far', [0, 1, 0]);
  await add(5, 10, 'Opposite', [-1, 0, 0]);
  await add(6, 20, 'Comedy', [1, 0.5, 0]);
  const timeoutBefore = (await client.query('SHOW statement_timeout')).rows[0];
  const result = await retrieve();
  expect(result.map(candidate => [candidate.eligible, candidate.indexed, candidate.items.length])).toEqual([[4, 4, 3], [2, 2, 2]]);
  expect(result[0].items.map(item => item.description)).toEqual(['Shared', 'Voyage', 'Far']);
  expect(result[0].items[1].similarity).toBeCloseTo(Math.SQRT1_2);
  expect(result[0].items[0].sharedAcrossCandidates).toBe(true);
  expect(JSON.stringify(result)).not.toContain('Query');
  expect((await client.query('SHOW statement_timeout')).rows[0]).toEqual(timeoutBefore);
  expect(await repository.readQueryVector(identity, hash('Query'))).toEqual([1, 0, 0]);
});

test('current membership, conflict, text, representation and expiry boundaries control retrieval', async () => {
  await add(1, 10, 'Current');
  await add(2, 20, 'Missing', null);
  await add(3, 30, 'Inactive');
  await add(4, 10, 'Wrong media', [1, 0, 0], 'tv');
  await add(5, 40, 'TV', [1, 0, 0], 'tv');
  await add(6, 10, 'Conflict A');
  await add(6, 20, 'Conflict B');
  await add(7, 10, 'Source conflict');
  await client.query("INSERT INTO media_source_observations VALUES (10,1,'7',now())");
  const result = await retrieve();
  expect(result.map(candidate => [candidate.eligible, candidate.indexed])).toEqual([[1, 1], [1, 0]]);
  expect(result[0].items[0].description).toBe('Current');
  expect((await retrieve({ ...identity, digest: 'b'.repeat(64) }))[0].indexed).toBe(0);
  await expect(retrieve({ ...identity, dimensions: 2 })).rejects.toThrow();
});

test('deleted, edited and expired inventory cannot reuse old description evidence', async () => {
  await add(1, 10, 'Old');
  await add(2, 20, 'Expired');
  await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days' WHERE description_hash=$1", [hash('Expired')]);
  await client.query("UPDATE media_server_items SET metadata='{}' WHERE tmdb_id=1");
  expect((await retrieve()).map(candidate => [candidate.eligible, candidate.indexed])).toEqual([[0, 0], [1, 0]]);
  await client.query('UPDATE media_server_items SET metadata=$1::jsonb WHERE tmdb_id=1', [JSON.stringify({ overview: 'Changed' })]);
  expect((await retrieve())[0]).toMatchObject({ eligible: 1, indexed: 0, items: [] });
  await client.query('DELETE FROM media_server_items WHERE tmdb_id=2');
  expect((await retrieve())[1]).toMatchObject({ eligible: 0, indexed: 0, items: [] });
});

test('live learned evidence refreshes from current same-snapshot metadata and membership without writes', async () => {
  for (let id = 1; id <= 6; id++) await add(id, id <= 3 ? 10 : 20, `Training ${id}`);
  await add(90, 10, 'Old query synopsis');
  await add(91, 20, 'Old query synopsis');
  await add(92, 20, 'Query');
  await add(93, 30, 'Inactive evidence');
  await add(94, 10, 'Source-conflicted evidence');
  await client.query("INSERT INTO media_source_observations VALUES (10,1,'94',now())");
  await client.query(`UPDATE media_server_items SET genres=CASE WHEN tmdb_id <= 3 THEN '["Documentary"]'::jsonb ELSE '["Comedy"]'::jsonb END`);
  const run = () => repository.retrieve({ request: { ...request, queryMetadata: { genres: ['documentary'] } }, identity, vector: [1, 0, 0] });
  const before = await run();
  expect(before.flatMap(candidate => candidate.items).every(item => item.description.startsWith('Training '))).toBe(true);
  expect(before[0].learnedProfile.trainingDescriptions).toBe(6);
  expect(before[0].learnedProfile.relativeFit).toBeGreaterThan(0);
  expect(before[1].learnedProfile.relativeFit).toBeLessThan(0);
  expect((await run())[0].learnedProfile).toEqual(before[0].learnedProfile);
  await client.query(`UPDATE media_server_items SET genres='["Comedy"]'::jsonb WHERE tmdb_id <= 3`);
  const edited = await run();
  expect(edited[0].learnedProfile.relativeFit).toBe(0);
  expect(edited[0].learnedProfile.snapshotId).not.toBe(before[0].learnedProfile.snapshotId);
  await client.query('UPDATE media_server_items SET library_id=20 WHERE tmdb_id=1');
  const moved = await run();
  expect(moved[0].learnedProfile.snapshotId).not.toBe(edited[0].learnedProfile.snapshotId);
  await client.query('DELETE FROM media_server_items WHERE tmdb_id=2');
  expect((await run())[0].learnedProfile.trainingDescriptions).toBe(5);
  await client.query('UPDATE libraries SET is_active=false WHERE id=20');
  expect((await run())[0].learnedProfile.trainingDescriptions).toBe(1);
  expect((await client.query('SELECT count(*)::integer AS count FROM inventory_description_vector_cache')).rows[0].count).toBe(10);
});

test('benchmark snapshots real inventory and cache read-only, holds out 100 titles, and fails on stale provenance', async () => {
  await client.query("ALTER TABLE libraries ADD COLUMN name text DEFAULT 'Private library'");
  const benchmark = createDescriptionBenchmarkRepository({ withTransaction: async callback => {
    await client.query('BEGIN');
    try {
      const result = await callback(client);
      expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
  for (let index = 1; index <= 120; index++) await add(index, index % 2 ? 10 : 20, `Synopsis ${index}`);
  await client.query('UPDATE media_server_items SET genres=$1::jsonb, studio=$2, content_rating=$3 WHERE tmdb_id=1',
    [JSON.stringify(['Animation']), 'Private Studio', 'PG']);
  const before = (await client.query('SELECT count(*)::integer AS count FROM inventory_description_vector_cache')).rows[0].count;
  const snapshot = await benchmark.read(identity);
  expect(snapshot.corpus.documents).toHaveLength(120);
  expect(snapshot.candidateMetadata.get('movie:1')).toEqual({ genres: ['animation'], studio: 'private studio', rating: 'pg' });
  expect(snapshot.libraries.map(library => library.id)).toEqual([10, 20, 40]);
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 3, { seed: 'benchmark-test-seed-2026' });
  expect(prepared.cases).toHaveLength(100);
  expect(prepared.cases.every(entry => entry.candidates.reduce((sum, candidate) => sum + candidate.eligible, 0) === 20)).toBe(true);
  const grouped = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 3,
    { seed: 'benchmark-test-seed-2026', size: 100, folds: 5 },
    { learnedProfiles: true, includeContrastiveVectors: true, includeComparisonEvidence: true, includeConflictEvidence: true });
  expect(grouped.cases).toHaveLength(100);
  expect(grouped.evaluation.foldSizes).toEqual([20, 20, 20, 20, 20]);
  expect(grouped.evaluation.libraryCoverage.slice(0, 2).every(row => row.minimumTrainingDescriptions === 50)).toBe(true);
  expect(grouped.cases.every(entry => entry.candidates.reduce((sum, candidate) => sum + candidate.eligible, 0) === 100)).toBe(true);
  expect(grouped.cases.every(entry => entry.candidates.every(candidate => candidate.items.every(item => item.hash !== hash(entry.overview))))).toBe(true);
  const contrastive = selectContrastiveLibraryExamples(grouped.cases[0], grouped.vectors);
  expect(contrastive.status).toBe('available');
  expect(contrastive.candidates.every(candidate => candidate.items.every(item => !grouped.cases[0].heldDescriptionHashes.has(item.hash)))).toBe(true);
  const compared = await runContentFirstInventoryComparison(grouped,
    { seed: 'benchmark-test-seed-2026', size: 100, folds: 5, generateCases: 2 },
    { client: { generate: async () => ({ response: '{"candidate":1}' }) } });
  expect(compared).toMatchObject({ status: 'complete', calls: 4, paired: { validPairs: 2 },
    snapshotComponents: { counts: { documents: 120, vectors: 120 } } });
  const selective = await runContentFirstInventoryComparison(grouped,
    { seed: 'benchmark-test-seed-2026', size: 100, folds: 5, generateCases: 2 },
    { selectiveRecheck: true, client: { generate: async () => ({ response: '{"candidate":1}' }) } });
  expect(selective).toMatchObject({ status: 'complete', calls: 2, selection: { triggered: 0, validPairs: 2 } });
  expect((await client.query('SELECT count(*)::integer AS count FROM inventory_description_vector_cache')).rows[0].count).toBe(before);
  await expect(benchmark.read({ ...identity, digest: 'b'.repeat(64) })).rejects.toThrow('cache_incomplete');
  await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days'");
  await expect(benchmark.read(identity)).rejects.toThrow('cache_incomplete');
});

test('real learned profiles recover the fourth eligible library before the live comparison cutoff', async () => {
  await client.query("INSERT INTO libraries VALUES (50,'movie',true),(60,'movie',true)");
  for (let id = 1; id <= 8; id++) {
    await add(id, [10, 20, 50, 60][Math.floor((id - 1) / 2)], `Distinct training ${id}`);
  }
  await client.query(`UPDATE media_server_items SET genres=CASE WHEN library_id=60 THEN '["Documentary"]'::jsonb ELSE '["Comedy"]'::jsonb END`);
  const service = createPolicyCandidateShortlistService({ repository: { ...repository, readConfig: async () => ({ rag_enabled: true }) } });
  const available = [10, 20, 50, 60].map(id => ({ id, name: `Arbitrary ${id}`, media_type: 'movie', is_active: true }));
  const policyResult = { action: 'manual', confidence: 45, ranked: available.map(library => ({ library_id: library.id, score: 45 })) };
  const input = { policyResult, libraries: available, metadata: { tmdb_id: 90, media_type: 'movie', overview: 'Query', genres: ['Documentary'] } };
  expect((await service.build(input)).candidates.map(candidate => candidate.libraryId)).toEqual([10, 60, 20]);
  expect((await service.build({ ...input, policyResult: { ...policyResult, ranked: policyResult.ranked.slice(0, 3) } })).candidates.map(candidate => candidate.libraryId))
    .toEqual([10, 20, 50]);
  await client.query(`UPDATE media_server_items SET genres='["Comedy"]'::jsonb WHERE library_id=60`);
  expect((await service.build(input)).candidates.map(candidate => candidate.libraryId)).toEqual([10, 20, 50]);
  expect((await client.query('SELECT count(*)::integer AS count FROM inventory_description_vector_cache')).rows[0].count).toBe(8);
});

test('live shortlist uses current PostgreSQL descriptions to preserve a metadata-disfavored library without routing or cache writes', async () => {
  await client.query("INSERT INTO libraries VALUES (50,'movie',true),(60,'movie',true)");
  const available = [10, 20, 50, 60].map(id => ({ id, name: `Arbitrary ${id}`, media_type: 'movie', is_active: true }));
  for (let id = 1; id <= 24; id++) {
    const library = available[Math.floor((id - 1) / 6)].id;
    await add(id, library, `Distinct candidate evidence ${id}`, library === 60 ? [1, .1, 0] : [0, 1, 0]);
  }
  await client.query(`UPDATE media_server_items SET genres=CASE WHEN library_id=20 THEN '["Comedy"]'::jsonb ELSE '["Documentary"]'::jsonb END`);
  const scopedRepository = { ...repository, readConfig: async () => ({ rag_enabled: true }) };
  const retriever = { retrieve: async ({ contract, metadata, signal }) => ({ statusId: 'available',
    candidates: await repository.retrieve({ identity, vector: [1, 0, 0], signal,
      request: { key: 'movie:90', hash: hash('Query'), mediaType: metadata.media_type,
        libraryIds: contract.candidates.map(candidate => candidate.libraryId), queryMetadata: { genres: ['comedy'], studio: '', rating: '' } } }) }) };
  const service = createPolicyCandidateShortlistService({ repository: scopedRepository, retriever });
  const policyResult = { action: 'manual', confidence: 45, ranked: available.map(library => ({ library_id: library.id, score: 45 })) };
  const input = { policyResult, libraries: available, metadata: { tmdb_id: 90, media_type: 'movie', overview: 'Query', genres: ['Comedy'] } };
  const before = structuredClone(policyResult);
  expect((await service.build(input)).candidates.map(candidate => candidate.libraryId)).toEqual([10, 20, 60]);
  await client.query(`UPDATE libraries SET is_active=false WHERE id=60`);
  const inactiveInput = { ...input, libraries: available.map(library => ({ ...library, is_active: library.id !== 60 })) };
  expect((await service.build(inactiveInput)).candidates.map(candidate => candidate.libraryId)).toEqual([10, 20, 50]);
  expect(policyResult).toEqual(before);
  expect((await client.query('SELECT count(*)::integer AS count FROM inventory_description_vector_cache')).rows[0].count).toBe(24);
});
