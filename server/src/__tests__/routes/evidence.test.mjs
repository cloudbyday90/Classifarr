/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for routes/evidence.js
 *
 * Phase 6 - Layer 4 admin surface for the classification_evidence table.
 * Auth middleware is intentionally bypassed; the router is mounted without it.
 */

import { jest } from '@jest/globals';
import request from 'supertest';

import { createEvidenceRouteTestApp } from '../setup/createEvidenceRouteTestApp.mjs';

const repo = {
  getSummary: jest.fn(),
  findPaginated: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  purgeByFilter: jest.fn(),
};

const diagnostics = {
  diagnose: jest.fn(),
};

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const BASE_ROW = {
  id: 42,
  scope: 'item_exact',
  provenance: 'human_confirmed',
  status: 'active',
  confidence: 100,
  usage_count: 3,
  success_rate: 0.9,
  tmdb_id: 550,
  media_type: 'movie',
  library_id: 1,
};

function buildEvidenceApp({ withUser = false } = {}) {
  jest.clearAllMocks();

  return createEvidenceRouteTestApp({
    classificationEvidenceRepository: repo,
    evidenceDiagnosticsService: diagnostics,
    logger,
    user: withUser ? { id: 'test_user' } : null,
  });
}

describe('GET /evidence/summary', () => {
  let app;

  beforeEach(() => {
    app = buildEvidenceApp();
  });

  it('returns the summary from the repository', async () => {
    const summary = { byScope: { item_exact: 5 }, byProvenance: {}, byStatus: {}, total: 5 };
    repo.getSummary.mockResolvedValueOnce(summary);

    const res = await request(app).get('/evidence/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(summary);
    expect(repo.getSummary).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on repository error', async () => {
    repo.getSummary.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/evidence/summary');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.message).toBe('db down');
  });
});

describe('GET /evidence', () => {
  let app;

  beforeEach(() => {
    app = buildEvidenceApp();
  });

  it('calls findPaginated with default limit/offset when no query params', async () => {
    repo.findPaginated.mockResolvedValueOnce({ rows: [BASE_ROW], total: 1 });

    const res = await request(app).get('/evidence');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.rows).toHaveLength(1);
    expect(repo.findPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 })
    );
  });

  it('passes valid scope/provenance/status filters to repository', async () => {
    repo.findPaginated.mockResolvedValueOnce({ rows: [], total: 0 });

    await request(app).get('/evidence?scope=genre&provenance=mined&status=candidate&limit=10&offset=20');

    expect(repo.findPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'genre',
        provenance: 'mined',
        status: 'candidate',
        limit: 10,
        offset: 20,
      })
    );
  });

  it('silently drops invalid scope/provenance filters (allowlist)', async () => {
    repo.findPaginated.mockResolvedValueOnce({ rows: [], total: 0 });

    await request(app).get('/evidence?scope=INVALID&provenance=__proto__');

    const call = repo.findPaginated.mock.calls[0][0];
    expect(call.scope).toBeNull();
    expect(call.provenance).toBeNull();
  });

  it('caps limit at 200', async () => {
    repo.findPaginated.mockResolvedValueOnce({ rows: [], total: 0 });

    await request(app).get('/evidence?limit=9999');

    const call = repo.findPaginated.mock.calls[0][0];
    expect(call.limit).toBe(50);
  });

  it('returns 500 on repository error', async () => {
    repo.findPaginated.mockRejectedValueOnce(new Error('timeout'));

    const res = await request(app).get('/evidence');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.message).toBe('timeout');
  });
});

