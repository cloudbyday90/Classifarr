/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { createMigrationRunner } from '../config/migrations.mjs';
import { queueLibraryProfileUpgrade } from '../services/libraryProfileUpgradeQueue.mjs';
import { LibraryInventoryProfileRefreshPlanner } from '../services/libraryInventoryProfileRefreshPlanner.mjs';
import { LibraryProfileService } from '../services/libraryProfileService.mjs';
import { readLibraryProfileRefreshStatus } from '../services/libraryProfileRefreshStatus.mjs';
import { PolicyProfileRefreshOutboxWorker } from '../services/policyProfileRefreshOutboxWorker.mjs';
import { BASELINE_TAG } from './pinnedReleaseSchema.mjs';
export { BASELINE_COMMIT, BASELINE_TAG, BASELINE_SCHEMA_PATH, readPinnedReleaseSchema } from './pinnedReleaseSchema.mjs';

const upgradeTask = Object.freeze({
    id: 'queue_library_profile_revision_verification_v1',
    version: '0.48.4-beta',
    description: 'Queue revision-verified profile publication for existing libraries',
});

function expect(condition, message) {
    if (!condition) throw new Error(`Profile upgrade rehearsal failed: ${message}`);
}

export function createIsolatedDbClient(pool) {
    return {
        query: (...args) => pool.query(...args),
        withTransaction: async fn => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const result = await fn(client);
                await client.query('COMMIT');
                return result;
            } catch (error) {
                try {
                    await client.query('ROLLBACK');
                } catch {
                    // The original failure is the useful diagnostic; the pool releases this client below.
                }
                throw error;
            } finally {
                client.release();
            }
        },
    };
}

async function seedBaseline(db) {
    const libraryIds = {};
    for (const [kind, mediaType, active, genre] of [
        ['movie', 'movie', true, 'Adventure'],
        ['tv', 'tv', false, 'Drama'],
    ]) {
        const library = await db.query(`INSERT INTO libraries (external_id, name, media_type, is_active)
            VALUES ($1, $2, $3, $4) RETURNING id`,
        [`rehearsal-${randomUUID()}`, `Synthetic ${kind} library`, mediaType, active]);
        const libraryId = library.rows[0].id;
        libraryIds[kind] = libraryId;
        await db.query(`INSERT INTO media_server_items
            (external_id, title, library_id, media_type, genres, metadata)
            VALUES ($1, $2, $3, $4, $5, '{}'::jsonb)`,
        [`rehearsal-${randomUUID()}`, `Synthetic ${kind} item`, libraryId, mediaType, [genre]]);
        await db.query(`INSERT INTO library_profiles (library_id, item_count, genre_distribution)
            VALUES ($1, 1, '{}'::jsonb)`, [libraryId]);
    }
    return libraryIds;
}

async function statusFor(db, libraryId) {
    const report = await readLibraryProfileRefreshStatus(db);
    expect(!report.windowTruncated, 'the synthetic library window was unexpectedly truncated');
    const entry = report.libraries.find(library => library.libraryId === libraryId);
    expect(entry, 'a synthetic library is missing from the status report');
    return entry;
}

function createWorker(dbClient, profileService) {
    return new PolicyProfileRefreshOutboxWorker({
        dbClient,
        profileService,
        nativeCircuitRepository: { clearForLibrary: async () => 0 },
        loggerInstance: { info() {}, warn() {} },
    });
}

async function verifyPublication(db, libraryId, expectedGenre) {
    const status = await statusFor(db, libraryId);
    expect(status.statusId === 'current', `library ${libraryId} did not become current`);
    expect(status.sourceRevision === status.profileRevision &&
        status.sourceRevision === status.acknowledgedRevision,
    `library ${libraryId} revisions were not verified together`);
    const profile = (await db.query(`SELECT item_count, genre_distribution, observation_summary
        FROM library_profiles WHERE library_id = $1`, [libraryId])).rows[0];
    expect(profile?.item_count === 1 && profile.observation_summary,
        `library ${libraryId} did not publish its synthetic inventory observation`);
    expect(JSON.stringify(profile.genre_distribution).includes(expectedGenre),
        `library ${libraryId} did not retain its synthetic genre`);
    return status.sourceRevision;
}

