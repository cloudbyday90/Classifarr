/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { withSourcePageFixtures } from './sourcePageFixture.mjs';
import { MediaSyncService } from '../../services/mediaSync.mjs';
import { createMediaSyncIdentityRecovery } from '../../services/mediaSyncIdentityRecovery.mjs';
import { persistRecoveredSyncItem } from '../../services/mediaSyncIdentityRecoveryPersistence.mjs';
import { sourceIdentityRecoveryEvidence } from '../../services/sourceIdentityRecoveryEvidence.mjs';
import { QueueService } from '../../services/queueService.mjs';
import { QueueTaskProcessorService } from '../../services/queueTaskProcessorService.mjs';
import { createLibraryProfileService } from '../../services/libraryProfileService.mjs';
import { LibraryInventoryProfileRefreshPlanner } from '../../services/libraryInventoryProfileRefreshPlanner.mjs';
import { PolicyProfileRefreshOutboxWorker } from '../../services/policyProfileRefreshOutboxWorker.mjs';
import { readLibraryProfileRefreshStatus } from '../../services/libraryProfileRefreshStatus.mjs';

const analyze = async () => ({ analyzed: false });
const logger = () => Object.fromEntries(['info', 'debug', 'warn', 'error'].map(level => [level, jest.fn()]));

export function identityFixture(externalId, mediaType) {
    const item = { external_id: externalId, title: 'Synthetic handoff fixture', year: 2001,
        media_type: mediaType, provider_identity_invalid: true, provider_identity_issue: 'conflicting_provider_ids' };
    item.source_identity_evidence = sourceIdentityRecoveryEvidence(item, 'fixture-library',
        { tmdb_id: [11, 22], imdb_id: ['tt123'], tvdb_id: [] });
    return item;
}

export function observationFixture(mediaType) {
    return { id: 22, original_language: mediaType === 'movie' ? 'ja' : 'fr',
        production_companies: [{ id: 12, name: 'Synthetic producer' }],
        keywords: { [mediaType === 'movie' ? 'keywords' : 'results']: [{ name: 'space' }] } };
}

