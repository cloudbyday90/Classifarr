/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertUpgradeDrillEnvironment } from './publishedUpgradeFixtures.mjs';
import { MediaSyncService } from '../services/mediaSync.mjs';
import { createMediaSyncIdentityRecovery } from '../services/mediaSyncIdentityRecovery.mjs';
import { persistRecoveredSyncItem } from '../services/mediaSyncIdentityRecoveryPersistence.mjs';
import { sourceIdentityRecoveryEvidence } from '../services/sourceIdentityRecoveryEvidence.mjs';
import { QueueService } from '../services/queueService.mjs';
import { QueueTaskProcessorService } from '../services/queueTaskProcessorService.mjs';
import { createLibraryProfileService } from '../services/libraryProfileService.mjs';
import { LibraryInventoryProfileRefreshPlanner } from '../services/libraryInventoryProfileRefreshPlanner.mjs';
import { PolicyProfileRefreshOutboxWorker } from '../services/policyProfileRefreshOutboxWorker.mjs';
import { readLibraryProfileRefreshStatus } from '../services/libraryProfileRefreshStatus.mjs';

const libraries = db => db.query("SELECT id,media_type FROM libraries WHERE external_id IN ('restore-drill-movie','restore-drill-tv') ORDER BY media_type");

export async function verifyUpgradeHandoff(db) {
  assertUpgradeDrillEnvironment();
  const rows = (await libraries(db)).rows;
  assert.equal(rows.length, 2);
  const statuses = await readLibraryProfileRefreshStatus(db);
  for (const library of rows) {
    const status = statuses.libraries.find(row => row.libraryId === library.id);
    if (status.statusId !== 'current') process.stderr.write(`UPGRADE_HANDOFF_STATE ${JSON.stringify({
      type: library.media_type, status: status.statusId, source: status.sourceRevision,
      acknowledged: status.acknowledgedRevision, profile: status.profileRevision,
    })}\n`);
    assert.equal(status.statusId, 'current');
    assert.equal(status.profileRevision, status.sourceRevision);
    assert.equal(status.acknowledgedRevision, status.sourceRevision);
    const profile = (await db.query('SELECT * FROM library_profiles WHERE library_id=$1', [library.id])).rows[0];
    assert.equal(profile.item_count, 1);
    assert.equal(profile.observation_summary.traits.keywords.observedCount, 1);
    assert.deepEqual(profile.observation_summary.traits.keywords.entries,
      [{ value: 'space', count: 1, percentOfAllItems: 100, percentOfObservedItems: 100 }]);
    const inventory = (await db.query('SELECT external_id,tmdb_id,media_type FROM media_server_items WHERE library_id=$1', [library.id])).rows;
    assert.deepEqual(inventory, [{ external_id: `repairable-${library.media_type}`, tmdb_id: 22, media_type: library.media_type }]);
    const history = (await db.query('SELECT method,metadata FROM classification_history WHERE library_id=$1', [library.id])).rows;
    assert.equal(history.length, 1);
    assert.equal(history[0].method, 'source_library');
    assert.equal(history[0].metadata.classification_details.candidate_capture.status, 'not_applicable');
  }
  const tasks = (await db.query('SELECT task_type,status FROM task_queue')).rows;
  assert.equal(tasks.length, 2);
  assert.ok(tasks.every(task => task.task_type === 'metadata_enrichment' && task.status === 'completed'));
  return { movie: 'current', tv: 'current', music: 'excluded', routingTasks: 0 };
}