/** Run only the bounded profile path on an isolated database containing synthetic release-era data. */
export async function rehearseLibraryProfileUpgrade({ dbClient, releaseSchema, migrationsDir }) {
    expect(dbClient && typeof dbClient.withTransaction === 'function', 'an isolated database client is required');
    expect(typeof releaseSchema === 'string' && releaseSchema.includes('CREATE TABLE public.schema_migrations ('),
        'a pinned release schema is required');
    expect(typeof migrationsDir === 'string', 'a migration directory is required');

    const target = (await dbClient.query(`SELECT current_database() AS name,
        to_regclass('public.libraries') AS libraries,
        to_regclass('public.schema_migrations') AS ledger`)).rows[0];
    expect(target?.name === 'classifarr_rehearsal' && target.libraries === null && target.ledger === null,
        'the target must be an empty, named rehearsal database');

    await dbClient.query(releaseSchema);
    const libraryIds = await seedBaseline(dbClient);
    const migrationRunner = createMigrationRunner({ dbClient, env: { MIGRATIONS_DIR: migrationsDir } });
    const migrations = await migrationRunner.run();
    expect(migrations.applied > 0, 'no post-release migrations were applied');

    const beforeMovie = await statusFor(dbClient, libraryIds.movie);
    const beforeTv = await statusFor(dbClient, libraryIds.tv);
    expect(beforeMovie.statusId === 'waiting' && beforeMovie.profileRevision === null,
        'the active legacy movie profile was not queued for verification');
    expect(beforeTv.statusId === 'paused' && beforeTv.profileRevision === null,
        'the inactive legacy TV profile was not paused');

    const enrolled = await queueLibraryProfileUpgrade(upgradeTask, dbClient);
    expect(enrolled.queued === 2, 'upgrade enrollment did not capture both libraries');
    const replay = await queueLibraryProfileUpgrade(upgradeTask, dbClient);
    expect(replay.alreadyRecorded === true && replay.queued === 0,
        'upgrade enrollment was not idempotent');

    const firstPlanner = new LibraryInventoryProfileRefreshPlanner({ dbClient });
    const planning = await firstPlanner.run();
    expect(planning.queued === 1, 'the active library was not admitted exactly once');
    expect((await statusFor(dbClient, libraryIds.movie)).statusId === 'queued',
        'the movie refresh was not visible as queued');
    expect((await statusFor(dbClient, libraryIds.tv)).statusId === 'paused',
        'the inactive TV library was not retained as paused');

    const transient = new Error('Synthetic timeout during upgrade rehearsal');
    transient.code = 'ETIMEDOUT';
    const failed = await createWorker(dbClient, { generateProfile: async () => { throw transient; } }).run();
    expect(failed.retried === 1 && (await statusFor(dbClient, libraryIds.movie)).statusId === 'retry_wait',
        'the transient failure was not retained for a scheduled retry');

    // Advance only this disposable queue record instead of sleeping for the production retry delay.
    const advanced = await dbClient.query(`UPDATE policy_profile_refresh_outbox
        SET available_at = NOW() - INTERVAL '1 second'
        WHERE library_id = $1 AND request_type = 'inventory_change' AND processing_state = 'pending'`,
    [libraryIds.movie]);
    expect(advanced.rowCount === 1, 'the synthetic retry was not advanced');

    // Fresh service instances simulate a process restart against the same durable database.
    const restartedProfileService = new LibraryProfileService({ dbClient });
    const restartedWorker = createWorker(dbClient, restartedProfileService);
    const recovered = await restartedWorker.run();
    expect(recovered.completed === 1, 'the restarted worker did not complete the movie refresh');
    const movieRevision = await verifyPublication(dbClient, libraryIds.movie, 'Adventure');

    await dbClient.query('UPDATE libraries SET is_active = TRUE WHERE id = $1', [libraryIds.tv]);
    const resumedPlanner = new LibraryInventoryProfileRefreshPlanner({ dbClient });
    expect((await resumedPlanner.run()).queued === 1, 'the reactivated TV library was not admitted');
    expect((await createWorker(dbClient, restartedProfileService).run()).completed === 1,
        'the TV refresh did not complete');
    const tvRevision = await verifyPublication(dbClient, libraryIds.tv, 'Drama');

    return {
        baselineTag: BASELINE_TAG,
        migrationCount: migrations.applied,
        syntheticLibraries: 2,
        enrollmentIdempotent: true,
        transientRetryRecovered: true,
        inactiveLibraryResumed: true,
        finalStatuses: ['current', 'current'],
        verifiedRevisions: [movieRevision, tvRevision],
    };
}
