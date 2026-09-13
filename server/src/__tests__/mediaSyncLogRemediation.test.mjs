/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createMediaSyncLogRemediation } from '../services/mediaSyncLogRemediation.mjs';
import { createPlexLogItemLinks } from '../services/plexLogItemLinks.mjs';
import { formatMediaSyncRemediation } from '../services/mediaSyncRemediationReport.mjs';

const machineIdentifier = 'a'.repeat(40);
const identity = { success: true, data: { MediaContainer: { machineIdentifier } } };
const server = { id: 1, url: 'http://fixture.invalid', api_key: 'private-token' };
const log = { error_id: 'fixture', module: 'mediaSync', message: 'Library sync skipped source items',
  metadata: { libraryId: 10, identityIssueCounts: { conflicting_provider_ids: 2 }, reference: { url: 'old-forum' } } };
const row = { external_id: '123', title: 'Sample movie', year: 2006, media_type: 'movie', identity_issue: 'conflicting_provider_ids',
  provider_fields: ['tmdb_id'], library_name: 'Movies', server_id: 1, url: server.url, api_key: server.api_key };

test('offline lookup is retried for the SAME old warning and gains a token-free link without mutating it', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [row] });
  const testConnection = jest.fn().mockResolvedValueOnce({ success: false, error: 'private-token' }).mockResolvedValue(identity);
  const enrich = createMediaSyncLogRemediation({ query, resolveLinks: createPlexLogItemLinks({ testConnection }) });
  const offline = await enrich(log);
  expect(offline.remediation).toMatchObject({ status: 'unresolved', linkStatus: 'pending', items: [{ title: 'Sample movie', plexUrl: null }] });
  const online = await enrich(log);
  expect(online.error_id).toBe(log.error_id);
  expect(online.remediation.linkStatus).toBe('complete');
  expect(online.remediation.items[0].plexUrl).toBe(`https://app.plex.tv/desktop/#!/server/${machineIdentifier}/details?key=%2Flibrary%2Fmetadata%2F123`);
  expect(testConnection).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(online)).not.toMatch(/private-token|fixture.invalid|old-forum/);
  expect(log.metadata.reference.url).toBe('old-forum');
  expect(query.mock.calls[0][1]).toEqual(['fixture', 10, null, ['conflicting_provider_ids']]);
});

test('coalesces concurrent lookups but retries rejected lookups and changed configuration', async () => {
  let finish;
  const testConnection = jest.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockRejectedValueOnce(new Error('private')).mockResolvedValue(identity);
  const links = createPlexLogItemLinks({ testConnection });
  const first = links(server, ['1']); const second = links(server, ['2']);
  await Promise.resolve();
  finish(identity);
  const results = await Promise.all([first, second]);
  expect(testConnection).toHaveBeenCalledTimes(1);
  expect(results[1][0]).toContain('%2F2');
  expect(await links(server, ['1'])).toEqual([null]);
  expect((await links({ ...server, api_key: 'rotated' }, ['1']))[0]).toContain(machineIdentifier);
});

test.each(['../123', '0', '123?token=secret', '123#evil', '', 123, '1'.repeat(21)])('rejects unsafe item ID: %s', async id => {
  const links = createPlexLogItemLinks({ testConnection: async () => identity });
  expect(await links(server, [id])).toEqual([null]);
});
test.each([undefined, 'https://evil.invalid', 'a'.repeat(65), 'abc/../../', 123])('rejects unverified server identity: %s', async id => {
  const links = createPlexLogItemLinks({ testConnection: async () => ({ success: true, data: { MediaContainer: { machineIdentifier: id } } }) });
  expect(await links(server, ['1'])).toEqual([null]);
});