describe('GET /evidence/:id', () => {
  let app;

  beforeEach(() => {
    app = buildEvidenceApp();
  });

  it('returns the row for a valid numeric ID', async () => {
    repo.findById.mockResolvedValueOnce(BASE_ROW);

    const res = await request(app).get('/evidence/42');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(42);
  });

  it('returns 404 when row does not exist', async () => {
    repo.findById.mockResolvedValueOnce(null);

    const res = await request(app).get('/evidence/9999');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 400 for non-numeric ID', async () => {
    const res = await request(app).get('/evidence/abc');

    expect(res.status).toBe(400);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('returns 500 on repository error', async () => {
    repo.findById.mockRejectedValueOnce(new Error('query error'));

    const res = await request(app).get('/evidence/1');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
  });
});

describe('GET /evidence/:id/diagnose', () => {
  let app;

  beforeEach(() => {
    app = buildEvidenceApp();
  });

  it('returns combined row + diagnosis', async () => {
    repo.findById.mockResolvedValueOnce(BASE_ROW);
    const fakeDiagnosis = { evidenceId: 42, agreement: { consistent: true } };
    diagnostics.diagnose.mockResolvedValueOnce(fakeDiagnosis);

    const res = await request(app).get('/evidence/42/diagnose');

    expect(res.status).toBe(200);
    expect(res.body.evidence).toEqual(BASE_ROW);
    expect(res.body.diagnosis).toEqual(fakeDiagnosis);
  });

  it('returns 404 when the evidence row does not exist', async () => {
    repo.findById.mockResolvedValueOnce(null);

    const res = await request(app).get('/evidence/1/diagnose');

    expect(res.status).toBe(404);
    expect(diagnostics.diagnose).not.toHaveBeenCalled();
  });

  it('returns 400 for non-numeric ID', async () => {
    const res = await request(app).get('/evidence/bad/diagnose');

    expect(res.status).toBe(400);
  });
});

describe('POST /evidence/:id/decay', () => {
  let app;

  beforeEach(() => {
    app = buildEvidenceApp({ withUser: true });
  });

  it('decays an active row to candidate status', async () => {
    repo.findById.mockResolvedValueOnce({ ...BASE_ROW, status: 'active' });
    const updated = { ...BASE_ROW, status: 'candidate' };
    repo.updateStatus.mockResolvedValueOnce(updated);

    const res = await request(app).post('/evidence/42/decay');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
    expect(res.body.row.status).toBe('candidate');
    expect(repo.updateStatus).toHaveBeenCalledWith({ id: 42, status: 'candidate', actor: 'test_user' });
  });

  it('returns changed:false when row is already candidate', async () => {
    repo.findById.mockResolvedValueOnce({ ...BASE_ROW, status: 'candidate' });

    const res = await request(app).post('/evidence/42/decay');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(false);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when the evidence row does not exist', async () => {
    repo.findById.mockResolvedValueOnce(null);

    const res = await request(app).post('/evidence/100/decay');

    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric ID', async () => {
    const res = await request(app).post('/evidence/nan/decay');

    expect(res.status).toBe(400);
  });
});

describe('POST /evidence/:id/promote', () => {
  let app;

  beforeEach(() => {
    app = buildEvidenceApp({ withUser: true });
  });

  it('promotes a candidate row to active', async () => {
    repo.findById.mockResolvedValueOnce({ ...BASE_ROW, status: 'candidate' });
    const updated = { ...BASE_ROW, status: 'active' };
    repo.updateStatus.mockResolvedValueOnce(updated);

    const res = await request(app).post('/evidence/42/promote');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
    expect(repo.updateStatus).toHaveBeenCalledWith({ id: 42, status: 'active', actor: 'test_user' });
  });

  it('returns changed:false when row is already active', async () => {
    repo.findById.mockResolvedValueOnce({ ...BASE_ROW, status: 'active' });

    const res = await request(app).post('/evidence/42/promote');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(false);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when the evidence row does not exist', async () => {
    repo.findById.mockResolvedValueOnce(null);

    const res = await request(app).post('/evidence/1/promote');

    expect(res.status).toBe(404);
  });
});

describe('POST /evidence/purge', () => {
  let app;

  beforeEach(() => {
    app = buildEvidenceApp({ withUser: true });
  });

  it('returns 400 when no filters are provided', async () => {
    const res = await request(app).post('/evidence/purge').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/filter/i);
    expect(repo.purgeByFilter).not.toHaveBeenCalled();
  });

  it('returns 400 when filters contain only invalid values', async () => {
    const res = await request(app).post('/evidence/purge').send({ scope: 'BOGUS', provenance: 'INVALID' });

    expect(res.status).toBe(400);
    expect(repo.purgeByFilter).not.toHaveBeenCalled();
  });

  it('calls purgeByFilter with sanitized filter and returns deleted count', async () => {
    repo.purgeByFilter.mockResolvedValueOnce({ deleted: 7 });

    const res = await request(app)
      .post('/evidence/purge')
      .send({ scope: 'genre', provenance: 'mined' });

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(7);
    expect(repo.purgeByFilter).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'genre', provenance: 'mined' })
    );
  });

  it('returns 500 on repository error', async () => {
    repo.purgeByFilter.mockRejectedValueOnce(new Error('constraint violation'));

    const res = await request(app)
      .post('/evidence/purge')
      .send({ scope: 'studio' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.message).toBe('constraint violation');
  });
});