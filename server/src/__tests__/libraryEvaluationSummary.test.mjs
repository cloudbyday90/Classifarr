import { jest, describe, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createQueueRouter } from '../routes/queueRouteShared.mjs';
import { createLearnedEvidenceEvaluationControl } from '../services/learnedEvidenceEvaluationControl.mjs';
import { LIBRARY_EVALUATION_COUNTERS, readLibraryEvaluationSummary } from '../services/libraryEvaluationSummary.mjs';
import { createInventoryRepresentativeShadow } from '../services/inventoryRepresentativeShadow.mjs';
import { projectRepresentativeShadowSummary } from '../services/inventoryRepresentativeShadowSummary.mjs';

test('optional profile counters are redacted, bounded and remain admin-only', async () => {
  const representative = createInventoryRepresentativeShadow().read();
  representative.counts.agrees = 2;
  representative.counts.initialization_sensitive = 3;
  representative.counts.partial_agrees = 4;
  representative.counts.partial_disagrees = 1;
  representative.counts.incomplete_profiles = 6;
  representative.privateText = 'PRIVATE title'; representative.counts.secret = 'PRIVATE vector';
  representative.latency.secret = 'PRIVATE timing';
  const source = { ...createLearnedEvidenceEvaluationControl().read(), representative };
  const { app } = appFor(() => source);
  const response = await request(app).get('/api/queue/live-stats').set('Authorization', 'test').expect(200);
  expect(response.body.libraryEvaluation.representative.counts.agrees).toBe(2);
  expect(response.body.libraryEvaluation.representative.version).toBe('inventory_representative_shadow_v3');
  expect(response.body.libraryEvaluation.representative.counts.initialization_sensitive).toBe(3);
  expect(response.body.libraryEvaluation.representative.counts).toMatchObject({ partial_agrees: 4, partial_disagrees: 1, incomplete_profiles: 6 });
  expect(response.body.libraryEvaluation.representative.counts).not.toHaveProperty('unstable_profiles');
  expect(JSON.stringify(response.body)).not.toContain('PRIVATE');
  const viewer = appFor(() => source, 'viewer');
  expect((await request(viewer.app).get('/api/queue/live-stats').set('Authorization', 'test')).body.libraryEvaluation).toBeUndefined();
  response.body.libraryEvaluation.representative.counts.agrees = 9;
  expect(representative.counts.agrees).toBe(2);
});

test.each([
  value => { value.version = 'future'; }, value => { value.routingAffected = true; },
  value => { value.version = 'inventory_representative_shadow_v1'; },
  value => { delete value.counts.initialization_sensitive; }, value => { value.counts.tied_destinations = 0.5; },
  value => { delete value.counts.partial_agrees; }, value => { value.counts.partial_disagrees = -1; },
  value => { value.counts.incomplete_profiles = 1_000_001; },
  value => { value.status = 'unavailable'; }, value => { value.pending = 33; },
  value => { value.counts.agrees = -1; }, value => { value.counts = null; },
  value => { value.latency.under_1ms = Infinity; }, value => { value.latency = null; },
])('invalid optional counters do not hide existing library evaluation', mutate => {
  const representative = createInventoryRepresentativeShadow().read(); mutate(representative);
  expect(projectRepresentativeShadowSummary(representative)).toBeNull();
  const result = readLibraryEvaluationSummary(() => ({ ...createLearnedEvidenceEvaluationControl().read(), representative }));
  expect(result.status).toBe('available'); expect(result.representative).toBeUndefined();
});

