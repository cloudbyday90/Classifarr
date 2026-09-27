/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createInventoryRecoveryReadService } from '../../services/inventoryRecoveryReadService.mjs';

const db = createIntegrationDatabaseModuleMock();
let actor, server, libraries, items, service, links;
const caseId = randomUUID(), at = '2026-09-27T12:00:00.000Z';
const record = type => ({ version: 1, case_id: caseId, tmdb_id: 7, media_type: type,
    status: 'open', category: 'not_found', attempt_count: 1, first_seen: at, last_seen: at, resolved_at: null });
beforeEach(async () => {
    libraries = []; items = [];
    actor = (await db.query("INSERT INTO users(username,password_hash,role) VALUES ($1,'test','admin') RETURNING id", [randomUUID()])).rows[0].id;
    server = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://fixture.invalid','private') RETURNING id", [randomUUID()])).rows[0].id;
    links = jest.fn().mockResolvedValue([null]);
    service = createInventoryRecoveryReadService({ db, resolveLinks: links });
});
afterEach(async () => {
    await db.query('DELETE FROM media_source_observations WHERE library_id=ANY($1::int[])', [libraries]);
    await db.query('DELETE FROM media_server_items WHERE id=ANY($1::int[])', [items]);
    await db.query('DELETE FROM libraries WHERE id=ANY($1::int[])', [libraries]);
    await db.query('DELETE FROM media_server WHERE id=$1', [server]);
    await db.query('DELETE FROM users WHERE id=$1', [actor]);
});
async function seed(type = 'movie', count = 1) {
    const lib = (await db.query('INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,$2,$3,$4,true) RETURNING id',
        [randomUUID(), randomUUID(), type === 'music' ? 'movie' : type, server])).rows[0].id;
    libraries.push(lib);
    for (let n = 0; n < count; n++) {
        const id = (await db.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,year,media_type,tmdb_id,inventory_tmdb_recovery,inventory_tmdb_retry_after)
            VALUES ($1,$2,$3,'Synthetic only',2020,$4,7,$5,now()+interval '1 hour') RETURNING id`,
        [server, lib, String(items.length + 1), type, record(type)])).rows[0].id;
        items.push(id);
    }
    return lib;
}
test('single-snapshot totals, keyset pages and no source/data mutations', async () => {
    await seed('movie', 26); await seed('tv', 1);
    const before = (await db.query('SELECT id,xmin::text AS revision FROM media_server_items WHERE id=ANY($1::int[]) ORDER BY id', [items])).rows;
    const first = await service.list(actor);
    expect(first).toMatchObject({ total: 27, movies: 26, tv: 1, nextCursor: items[24] });
    expect(first.items).toHaveLength(25);
    expect(first.items[0]).toMatchObject({ retryState: 'waiting', isPlex: true, sourceReview: true });
    const second = await service.list(actor, { afterId: String(first.nextCursor) });
    expect(second.items.map(row => row.id)).toEqual(items.slice(25));
    expect(second.total).toBe(27); expect(second.nextCursor).toBeNull();
    expect(links).not.toHaveBeenCalled();
    expect((await db.query('SELECT id,xmin::text AS revision FROM media_server_items WHERE id=ANY($1::int[]) ORDER BY id', [items])).rows).toEqual(before);
});
test('excludes inactive, unsupported, mismatched and resolved cases', async () => {
    const lib = await seed();
    await seed('music');
    expect((await service.list(actor)).total).toBe(1);
    await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [lib]);
    expect((await service.list(actor)).total).toBe(0);
    await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [lib]);
    await db.query('UPDATE media_server SET is_active=false WHERE id=$1', [server]);
    expect((await service.list(actor)).total).toBe(0);
    await db.query('UPDATE media_server SET is_active=true WHERE id=$1', [server]);
    await db.query('UPDATE media_server_items SET inventory_tmdb_recovery=$2 WHERE id=$1', [items[0], { ...record('movie'), tmdb_id: 99 }]);
    expect((await service.list(actor)).total).toBe(0);
    await db.query('UPDATE media_server_items SET inventory_tmdb_recovery=$2 WHERE id=$1', [items[0], { ...record('movie'), status: 'resolved', resolved_at: at }]);
    expect((await service.list(actor)).total).toBe(0);
});
test('Plex offline/read recovery leaves identity unchanged, and server changes fence late results', async () => {
    await seed();
    expect(await service.plexLink(actor, items[0], caseId)).toEqual({ status: 'unavailable', url: null });
    links.mockResolvedValueOnce(['verified-test-link']);
    expect(await service.plexLink(actor, items[0], caseId)).toEqual({ status: 'available', url: 'verified-test-link' });
    links.mockImplementationOnce(async () => {
        await db.query("UPDATE media_server SET api_key='replacement-private' WHERE id=$1", [server]);
        return ['old-link'];
    });
    await expect(service.plexLink(actor, items[0], caseId)).rejects.toMatchObject({ statusCode: 409 });
    expect((await db.query('SELECT tmdb_id, inventory_tmdb_recovery FROM media_server_items WHERE id=$1', [items[0]])).rows[0])
        .toMatchObject({ tmdb_id: 7, inventory_tmdb_recovery: record('movie') });
});
test('current source change and revoked admin invalidate subsequent reads', async () => {
    await seed();
    await db.query("UPDATE media_server_items SET title='Changed source' WHERE id=$1", [items[0]]);
    expect((await service.list(actor)).total).toBe(0);
    await expect(service.plexLink(actor, items[0], caseId)).rejects.toMatchObject({ statusCode: 404 });
    await db.query('UPDATE users SET is_active=false WHERE id=$1', [actor]);
    await expect(service.list(actor)).rejects.toMatchObject({ statusCode: 403 });
    expect(links).not.toHaveBeenCalled();
});
test('a current source conflict is shown as blocked, not as a due provider retry', async () => {
    const library = await seed();
    await db.query(`INSERT INTO media_source_capture_state(library_id,media_server_id,generation,mode,phase,source)
        VALUES ($1,$2,1,'full','collecting','media_sync')`, [library, server]);
    await db.query(`INSERT INTO media_source_observations(library_id,media_server_id,external_id,
        media_type,identity_issue,generation) VALUES ($1,$2,'1','movie','conflicting_provider_ids',1)`, [library, server]);
    const result = await service.list(actor);
    expect(result.items[0]).toMatchObject({ retryState: 'source_blocked', sourceReview: true,
        diagnosis: 'Source identity conflict blocks recovery' });
    expect(result.total).toBe(1);
});
