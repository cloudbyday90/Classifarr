/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createManualRoutingCheckCoordinator } from '../services/manualRoutingCheckCoordinator.mjs';
import { createManualRoutingCheckService } from '../services/manualRoutingCheckService.mjs';
import { registerManualRoutingCheckSchedule } from '../services/manualRoutingCheckScheduler.mjs';
import { registerManualRoutingCheckRoute } from '../routes/queueRouteManualRoutingCheck.mjs';
import { requireAdmin } from '../middleware/apiKeyAuth.mjs';
import { createSchedulerTaskExecutionRunner } from '../services/schedulerTaskExecutionRunner.mjs';

function fixture() {
  const controller = new AbortController();
  const db = { withSessionAdvisoryLock: jest.fn(async (_key, fn) => { await fn({ signal: controller.signal }); return true; }) };
  const records = { load: jest.fn(async () => ({ row: { metadata: { classification_details: { manual_routing_attempt_id: 'attempt' } } } })) };
  const state = { claim: jest.fn(async () => ({ admitted: true })), finish: jest.fn(), read: jest.fn(), next: jest.fn(),
    setEnabled: jest.fn(async () => ({ enabled: true })) };
  const checker = { check: jest.fn(async () => ({ reason: 'verified_present', recorded: true })) };
  const logger = { info: jest.fn(), warn: jest.fn() };
  const service = createManualRoutingCheckCoordinator({ db, records, state, checker, logger });
  return { controller, db, records, state, checker, logger, service };
}

test('admission is committed before provider work; both paths use the same lock', async () => {
  const f = fixture();
  f.checker.check.mockImplementation(async () => {
    expect(f.state.claim).toHaveBeenCalledWith(12, 'attempt', true);
    return { reason: 'not_present', recorded: true };
  });
  expect((await f.service.check(12, { automatic: true })).reason).toBe('not_present');
  expect(f.state.finish).toHaveBeenCalledWith(12, 'not_present');
  f.checker.check.mockResolvedValue({ reason: 'verified_present' });
  await f.service.check(13);
  expect(f.db.withSessionAdvisoryLock.mock.calls.map(args => args[0])).toEqual([2028, 2028]);
});

test('busy, cooldown, stopped and admission failure never reach the checker', async () => {
  const f = fixture();
  expect((await f.service.check(-1)).reason).toBe('not_found');
  f.db.withSessionAdvisoryLock.mockResolvedValueOnce(false);
  expect((await f.service.check(1)).reason).toBe('busy');
  f.state.claim.mockResolvedValueOnce({ reason: 'cooldown', nextCheckAt: 'later' });
  expect(await f.service.check(1)).toMatchObject({ reason: 'cooldown', nextCheckAt: 'later' });
  f.state.claim.mockRejectedValueOnce(new Error('private credential'));
  expect(JSON.stringify(await f.service.check(1))).not.toContain('credential');
  f.controller.abort();
  expect((await f.service.check(1)).reason).toBe('stopped');
  expect(f.checker.check).not.toHaveBeenCalled();
});

test('legacy/configuration changes stop automatic work; disabling never requires eligibility', async () => {
  const f = fixture();
  f.records.load.mockResolvedValue({ reason: 'configuration_changed' });
  expect((await f.service.setEnabled(1, true)).reason).toBe('configuration_changed');
  expect(f.state.setEnabled).not.toHaveBeenCalled();
  await f.service.setEnabled(1, false);
  expect(f.state.setEnabled).toHaveBeenCalledWith(1, null, false);
  await f.service.check(1, { automatic: true });
  expect(f.state.finish).toHaveBeenCalledWith(1, 'configuration_changed');
  expect(f.checker.check).not.toHaveBeenCalled();
});

test('lock loss aborts the joined read and no observation is saved', async () => {
  const controller = new AbortController();
  const read = jest.fn(async (_url, _key, _identity, { signal }) => {
    controller.abort();
    expect(signal.aborted).toBe(true);
    return { id: 1 };
  });
  const repository = { load: async () => ({ intent: { arrType: 'radarr', identity: 1 }, baseUrl: 'fixture', apiKey: 'fixture' }),
    save: jest.fn() };
  const service = createManualRoutingCheckService({ repository, providers: { radarr: { getMovieByTmdbId: read } } });
  expect((await service.check(1, { signal: controller.signal })).reason).toBe('stopped');
  expect(repository.save).not.toHaveBeenCalled();
  await service.check(1, { signal: controller.signal });
  expect(read).toHaveBeenCalledTimes(1);
});

test('scheduler stays idle when empty, admits one record, and stops during shutdown', async () => {
  const coordinator = { next: jest.fn(async () => null), check: jest.fn() };
  const scheduler = { schedule: jest.fn() };
  registerManualRoutingCheckSchedule(scheduler, { coordinator });
  const run = scheduler.schedule.mock.calls[0][2];
  await run(); expect(coordinator.check).not.toHaveBeenCalled();
  coordinator.next.mockResolvedValue(12);
  await run(); expect(coordinator.check).toHaveBeenCalledTimes(1);
  const signal = coordinator.check.mock.calls[0][1].signal;
  scheduler.manualRoutingCheckWorker.stop();
  expect(signal.aborted).toBe(true);
  await run(); expect(coordinator.next).toHaveBeenCalledTimes(2);
  expect(scheduler.schedule.mock.calls[0][4]).toMatchObject({ quiet: true, noOverlap: true });
});

test('quiet polling omits routine log pairs but retains scheduler failures', async () => {
  const logger = { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
  const runner = createSchedulerTaskExecutionRunner({ logger, withSessionAdvisoryLock: jest.fn() });
  expect(await runner.run({ name: 'manual-routing-check', quiet: true, handler: async () => {} })).toBe(true);
  expect(logger.info).not.toHaveBeenCalled();
  expect(await runner.run({ name: 'manual-routing-check', quiet: true, handler: async () => { throw new Error('synthetic failure'); } })).toBe(false);
  expect(logger.error).toHaveBeenCalledTimes(1);
});

test('background settings require admin, reject caller targets and never trigger a read', async () => {
  const app = express(), router = express.Router();
  const service = { read: jest.fn(async () => ({ enabled: false })), setEnabled: jest.fn(async () => ({ enabled: true })), check: jest.fn() };
  app.use(express.json());
  app.use((req, _res, next) => { if (req.headers.authorization) req.user = { role: req.headers.authorization }; next(); });
  registerManualRoutingCheckRoute(router, { requireAdmin, limiter: (_req, _res, next) => next(), service });
  app.use(router);
  app.use((err, _req, res, _next) => res.status(err.statusCode || 400).json({ error: 'Invalid request' }));
  await request(app).get('/manual-routing/12/background').expect(401);
  await request(app).post('/manual-routing/12/background').set('Authorization', 'viewer').send({ enabled: true }).expect(403);
  await request(app).post('/manual-routing/12/background').set('Authorization', 'admin').send({ enabled: 'true' }).expect(400);
  await request(app).post('/manual-routing/12/background').set('Authorization', 'admin').send({ enabled: true, url: 'untrusted' }).expect(400);
  const response = await request(app).get('/manual-routing/12/background').set('Authorization', 'admin').expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  await request(app).post('/manual-routing/12/background').set('Authorization', 'admin').send({ enabled: true }).expect(200);
  expect(service.setEnabled).toHaveBeenCalledWith(12, true);
  expect(service.check).not.toHaveBeenCalled();
});
