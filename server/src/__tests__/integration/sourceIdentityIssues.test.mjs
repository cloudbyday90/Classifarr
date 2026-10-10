/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { readSourceIdentityIssues } from '../../services/sourceIdentityIssues.mjs';
import { readLibraryUpgradeReadiness } from '../../services/libraryUpgradeReadiness.mjs';

let client, serverId, libraryId;
beforeEach(async () => {
    client = await getPool().connect(); await client.query('BEGIN');
    serverId = (await client.query(`INSERT INTO media_server(type,name,url,api_key)
        VALUES ('plex',$1,'http://fixture.invalid','fixture') RETURNING id`, [randomUUID()])).rows[0].id;
    libraryId = (await client.query(`INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active)
        VALUES ($1,$2,'movie',$3,true) RETURNING id`, [randomUUID(), randomUUID(), serverId])).rows[0].id;
    await client.query(`INSERT INTO media_source_capture_state(library_id,media_server_id,generation,mode,phase,source)
        VALUES ($1,$2,2,'full','complete','media_sync')`, [libraryId, serverId]);
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
async function addItems(amount = 1) {
    await client.query(`INSERT INTO media_source_observations
        (library_id,media_server_id,external_id,title,media_type,identity_issue,generation)
        SELECT $1,$2,'key-'||lpad(n::text,3,'0'),'Fixture '||n,'movie','conflicting_provider_ids',2
        FROM generate_series(1,$3) n`, [libraryId, serverId, amount]);
}
test('detail total matches readiness, with complete pagination and no writes', async () => {
    await addItems(53);
    const first = await readSourceIdentityIssues(client);
    const second = await readSourceIdentityIssues(client, 50);
    expect(first.total).toBe((await readLibraryUpgradeReadiness(client)).sourceIdentity.unresolvedItemCount);
    expect(first.total).toBe(53);
    expect(first.items).toHaveLength(50); expect(second.items).toHaveLength(3);
    expect(new Set([...first.items, ...second.items].map(item => item.key)).size).toBe(53);
    expect(first.recovery.not_recorded).toBe(53);
    expect((await readSourceIdentityIssues(client, 100)).items).toEqual([]);
    expect((await client.query('SELECT COUNT(*)::int AS count FROM media_source_observations WHERE library_id=$1', [libraryId])).rows[0].count).toBe(53);
});
test('reports recorded retry boundaries, not running or successful recovery', async () => {
    await addItems(4);
    await client.query(`UPDATE media_source_observations SET recovery_retry_after=statement_timestamp()+INTERVAL '1 day'
        WHERE library_id=$1 AND external_id='key-001'`, [libraryId]);
    await client.query(`UPDATE media_source_observations SET recovery_retry_after=statement_timestamp()-INTERVAL '1 day'
        WHERE library_id=$1 AND external_id='key-002'`, [libraryId]);
    await client.query(`UPDATE media_source_observations SET identity_issue='invalid_provider_ids'
        WHERE library_id=$1 AND external_id='key-003'`, [libraryId]);
    expect((await readSourceIdentityIssues(client)).recovery).toEqual({ retry_wait: 1, retry_due: 1, source_review: 1, not_recorded: 1 });
});

test('reads provider diagnostics from the existing capture without changing observations', async () => {
    await addItems(3);
    await client.query(`UPDATE media_source_observations SET provider_fields=ARRAY['tvdb_id']
        WHERE library_id=$1 AND external_id='key-001'`, [libraryId]);
    await client.query(`UPDATE media_source_observations SET provider_fields=ARRAY['tmdb_id']
        WHERE library_id=$1 AND external_id='key-002'`, [libraryId]);
    const before = (await client.query('SELECT * FROM media_source_observations WHERE library_id=$1 ORDER BY external_id', [libraryId])).rows;
    const report = await readSourceIdentityIssues(client);
    expect(report.items.map(item => item.providerFields)).toEqual([['tvdb_id'], ['tmdb_id'], []]);
    const after = (await client.query('SELECT * FROM media_source_observations WHERE library_id=$1 ORDER BY external_id', [libraryId])).rows;
    expect(after).toEqual(before);
});
test('projects latest recovery evidence without attempt tokens and prioritizes identity disagreements', async () => {
    await addItems(3);
    await client.query(`UPDATE media_source_observations SET recovery_attempt_id=$2,
        recovery_attempted_at=statement_timestamp()-INTERVAL '1 hour',
        recovery_retry_after=statement_timestamp()+INTERVAL '1 day'
        WHERE library_id=$1 AND external_id<>'key-003'`, [libraryId, randomUUID()]);
    await client.query(`UPDATE media_source_observations SET recovery_outcome='external_ids_disagree',
        recovery_completed_at=statement_timestamp() WHERE library_id=$1 AND external_id='key-001'`, [libraryId]);
    const report = await readSourceIdentityIssues(client);
    expect(report.recovery).toEqual({ retry_wait: 1, retry_due: 0, source_review: 1, not_recorded: 1 });
    expect(report.items[0].lastRecovery).toMatchObject({ reason: 'external_ids_disagree',
        attemptedAt: expect.any(String), completedAt: expect.any(String) });
    expect(report.items[1].lastRecovery).toMatchObject({ reason: null, completedAt: null });
    expect(report.items[2].lastRecovery).toBeNull();
    expect(JSON.stringify(report)).not.toMatch(/attemptId|recovery_attempt_id|key-001/);
});
test.each([
    "UPDATE libraries SET is_active=false WHERE id=$1",
    "UPDATE media_source_capture_state SET phase='collecting' WHERE library_id=$1",
    "UPDATE media_source_capture_state SET phase='failed' WHERE library_id=$1",
    "UPDATE media_source_capture_state SET mode='incremental' WHERE library_id=$1",
    "UPDATE media_source_capture_state SET omitted_count=1 WHERE library_id=$1",
    "UPDATE media_source_capture_state SET uncapturable_count=1 WHERE library_id=$1",
    "UPDATE media_source_capture_state SET started_at=statement_timestamp()-INTERVAL '31 days' WHERE library_id=$1",
    "UPDATE media_source_observations SET last_seen_at=statement_timestamp()-INTERVAL '31 days' WHERE library_id=$1",
    "UPDATE media_source_observations SET generation=1 WHERE library_id=$1",
])('excludes out-of-scope evidence: %s', async sql => {
    await addItems(); await client.query(sql, [libraryId]);
    const report = await readSourceIdentityIssues(client);
    expect(report.total).toBe(0); expect(report.items).toEqual([]);
    expect(report.total).toBe((await readLibraryUpgradeReadiness(client)).sourceIdentity.unresolvedItemCount);
});