/** Call only with the disposable integration database facade, never the application database. */
export async function createHandoffFixture(db, mediaType) {
    const log = logger();
    const { serverId, libraryId, configId } = await db.withTransaction(async client => {
        const serverId = (await client.query(`INSERT INTO media_server (type,name,url,api_key)
            VALUES ('plex',$1,$2,'synthetic-only') RETURNING id`, [randomUUID(), `http://${randomUUID()}.invalid`])).rows[0].id;
        const libraryId = (await client.query(`INSERT INTO libraries (name,external_id,media_type,media_server_id,is_active)
            VALUES ($1,'fixture-library',$2,$3,true) RETURNING id`, [randomUUID(), mediaType, serverId])).rows[0].id;
        const configId = (await client.query("INSERT INTO tmdb_config (api_key,is_active) VALUES ('synthetic-only',true) RETURNING id")).rows[0].id;
        return { serverId, libraryId, configId };
    });
    const repaired = identityFixture('repairable', mediaType);
    const changed = identityFixture('changed-source', mediaType);
    const music = { external_id: 'unsupported-track', title: 'Synthetic audio', media_type: 'track' };
    const provider = {
        findIdentityByExternalId: jest.fn().mockResolvedValue({ movie_results: [{ id: 22 }], tv_results: [{ id: 22 }] }),
        getIdentityDetails: jest.fn().mockResolvedValue({ id: 22, title: repaired.title, name: repaired.title,
            release_date: '2001-01-01', first_air_date: '2001-01-01' }),
        getApiKey: jest.fn().mockResolvedValue('synthetic-only'),
        getMovieDetails: jest.fn().mockResolvedValue(observationFixture('movie')),
        getTVDetails: jest.fn().mockResolvedValue(observationFixture('tv')),
    };
    const source = { getLibraryItemIdentityEvidence: jest.fn(async (_url, _key, _library, id) =>
        id === repaired.external_id ? repaired.source_identity_evidence : { mediaType, snapshotDigest: 'changed-source' }) };
    const classify = jest.fn(() => { throw new Error('Classification is outside the recovery handoff'); });
    const profileService = createLibraryProfileService({ dbClient: db });

    return {
        db, mediaType, serverId, libraryId, repaired, changed, music, provider, source, classify, log,
        observationMethod: provider[mediaType === 'movie' ? 'getMovieDetails' : 'getTVDetails'],
        async scan(items = [changed, repaired, music]) {
            // Real sync entry point includes paging, the music filter, pruning and recovery.
            const sync = new MediaSyncService({
                mediaServerServices: { getMediaServerService: async () => withSourcePageFixtures({ ...source,
                    getLibraryItems: async (_url, _key, _library, { offset, limit }) => items.slice(offset, offset + limit),
                    getCollections: async () => [],
                }, items.length) },
                createIdentityRecovery: () => createMediaSyncIdentityRecovery({ tmdbService: provider }),
                persistIdentityRecovery: (store, context, proof) => persistRecoveredSyncItem(store, context, proof, { analyze }),
                // Log presentation/link enrichment is a separate boundary, not part of this canary.
                skipReporter: { report: async () => {} },
            });
            return sync.syncLibrary(libraryId, { batchSize: 1 });
        },
        async dueRecovery() {
            await db.query("UPDATE media_source_observations SET recovery_retry_after=clock_timestamp()-INTERVAL '1 second' WHERE library_id=$1", [libraryId]);
        },
        queue({ afterResultCommit = async () => {} } = {}) {
            const queue = new QueueService({ db, logger: log, tmdbService: provider,
                classificationService: { classifyQueueTask: classify } });
            const processorDb = { ...db, withTransaction: async work => {
                let completed = false;
                const result = await db.withTransaction(client => work({ query: async (...args) => {
                    if (/UPDATE task_queue\s+SET status = 'completed'/.test(args[0])) completed = true;
                    return client.query(...args);
                } }));
                if (completed) await afterResultCommit();
                return result;
            } };
            queue.queueTaskProcessorService = new QueueTaskProcessorService({ db: processorDb, logger: log, tmdbService: provider,
                classificationService: { classifyQueueTask: classify },
                // Optional enrichment is deliberately disabled; all persistence remains real.
                queueOmdbEnrichmentService: { enrich: async () => {} },
                queueWebSearchEnrichmentService: { enrich: async () => {} },
            });
            return queue;
        },
        async claim(queue) {
            return queue.dequeue({ onlyTaskTypes: ['metadata_enrichment'], excludeClassification: true });
        },
        async inventory() {
            return (await db.query('SELECT * FROM media_server_items WHERE library_id=$1 ORDER BY external_id', [libraryId])).rows;
        },
        async unresolved() {
            return (await db.query(`SELECT external_id,recovery_outcome,recovery_retry_after
                FROM media_source_observations WHERE library_id=$1 ORDER BY external_id`, [libraryId])).rows;
        },
        async tasks() {
            return (await db.query("SELECT * FROM task_queue WHERE payload->>'source_library_id'=$1 ORDER BY id", [String(libraryId)])).rows;
        },
        async history() {
            return (await db.query('SELECT * FROM classification_history WHERE library_id=$1', [libraryId])).rows;
        },
        async plan() {
            return new LibraryInventoryProfileRefreshPlanner({ dbClient: db }).run();
        },
        worker(overrides = {}) {
            return new PolicyProfileRefreshOutboxWorker({ dbClient: db, profileService, loggerInstance: log, ...overrides });
        },
        async status() {
            return (await readLibraryProfileRefreshStatus(db)).libraries.find(row => row.libraryId === libraryId);
        },
        async profile() {
            return (await db.query('SELECT * FROM library_profiles WHERE library_id=$1', [libraryId])).rows[0];
        },
        async cleanup() {
            await db.query("DELETE FROM task_queue WHERE payload->>'source_library_id'=$1", [String(libraryId)]);
            await db.query('DELETE FROM classification_history WHERE library_id=$1', [libraryId]);
            await db.query('DELETE FROM policy_profile_refresh_outbox WHERE library_id=$1', [libraryId]);
            await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
            await db.query('DELETE FROM media_server_sync_status WHERE library_id=$1', [libraryId]);
            await db.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
            await db.query('DELETE FROM media_server WHERE id=$1', [serverId]);
            await db.query('DELETE FROM tmdb_config WHERE id=$1', [configId]);
        },
    };
}