/** Synthetic adapters; real sync/recovery/queue/profile persistence, no scheduler or AI claim. */
export async function runUpgradeHandoff(db) {
  assertUpgradeDrillEnvironment();
  const log = { info() {}, debug() {}, warn() {}, error() { throw new Error('handoff_service_error'); } };
  const serverId = (await db.query(`INSERT INTO media_server (type,name,url,api_key,is_active)
    VALUES ('plex','Synthetic upgrade','http://synthetic.invalid','synthetic-only',true) RETURNING id`)).rows[0].id;
  await db.query("INSERT INTO tmdb_config (api_key,is_active) VALUES ('synthetic-only',true)");
  const rows = (await libraries(db)).rows;
  assert.equal(rows.length, 2);
  for (const library of rows) {
    await db.query('UPDATE libraries SET media_server_id=$1,is_active=true WHERE id=$2', [serverId, library.id]);
    // Source item IDs are server-scoped; equal provider IDs across media types
    // must not accidentally impersonate the same source item in two libraries.
    const item = { external_id: `repairable-${library.media_type}`, title: 'Synthetic handoff fixture', year: 2001,
      media_type: library.media_type, provider_identity_invalid: true, provider_identity_issue: 'conflicting_provider_ids' };
    item.source_identity_evidence = sourceIdentityRecoveryEvidence(item, `restore-drill-${library.media_type}`,
      { tmdb_id: [11, 22], imdb_id: ['tt123'], tvdb_id: [] });
    let outage = true, identityCalls = 0;
    const details = { id: 22, original_language: 'ja', production_companies: [{ id: 12, name: 'Synthetic producer' }],
      keywords: { keywords: [{ name: 'space' }], results: [{ name: 'space' }] } };
    const provider = {
      findIdentityByExternalId: async () => {
        identityCalls++;
        if (outage) throw new Error('synthetic outage');
        return { movie_results: [{ id: 22 }], tv_results: [{ id: 22 }] };
      },
      getIdentityDetails: async () => ({ id: 22, title: item.title, name: item.title,
        release_date: '2001-01-01', first_air_date: '2001-01-01' }),
      getApiKey: async () => 'synthetic-only', getMovieDetails: async () => details, getTVDetails: async () => details,
    };
    const items = [item, { external_id: 'unsupported-track', title: 'Synthetic audio', media_type: 'track' }];
    const sync = new MediaSyncService({
      mediaServerServices: { getMediaServerService: async () => ({
        getLibraryItemIdentityEvidence: async () => item.source_identity_evidence,
        getLibraryPage: async (_url, _key, _library, { offset, limit }) => {
          const page = items.slice(offset, offset + limit);
          return { items: page, keys: page.map(row => row.external_id), offset, total: items.length };
        },
        getCollectionPage: async () => ({ items: [], keys: [], offset: 0, total: 0 }),
      }) },
      createIdentityRecovery: () => createMediaSyncIdentityRecovery({ tmdbService: provider }),
      persistIdentityRecovery: (store, context, proof) => persistRecoveredSyncItem(store, context, proof,
        { analyze: async () => ({ analyzed: false }) }),
      skipReporter: { report: async () => {} },
    });
    const scan = async () => {
      const result = await sync.syncLibrary(library.id, { batchSize: 1 });
      assert.equal(result.success, true);
      assert.equal(result.ignoredItems, 1);
    };
    await scan();
    assert.deepEqual((await db.query('SELECT recovery_outcome FROM media_source_observations WHERE library_id=$1', [library.id])).rows,
      [{ recovery_outcome: 'provider_unavailable' }]);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM media_server_items WHERE library_id=$1', [library.id])).rows[0].count, 0);
    outage = false;
    await scan();
    assert.equal(identityCalls, 1); // Returning provider cannot bypass durable cooldown.
    await db.query("UPDATE media_source_observations SET recovery_retry_after=clock_timestamp()-INTERVAL '1 second' WHERE library_id=$1", [library.id]);
    await scan();
    const classify = () => { throw new Error('routing_not_allowed'); };
    const queue = new QueueService({ db, logger: log, tmdbService: provider, classificationService: { classifyQueueTask: classify } });
    queue.queueTaskProcessorService = new QueueTaskProcessorService({ db, logger: log, tmdbService: provider,
      classificationService: { classifyQueueTask: classify }, queueOmdbEnrichmentService: { enrich: async () => {} },
      queueWebSearchEnrichmentService: { enrich: async () => {} }, completeTask: (...args) => queue.completeTask(...args) });
    assert.equal((await queue.refillQueue()).queued, 1);
    const task = await queue.dequeue({ onlyTaskTypes: ['metadata_enrichment'], excludeClassification: true });
    assert.ok(task);
    await queue.queueTaskProcessorService.processMetadataEnrichmentTask(task);
    const planner = new LibraryInventoryProfileRefreshPlanner({ dbClient: db });
    const worker = new PolicyProfileRefreshOutboxWorker({ dbClient: db,
      profileService: createLibraryProfileService({ dbClient: db }), loggerInstance: log });
    // Restore itself queues a refresh. The planner intentionally waits until
    // that older request completes before scheduling the newer inventory revision.
    // Simulate bounded scheduler ticks; never force acknowledgements or retry dates.
    let current = false;
    for (let tick = 0; tick < 4 && !current; tick++) {
      await planner.run();
      const outcome = await worker.run();
      assert.equal(outcome.failed, 0);
      assert.equal(outcome.retried, 0);
      current = (await readLibraryProfileRefreshStatus(db)).libraries
        .find(row => row.libraryId === library.id)?.statusId === 'current';
    }
    assert.equal(current, true);
    await scan();
    assert.equal((await queue.refillQueue()).queued, 0);
    assert.equal(identityCalls, 2);
  }
  // Keep synthetic credentials disabled before the real normal runtime resumes.
  await db.query("UPDATE tmdb_config SET is_active=false WHERE api_key='synthetic-only'");
  await db.query('UPDATE media_server SET is_active=false WHERE id=$1', [serverId]);
  return verifyUpgradeHandoff(db);
}
