/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { authenticateToken, requireAdmin } = await import('../../middleware/auth.mjs');
const { generateAccessToken } = await import('../../services/auth.mjs');
const { createWebSearchProviderSettingsHandlers } = await import('../../routes/helpers/webSearchProviderSettingsHandlers.mjs');
const { WebSearchProviderHealthHistory } = await import('../../services/webSearchProviderHealthHistory.mjs');
const { WebSearchProviderRouteHistory } = await import('../../services/webSearchProviderRouteHistory.mjs');
const { WebSearchProviderOutcomeFeedbackService } = await import('../../services/webSearchProviderOutcomeFeedback.mjs');

const providerKey = 'brave';
const diagnosticsPath = '/web-search/providers/route-diagnostics';
const routeHistory = new WebSearchProviderRouteHistory({ db });
const healthHistory = new WebSearchProviderHealthHistory({ db });
const { getRouteDiagnostics } = createWebSearchProviderSettingsHandlers({
  db,
  webSearchProviderRouter: { getRouteCandidates: async () => [] },
  webSearchProviderRouteHistory: routeHistory,
  webSearchProviderHealthHistory: healthHistory,
});
const router = express.Router();
router.get(diagnosticsPath, authenticateToken, requireAdmin, getRouteDiagnostics);
const app = createIntegrationTestApp({ basePath: '/api/settings', router });
const diagnosticsUrl = `/api/settings${diagnosticsPath}`;
let adminToken;
let userToken;

beforeAll(async () => {
  const { rows } = await db.query(`
    INSERT INTO users (username, password_hash, role, is_active)
    VALUES ('web-search-fixture-admin', 'fixture', 'admin', true),
           ('web-search-fixture-user', 'fixture', 'user', true)
    RETURNING id, username, role
  `);
  adminToken = await generateAccessToken(rows.find(({ role }) => role === 'admin'));
  userToken = await generateAccessToken(rows.find(({ role }) => role === 'user'));
});

async function recordDiagnostics(correlationId, classificationId) {
  const route = await routeHistory.recordDecisionSafely({
    request: { purpose: 'classification', traceContext: { correlationId, classificationId } },
    outcome: 'success',
    selectedProviderKey: providerKey,
    finalProviderKey: providerKey,
  });
  const health = await healthHistory.recordUsageEventSafely(providerKey, {
    status: 'success', purpose: 'classification', operation: 'search', correlationId, classificationId,
  });
  return { route, health };
}

test('preserves adjacent History IDs in both records, administrator JSON, and outcome feedback', async () => {
  const lower = '9007199254740992';
  const upper = '9007199254740993';
  await db.query(`
    INSERT INTO classification_history (id, title, media_type, status)
    VALUES ($1, 'Fixture positive outcome', 'movie', 'routed'),
           ($2, 'Fixture negative outcome', 'movie', 'failed')
  `, [lower, upper]);

  const expected = [
    { correlationId: 'neighbor-a', classificationId: lower },
    { correlationId: 'neighbor-b', classificationId: upper },
  ];
  const saved = [];
  for (const { correlationId, classificationId } of expected) {
    saved.push(await recordDiagnostics(correlationId, classificationId));
  }

  const storedRoutes = await db.query(`
    SELECT correlation_id AS "correlationId", classification_id::text AS "classificationId"
    FROM web_search_provider_route_decisions WHERE correlation_id = ANY($1) ORDER BY correlation_id
  `, [expected.map(({ correlationId }) => correlationId)]);
  const storedHealth = await db.query(`
    SELECT correlation_id AS "correlationId", classification_id::text AS "classificationId"
    FROM web_search_provider_health_events WHERE correlation_id = ANY($1) ORDER BY correlation_id
  `, [expected.map(({ correlationId }) => correlationId)]);
  expect(storedRoutes.rows).toEqual(expected);
  expect(storedHealth.rows).toEqual(expected);
  for (const [index, pair] of saved.entries()) {
    expect(pair).toMatchObject({ route: expected[index], health: expected[index] });
  }

  await request(app).get(diagnosticsUrl).expect(401);
  await request(app).get(diagnosticsUrl).set('Authorization', `Bearer ${userToken}`).expect(403);
  const { body } = await request(app).get(diagnosticsUrl)
    .set('Authorization', `Bearer ${adminToken}`).expect(200);
  expect(body.recentDecisions).toEqual(expect.arrayContaining(expected.map((row) => expect.objectContaining(row))));
  expect(body.recentHealthEvents).toEqual(expect.arrayContaining(expected.map((row) => expect.objectContaining(row))));

  const feedback = await new WebSearchProviderOutcomeFeedbackService({ db })
    .getProviderOutcomeFeedbackSummaries([providerKey]);
  expect(feedback.get(providerKey)).toMatchObject({ positiveOutcomes: 1, negativeOutcomes: 1, outcomeSignalCount: 2 });
});

test.each([
  ['safe number', 42, 42],
  ['safe decimal', '2147483648', 2147483648],
  ['BIGINT maximum', '9223372036854775807', '9223372036854775807'],
  ['BIGINT overflow', '9223372036854775808', null],
  ['unsafe number', Number.MAX_SAFE_INTEGER + 1, null],
  ['partial input', '42suffix', null],
  ['padded input', '042', null],
  ['zero', 0, null],
  ['omitted ID', undefined, null],
])('stores both diagnostics with a precise optional link for %s', async (label, input, expected) => {
  const { route, health } = await recordDiagnostics(`range-${label}`, input);
  expect(route).toMatchObject({ classificationId: expected });
  expect(health).toMatchObject({ classificationId: expected });
});
