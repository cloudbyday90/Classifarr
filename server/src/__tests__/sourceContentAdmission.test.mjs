/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach } from '@jest/globals';
import { SourceContentDeferredError } from '../services/sourceContentFailure.mjs';
const repository = { check: jest.fn(), admit: jest.fn(), fail: jest.fn(), settleProbe: jest.fn() };
jest.unstable_mockModule('../services/sourceContentCircuitRepository.mjs', () => ({ createSourceContentCircuitRepository: () => repository }));
const { createSourceContentAdmission } = await import('../services/sourceContentAdmission.mjs');
let db, owner, service, controller, gate;
const ticket = { epoch: '2', attempts: 2, probe: true };
const empty = { items: [], keys: [], total: 0, offset: 0 };
const request = () => gate.page(service, 'getLibraryPage', 'http://synthetic.invalid', 'synthetic', 'films', { signal: owner.signal });
beforeEach(() => {
  jest.resetAllMocks(); controller = new AbortController();
  db = { query: jest.fn().mockResolvedValue({ rows: [{ acquired: true, released: true }] }) };
  owner = { signal: controller.signal, assertSource: jest.fn().mockResolvedValue(undefined) };
  service = { getLibraryPage: jest.fn().mockResolvedValue(empty), getCollectionPage: jest.fn().mockResolvedValue(empty) };
  repository.admit.mockImplementationOnce(async acquire => { await acquire(); return ticket; }).mockResolvedValue({ probe: false });
  gate = createSourceContentAdmission({ db, source: { media_server_id: 1, catalog_revision: '1' }, owner });
});
test('validates both operations, releases the probe lock, and re-admits the original request', async () => {
  await gate.check(); expect(repository.check).toHaveBeenCalledTimes(1);
  await request();
  expect(service.getLibraryPage).toHaveBeenCalledTimes(2); expect(service.getCollectionPage).toHaveBeenCalledTimes(1);
  expect(repository.settleProbe).toHaveBeenCalledWith(ticket, true);
  expect(db.query.mock.calls[1][0]).toContain('pg_advisory_unlock');
  expect(repository.admit).toHaveBeenCalledTimes(2);
});
test('unlocks even if durable probe claim fails after acquiring the session lock', async () => {
  repository.admit.mockReset().mockImplementation(async acquire => { await acquire(); throw new Error('write failed'); });
  await expect(request()).rejects.toThrow('write failed');
  expect(db.query.mock.calls[1][0]).toContain('pg_advisory_unlock');
  expect(service.getLibraryPage).not.toHaveBeenCalled();
});
test('probe contention makes no requests and never unlocks another owner', async () => {
  db.query.mockResolvedValue({ rows: [{ acquired: false }] });
  repository.admit.mockReset().mockImplementation(async acquire => { if (!await acquire()) throw new SourceContentDeferredError('source_content_probe_busy'); });
  await expect(request()).rejects.toMatchObject({ reason: 'source_content_probe_busy' });
  expect(db.query).toHaveBeenCalledTimes(1); expect(service.getLibraryPage).not.toHaveBeenCalled();
});
test('inconclusive library-local probes retain a wait, not an outage classification', async () => {
  service.getCollectionPage.mockRejectedValue({ response: { status: 403 } });
  await expect(request()).rejects.toThrow();
  expect(repository.settleProbe).toHaveBeenCalledWith(ticket, false);
  expect(repository.fail).not.toHaveBeenCalled();
});
test('explicit source failure records its delay once, without an inconclusive overwrite', async () => {
  service.getLibraryPage.mockRejectedValue({ response: { status: 503 } });
  repository.fail.mockResolvedValue(new SourceContentDeferredError());
  await expect(request()).rejects.toMatchObject({ reason: 'source_content_cooldown' });
  expect(repository.fail).toHaveBeenCalledTimes(1); expect(repository.settleProbe).not.toHaveBeenCalled();
});
test('ownership loss aborts without any circuit completion or replacement-connection unlock', async () => {
  service.getLibraryPage.mockImplementation(async () => { controller.abort(new Error('owner lost')); throw new Error('request aborted'); });
  await expect(request()).rejects.toThrow('owner lost');
  expect(repository.fail).not.toHaveBeenCalled(); expect(repository.settleProbe).not.toHaveBeenCalled();
  expect(db.query).toHaveBeenCalledTimes(1);
});
test('failed unlock is an ownership failure, never success', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValueOnce({ rows: [{ released: false }] });
  await expect(request()).rejects.toThrow('source_content_probe_ownership_lost');
  expect(service.getLibraryPage).toHaveBeenCalledTimes(1);
});
