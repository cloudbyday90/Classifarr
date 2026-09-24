/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { createMigrationRunner } from '../config/migrations.mjs';
import { queueLibraryProfileUpgrade } from '../services/libraryProfileUpgradeQueue.mjs';
import { LibraryInventoryProfileRefreshPlanner } from '../services/libraryInventoryProfileRefreshPlanner.mjs';
import { LibraryProfileService } from '../services/libraryProfileService.mjs';
import { readLibraryProfileRefreshStatus } from '../services/libraryProfileRefreshStatus.mjs';
import { PolicyProfileRefreshOutboxWorker } from '../services/policyProfileRefreshOutboxWorker.mjs';
import { evaluateUpgradeCanaryProfiles } from './libraryProfileUpgradeCanaryEvaluation.mjs';
import { CANARY_ITEMS_PER_LIBRARY, CANARY_LIBRARIES } from './libraryProfileUpgradeCanaryFixtures.mjs';
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
    for (const { key, mediaType, active, genre } of CANARY_LIBRARIES) {
        const library = await db.query(`INSERT INTO libraries (external_id, name, media_type, is_active)
            VALUES ($1, $2, $3, $4) RETURNING id`,
        [`rehearsal-${randomUUID()}`, `Synthetic ${key} library`, mediaType, active]);
        const libraryId = library.rows[0].id;
        libraryIds[key] = libraryId;
        for (let index = 0; index < CANARY_ITEMS_PER_LIBRARY; index++) {
            await db.query(`INSERT INTO media_server_items
                (external_id, title, library_id, media_type, genres, metadata)
                VALUES ($1, $2, $3, $4, $5, '{}'::jsonb)`,
            [`rehearsal-${randomUUID()}`, `Synthetic ${key} item ${index + 1}`, libraryId, mediaType, [genre]]);
        }
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
    expect(profile?.item_count === CANARY_ITEMS_PER_LIBRARY && profile.observation_summary,
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

    for (const library of CANARY_LIBRARIES) {
        const before = await statusFor(dbClient, libraryIds[library.key]);
        expect(before.statusId === (library.active ? 'waiting' : 'paused') && before.profileRevision === null,
            `the legacy ${library.key} profile did not retain its expected pre-upgrade state`);
    }

    const enrolled = await queueLibraryProfileUpgrade(upgradeTask, dbClient);
    expect(enrolled.queued === CANARY_LIBRARIES.length, 'upgrade enrollment did not capture every library');
    const replay = await queueLibraryProfileUpgrade(upgradeTask, dbClient);
    expect(replay.alreadyRecorded === true && replay.queued === 0,
        'upgrade enrollment was not idempotent');

    const firstPlanner = new LibraryInventoryProfileRefreshPlanner({ dbClient });
    const planning = await firstPlanner.run();
    const activeLibraries = CANARY_LIBRARIES.filter(library => library.active);
    expect(planning.queued === activeLibraries.length, 'the active libraries were not admitted exactly once');
    for (const library of activeLibraries) {
        expect((await statusFor(dbClient, libraryIds[library.key])).statusId === 'queued',
            `the ${library.key} refresh was not visible as queued`);
    }
    expect((await statusFor(dbClient, libraryIds.tv)).statusId === 'paused',
        'the inactive TV library was not retained as paused');

    const transient = new Error('Synthetic timeout during upgrade rehearsal');
    transient.code = 'ETIMEDOUT';
    const failed = await createWorker(dbClient, { generateProfile: async () => { throw transient; } }).run();
    expect(failed.retried === activeLibraries.length,
        'the transient failures were not retained for scheduled retries');
    for (const library of activeLibraries) {
        expect((await statusFor(dbClient, libraryIds[library.key])).statusId === 'retry_wait',
            `the ${library.key} transient failure was not retained`);
    }

    // Advance only these disposable queue records instead of sleeping for the production retry delay.
    const advanced = await dbClient.query(`UPDATE policy_profile_refresh_outbox
        SET available_at = NOW() - INTERVAL '1 second'
        WHERE library_id = ANY($1::integer[]) AND request_type = 'inventory_change' AND processing_state = 'pending'`,
    [activeLibraries.map(library => libraryIds[library.key])]);
    expect(advanced.rowCount === activeLibraries.length, 'the synthetic retries were not advanced');

    // Fresh service instances simulate a process restart against the same durable database.
    const restartedProfileService = new LibraryProfileService({ dbClient });
    const restartedWorker = createWorker(dbClient, restartedProfileService);
    const recovered = await restartedWorker.run();
    expect(recovered.completed === activeLibraries.length,
        'the restarted worker did not complete every active refresh');
    const revisionsByLibrary = {};
    for (const library of activeLibraries) {
        revisionsByLibrary[library.key] = await verifyPublication(dbClient, libraryIds[library.key], library.genre);
    }

    await dbClient.query('UPDATE libraries SET is_active = TRUE WHERE id = $1', [libraryIds.tv]);
    const resumedPlanner = new LibraryInventoryProfileRefreshPlanner({ dbClient });
    expect((await resumedPlanner.run()).queued === 1, 'the reactivated TV library was not admitted');
    expect((await createWorker(dbClient, restartedProfileService).run()).completed === 1,
        'the TV refresh did not complete');
    revisionsByLibrary.tv = await verifyPublication(dbClient, libraryIds.tv, 'Drama');
    const profileProbe = await evaluateUpgradeCanaryProfiles({ profileService: restartedProfileService, libraryIds });

    return {
        baselineTag: BASELINE_TAG,
        migrationCount: migrations.applied,
        syntheticLibraries: CANARY_LIBRARIES.length,
        syntheticInventoryItems: CANARY_LIBRARIES.length * CANARY_ITEMS_PER_LIBRARY,
        enrollmentIdempotent: true,
        transientRetryRecovered: true,
        inactiveLibraryResumed: true,
        finalStatuses: CANARY_LIBRARIES.map(() => 'current'),
        verifiedRevisions: CANARY_LIBRARIES.map(library => revisionsByLibrary[library.key]),
        profileProbe,
    };
}