test('bounds simultaneous requests and releases slots after failure', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const testConnection = jest.fn().mockReturnValue(pending);
  const links = createPlexLogItemLinks({ testConnection });
  const requests = Array.from({ length: 16 }, (_, id) => links({ ...server, id }, ['1']));
  expect(await links({ ...server, id: 20 }, ['1'])).toEqual([null]);
  finish({ success: false }); await Promise.all(requests);
  testConnection.mockResolvedValue(identity);
  expect((await links(server, ['1']))[0]).toContain(machineIdentifier);
});

test.each([{ ...log, module: 'other' }, { ...log, message: 'other' }, { ...log, metadata: {} },
  { ...log, metadata: { libraryId: '10-invalid', identityIssueCounts: { conflicting_provider_ids: 1 } } }])('unrelated/invalid logs do not trigger queries', async other => {
  const query = jest.fn();
  expect(await createMediaSyncLogRemediation({ query })(other)).toBe(other);
  expect(query).not.toHaveBeenCalled();
});

test('empty/expired records are not called resolved, database failures do not break reports', async () => {
  const query = jest.fn().mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('private'));
  const resolveLinks = jest.fn(); const enrich = createMediaSyncLogRemediation({ query, resolveLinks });
  expect((await enrich(log)).remediation.status).toBe('no_current_records');
  const failed = await enrich(log);
  expect(failed.remediation.status).toBe('unavailable');
  expect(formatMediaSyncRemediation(failed.remediation)).toContain('could not be loaded');
  expect(resolveLinks).not.toHaveBeenCalled();
});

test('projects bounded, normalized fields and preserves repair steps when link lookup fails', async () => {
  const query = jest.fn().mockResolvedValue({ rows: Array.from({ length: 51 }, () => ({ ...row,
    title: ' \u0000A\nshow ', year: -1, media_type: 'tv', provider_fields: ['tvdb_id', 'secret'], secret: 'private' })) });
  const enrich = createMediaSyncLogRemediation({ query, resolveLinks: async () => { throw new Error('private'); } });
  const result = (await enrich({ ...log, metadata: { ...log.metadata, mediaServerId: 1 } })).remediation;
  expect(result.truncated).toBe(true); expect(result.items).toHaveLength(50);
  expect(result.items[0]).toMatchObject({ title: 'Ashow', year: null, mediaType: 'TV show', plexUrl: null });
  expect(result.items[0].issue).toContain('TVDB'); expect(result.steps.join(' ')).toContain('show, not a season');
  expect(JSON.stringify(result)).not.toContain('secret'); expect(query.mock.calls[0][1][2]).toBe(1);
  expect(formatMediaSyncRemediation(result)).toContain('first 50');
});

test.each(['invalid_provider_ids', 'invalid_media_type'])('explains %s and missing fields without guessing titles', async identity_issue => {
  const enrich = createMediaSyncLogRemediation({ query: async () => ({ rows: [{ ...row, identity_issue, title: null, library_name: '', media_type: null, provider_fields: null }] }),
    resolveLinks: async () => [] });
  const result = (await enrich(log)).remediation;
  expect(result.items[0]).toMatchObject({ title: 'Untitled Plex item', library: 'Plex library', mediaType: 'Unknown type' });
  expect(result.items[0].issue).not.toContain('more than one ID');
});

test('copy report escapes untrusted title markup and contains actionable steps, not a forum pointer', async () => {
  const enrich = createMediaSyncLogRemediation({ query: async () => ({ rows: [{ ...row, title: '<img> [click](https://evil.invalid)' }] }),
    resolveLinks: createPlexLogItemLinks({ testConnection: async () => identity }) });
  const result = formatMediaSyncRemediation((await enrich(log)).remediation);
  expect(result).toContain('&lt;img&gt; \\[click\\]\\(https://evil.invalid\\)');
  expect(result).toContain('Fix Match'); expect(result).toContain('Refresh Metadata');
  expect(result).toContain('app.plex.tv'); expect(result).not.toContain('old-forum');
  expect(formatMediaSyncRemediation()).toBe('');
});
