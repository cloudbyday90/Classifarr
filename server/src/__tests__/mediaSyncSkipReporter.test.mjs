/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createMediaSyncSkipReporter } from '../services/mediaSyncSkipReporter.mjs';

const context = { libraryId: 10, mediaServerId: 1, syncStatusId: 100, incremental: false, sourceType: 'plex' };
const summary = { skippedItemCount: 2, reasonCounts: { invalid_source_identity: 2 }, identityIssueCounts: { conflicting_provider_ids: 2 } };
function setup() {
  const query = jest.fn().mockResolvedValue({ rows: [{ should_warn: true }] });
  const logger = { warn: jest.fn() };
  return { query, logger, reporter: createMediaSyncSkipReporter({ query, logger }) };
}

test('projects fixed counts and owner without forwarding private fields or forum links', async () => {
  const test = setup();
  await test.reporter.report(context, { ...summary, title: 'private', reference: { url: 'http://private' } });
  expect(test.logger.warn).toHaveBeenCalledWith('Library sync skipped source items', {
    libraryId: 10, mediaServerId: 1, ...summary, recovery: expect.any(String),
  }, {});
  expect(JSON.stringify(test.query.mock.calls[0][1])).not.toContain('private');
});
test.each(['emby', 'jellyfin', 'unknown'])('never labels another provider as Plex: %s', async sourceType => {
  const test = setup(); await test.reporter.report({ ...context, sourceType }, summary);
  expect(test.logger.warn.mock.calls[0][1].reference).toBeUndefined();
});
test('suppresses unchanged/superseded results, but persists a clean state without warning', async () => {
  const test = setup(); test.query.mockResolvedValue({ rows: [] });
  await test.reporter.report(context, summary); expect(test.logger.warn).not.toHaveBeenCalled();
  test.query.mockResolvedValue({ rows: [{ should_warn: false }] });
  await test.reporter.report({ ...context, incremental: true }, null);
  expect(test.query.mock.calls[1][1]).toEqual([10, 1, 'incremental', 100, null]);
  expect(test.logger.warn).not.toHaveBeenCalled();
});
test('storage/logger failures do not fail a completed sync; fallback is time limited', async () => {
  const test = setup(); test.query.mockRejectedValue(new Error('private'));
  test.logger.warn.mockRejectedValue(new Error('unavailable'));
  await expect(test.reporter.report(context, summary)).resolves.toBeUndefined();
  expect(test.logger.warn.mock.calls[0][2]).toMatchObject({ dedupeWindowMs: 86400000 });
  test.logger.warn.mockClear(); await test.reporter.report(context, null);
  expect(test.logger.warn).not.toHaveBeenCalled();
});
test.each([undefined, {}, { ...summary, skippedItemCount: 3 }, { ...summary, skippedItemCount: 0 },
  { ...summary, reasonCounts: { invalid_source_identity: -1 } },
  { ...summary, identityIssueCounts: { conflicting_provider_ids: 'secret' } }])('rejects malformed input without clearing state: %j', async input => {
  const test = setup(); await test.reporter.report(context, input);
  expect(test.query).not.toHaveBeenCalled(); expect(test.logger.warn).not.toHaveBeenCalled();
});
test('invalid context cannot reach storage or logs', async () => {
  const test = setup(); await test.reporter.report({ ...context, libraryId: 'secret' }, summary);
  expect(test.query).not.toHaveBeenCalled();
});