describe('library evaluation summary', () => {
  test('projects only bounded counters, without mutating the source or granting routing', () => {
    const control = createLearnedEvidenceEvaluationControl();
    control.record('strict_qualified_admin_held');
    const source = { ...control.read(), privateText: 'must not escape' };
    source.counts.privateText = 'must not escape';
    const result = readLibraryEvaluationSummary(() => source);
    expect(Object.keys(result)).toEqual(['version', 'status', 'routingAffected', 'counts']);
    expect(Object.keys(result.counts)).toEqual(LIBRARY_EVALUATION_COUNTERS);
    expect(result.counts.strict_qualified_admin_held).toBe(1);
    expect(result.routingAffected).toBe(false);
    expect(JSON.stringify(result)).not.toContain('must not escape');
    result.counts.qualified = 80;
    expect(control.read().counts.qualified).toBe(0);
    expect(readLibraryEvaluationSummary(control.read).counts.qualified).toBe(0);
  });

  test.each([null, undefined, {}, { version: 'future' }, { version: 'learned_evidence_evaluation_v1', automaticRouteAllowed: true }])('fails closed on invalid sources: %j', source => {
    expect(readLibraryEvaluationSummary(() => source)).toEqual({
      version: 'library_evaluation_summary_v1', status: 'unavailable', routingAffected: false,
    });
  });

  test.each([-1, 1.2, NaN, Infinity, '1', null, undefined, 1_000_001])('rejects malformed counts: %s', count => {
    const source = createLearnedEvidenceEvaluationControl().read();
    source.counts.busy = count;
    expect(readLibraryEvaluationSummary(() => source).status).toBe('unavailable');
  });

  test('handles missing counts, reader failure and saturation', () => {
    expect(readLibraryEvaluationSummary(() => { throw new Error('private failure'); }).status).toBe('unavailable');
    const source = createLearnedEvidenceEvaluationControl().read();
    expect(readLibraryEvaluationSummary(() => ({ ...source, counts: null })).status).toBe('unavailable');
    source.counts.busy = 1_000_000;
    expect(readLibraryEvaluationSummary(() => source).counts.busy).toBe(1_000_000);
  });
});

function appFor(readStatus, role = 'admin') {
  const app = express();
  const getLiveStats = jest.fn(async () => ({ queue: { pending: 2 }, libraryEvaluation: 'untrusted' }));
  app.use('/api/queue', createQueueRouter({
    express, queueService: { getLiveStats }, logger: {}, readLibraryEvaluationStatus: readStatus,
    authenticateTokenOrApiKey: (req, res, next) => {
      if (!req.headers.authorization) return res.sendStatus(401);
      req.user = role ? { role } : undefined;
      next();
    },
    requireReadWrite: () => { throw new Error('Status must never request write authority'); },
  }));
  return { app, getLiveStats };
}

describe('live stats evaluation boundary', () => {
  test('authenticates before reading either source', async () => {
    const read = jest.fn();
    const { app, getLiveStats } = appFor(read);
    await request(app).get('/api/queue/live-stats').expect(401);
    expect(read).not.toHaveBeenCalled();
    expect(getLiveStats).not.toHaveBeenCalled();
  });
  test.each(['viewer', 'user', 'Admin', null])('omits the aggregate and does not read it for role %s', async role => {
    const read = jest.fn();
    const { app } = appFor(read, role);
    const response = await request(app).get('/api/queue/live-stats?role=admin').set('Authorization', 'test').expect(200);
    expect(response.body).toEqual({ queue: { pending: 2 } });
    expect(read).not.toHaveBeenCalled();
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.vary).toContain('Authorization');
  });
  test('reads the same live instance on every administrator refresh and does not accumulate resets', async () => {
    let control = createLearnedEvidenceEvaluationControl();
    const read = jest.fn(() => control.read());
    const { app } = appFor(read);
    const fetch = () => request(app).get('/api/queue/live-stats').set('Authorization', 'test').expect(200);
    control.record('qualified');
    expect((await fetch()).body.libraryEvaluation.counts.qualified).toBe(1);
    control.record('qualified');
    expect((await fetch()).body.libraryEvaluation.counts.qualified).toBe(2);
    control = createLearnedEvidenceEvaluationControl();
    expect((await fetch()).body.libraryEvaluation.counts.qualified).toBe(0);
    expect(read).toHaveBeenCalledTimes(3);
  });
  test('keeps operational stats available when evaluation status fails', async () => {
    const { app } = appFor(() => { throw new Error('private'); });
    const response = await request(app).get('/api/queue/live-stats').set('Authorization', 'test').expect(200);
    expect(response.body.queue.pending).toBe(2);
    expect(response.body.libraryEvaluation.status).toBe('unavailable');
    expect(JSON.stringify(response.body)).not.toContain('private');
  });
});
