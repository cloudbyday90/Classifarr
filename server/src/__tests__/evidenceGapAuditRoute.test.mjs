/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/apiKeyAuth.mjs';
import { registerEvidenceGapAuditRoutes } from '../routes/statsRouteEvidenceGapAudit.mjs';
import { gapAuditReport } from './fixtures/evidenceGapAuditFixture.mjs';

function setup() {
  const report = gapAuditReport();
  const client = { query: jest.fn(async sql => ({ rows: sql.includes('AS checked_at')
    ? [{ checked_at: new Date(report.window.until) }] : sql.includes('to_regclass') ? [{ installed: true }]
      : sql.includes('FROM automatic_evidence_gap_audit') ? [{ status: 'complete', report,
        observed_at: new Date(report.window.until), next_check_at: new Date(Date.parse(report.window.until) + 300000) }] : [] })) };
  const db = { withTransaction: jest.fn(fn => fn(client)) }, app = express(), router = express.Router();
  app.use((req, _res, next) => { req.user = { role: req.get('x-test-role') || 'viewer' }; next(); });
  registerEvidenceGapAuditRoutes(router, { db, requireAdmin, rateLimit });
  app.use('/api/stats', router); return { app, db, client };
}
test('protected parameter-free GET reads saved counts only and never runs the audit', async () => {
  const { app, db, client } = setup();
  expect((await request(app).get('/api/stats/evidence-gap-audit').expect(403)).headers['cache-control']).toBe('no-store');
  await request(app).get('/api/stats/evidence-gap-audit?run=true').set('x-test-role', 'admin').expect(400);
  expect(db.withTransaction).not.toHaveBeenCalled();
  const response = await request(app).get('/api/stats/evidence-gap-audit').set('x-test-role', 'admin').expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toMatchObject({ status: 'complete', report: { comparisons: { inspected: 0 } } });
  expect(db.withTransaction.mock.calls[0][1]).toMatchObject({ readOnly: true, isolationLevel: 'repeatable_read', timeoutMs: 5000 });
  expect(client.query.mock.calls.every(([sql]) => !/\b(INSERT|UPDATE|DELETE)\b/.test(sql))).toBe(true);
  expect(JSON.stringify(response.body)).not.toMatch(/classification_id|fingerprint|identity_key/);
  await request(app).post('/api/stats/evidence-gap-audit').set('x-test-role', 'admin').expect(404);
});
test('optional schema absence and transport failure remain distinct from zero gaps', async () => {
  const { app, client, db } = setup(), original = client.query.getMockImplementation();
  client.query.mockImplementation(sql => sql.includes('to_regclass') ? { rows: [{ installed: false }] } : original(sql));
  expect((await request(app).get('/api/stats/evidence-gap-audit').set('x-test-role', 'admin').expect(200)).body)
    .toMatchObject({ status: 'unavailable', report: null });
  db.withTransaction.mockRejectedValue(new Error('PRIVATE secret SQL'));
  expect((await request(app).get('/api/stats/evidence-gap-audit').set('x-test-role', 'admin').expect(503)).body)
    .toEqual({ error: 'Evidence gap audit is unavailable' });
  expect(() => registerEvidenceGapAuditRoutes(express.Router(), { db })).toThrow('protected');
});
