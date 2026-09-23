/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, test, expect } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { readLibraryUpgradeReadiness } from '../../services/libraryUpgradeReadiness.mjs';

const db = createIntegrationDatabaseModuleMock();
const libraryIds = [];
let serverId;

beforeEach(async () => {
    serverId = (await db.query(`INSERT INTO media_server (type, name, url, api_key)
        VALUES ('plex', $1, 'http://localhost', 'fixture-only') RETURNING id`,
    [`Readiness fixture ${randomUUID()}`])).rows[0].id;
    for (const [mediaType, active] of [['movie', true], ['tv', false]]) {
        const { rows } = await db.query(`INSERT INTO libraries (name, external_id, media_type, is_active, media_server_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [`Readiness fixture ${randomUUID()}`, randomUUID(), mediaType, active, serverId]);
        libraryIds.push(rows[0].id);
    }
});

afterEach(async () => {
    await db.query('DELETE FROM media_server_items WHERE library_id = ANY($1::bigint[])', [libraryIds]);
    await db.query('DELETE FROM libraries WHERE id = ANY($1::bigint[])', [libraryIds]);
    await db.query('DELETE FROM media_server WHERE id = $1', [serverId]);
});

test('real PostgreSQL aggregate counts movie and TV recovery without exposing titles', async () => {
    const before = await readLibraryUpgradeReadiness(db);
    for (const [index, mediaType] of ['movie', 'tv'].entries()) {
        await db.query(`INSERT INTO media_server_items
            (external_id, title, library_id, media_type, metadata)
            VALUES ($1, $2, $3, $4, '{}'::jsonb)`,
        [randomUUID(), 'Private fixture title', libraryIds[index], mediaType]);
    }
    const after = await readLibraryUpgradeReadiness(db);
    expect(after.libraryCount).toBe(before.libraryCount);
    expect(after.mediaTypes.movie).toBeGreaterThanOrEqual(1);
    expect(after.mediaTypes.tv).toBeGreaterThanOrEqual(1);
    expect(after.profile.waiting).toBe(before.profile.waiting + 1);
    expect(after.profile.paused).toBe(before.profile.paused + 1);
    expect(after.profile.missing).toBe(before.profile.missing + 2);
    await db.query(`INSERT INTO media_source_capture_state
        (library_id, media_server_id, generation, mode, phase, source)
        VALUES ($1, $2, 1, 'full', 'complete', 'media_sync')`, [libraryIds[0], serverId]);
    await db.query(`INSERT INTO media_source_observations
        (library_id, media_server_id, external_id, title, media_type, identity_issue, generation)
        VALUES ($1, $2, $3, 'Private fixture title', 'movie', 'conflicting_provider_ids', 1)`,
    [libraryIds[0], serverId, randomUUID()]);
    const withConflict = await readLibraryUpgradeReadiness(db);
    expect(withConflict.sourceIdentity.completeCaptureLibraryCount).toBe(
        before.sourceIdentity.completeCaptureLibraryCount + 1);
    expect(withConflict.sourceIdentity.conflictingProviderItemCount).toBe(
        before.sourceIdentity.conflictingProviderItemCount + 1);
    expect(withConflict.sourceIdentity.unresolvedItemCount).toBe(
        before.sourceIdentity.unresolvedItemCount + 1);
    expect(JSON.stringify(after)).not.toContain('Private fixture title');
    expect(JSON.stringify(withConflict)).not.toContain('Private fixture title');
});
