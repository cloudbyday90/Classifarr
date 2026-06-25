/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createWebSearchProviderSettingsHandlers } from '../routes/helpers/webSearchProviderSettingsHandlers.mjs';

function createApp(handlers) {
  const app = express();
  app.use(express.json());
  app.get('/settings/web-search/providers', handlers.listProviders);
  app.get('/settings/web-search/providers/route-diagnostics', handlers.getRouteDiagnostics);
  app.get('/settings/web-search/provider-calibration-policies', handlers.listCalibrationPolicies);
  app.get('/settings/web-search/provider-calibration-policies/coverage', handlers.getCalibrationPolicyCoverage);
  app.get('/settings/web-search/provider-guardrail-thresholds', handlers.getGuardrailThresholds);
  app.put('/settings/web-search/provider-guardrail-thresholds', handlers.updateGuardrailThresholds);
  app.get('/settings/web-search/provider-guardrail-analytics', handlers.getGuardrailAnalytics);
  app.get('/settings/web-search/provider-guardrail-digest', handlers.getGuardrailDigest);
  app.post('/settings/web-search/provider-calibration-policies/:purpose/preview', handlers.previewCalibrationPolicy);
  app.put('/settings/web-search/provider-calibration-policies/:purpose', handlers.updateCalibrationPolicy);
  app.put('/settings/web-search/providers/:providerKey', handlers.updateProvider);
  app.post('/settings/web-search/providers/:providerKey/test', handlers.testProvider);
  // Mirror the app error middleware shape closely enough for route tests.
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || error.status || 500).json(error.toJSON?.() || { error: error.message });
  });
  return app;
}

function createStorage(overrides = {}) {
  return {
    withDb: jest.fn(() => ({
      upsertProviderConfig: jest.fn(async (payload) => ({
        ...payload,
        apiKey: payload.clearApiKey ? null : (payload.apiKey || 'stored-key'),
      })),
    })),
    listProviderConfigs: jest.fn(async () => []),
    getProviderConfig: jest.fn(async () => null),
    upsertProviderConfig: jest.fn(async (payload) => payload),
    ...overrides,
  };
}

function createRegistry(overrides = {}) {
  return {
    getMetadata: jest.fn((providerKey) => ({
      providerKey,
      displayName: providerKey === 'tavily' ? 'Tavily' : 'Brave Search',
      priority: providerKey === 'tavily' ? 10 : 20,
    })),
    getAdapter: jest.fn(() => null),
    enrichConfig: jest.fn((config) => ({
      ...config,
      adapterAvailable: config.providerKey === 'tavily',
    })),
    ...overrides,
  };
}

function createRouter(overrides = {}) {
  return {
    nowFn: () => new Date('2026-06-19T12:00:00.000Z'),
    getRouteCandidates: jest.fn(async () => []),
    ...overrides,
  };
}

function createRouteHistory(overrides = {}) {
  return {
    listRecentDecisions: jest.fn(async () => []),
    ...overrides,
  };
}

function createHealthHistory(overrides = {}) {
  return {
    listRecentEvents: jest.fn(async () => []),
    ...overrides,
  };
}

function createCalibrationPolicyService(overrides = {}) {
  return {
    listPolicies: jest.fn(async () => []),
    listPolicyCoverage: jest.fn(async () => ({
      generatedAt: '2026-06-25T04:00:00.000Z',
      totalPurposes: 0,
      knownPurposeCount: 0,
      explicitPolicyCount: 0,
      fallbackPolicyCount: 0,
      purposes: [],
    })),
    upsertPolicy: jest.fn(async (payload) => ({
      purpose: payload.purpose,
      isEnabled: payload.isEnabled ?? true,
      lookbackDays: payload.lookbackDays ?? 14,
      minimumSamples: payload.minimumSamples ?? 3,
      maximumPriorityPenalty: payload.maximumPriorityPenalty ?? 25,
      outcomeWeight: payload.outcomeWeight ?? 15,
    })),
    ...overrides,
  };
}

function createCalibrationPreviewService(overrides = {}) {
  return {
    previewPolicy: jest.fn(async (payload) => ({
      purpose: payload.purpose,
      generatedAt: '2026-06-25T04:00:00.000Z',
      selectedProviderKeyBefore: 'tavily',
      selectedProviderKeyAfter: 'brave',
      selectedProviderChanged: true,
      candidateCount: 2,
      policy: payload,
      current: { candidates: [] },
      preview: { candidates: [] },
      changes: [],
    })),
    ...overrides,
  };
}

function createGuardrailThresholdService(overrides = {}) {
  return {
    getThresholds: jest.fn(async () => ({
      enabled: true,
      lowSampleMultiplier: 1,
      recentHealthLookbackCount: 10,
      selectionChangeSeverity: 'info',
      lowSampleSeverity: 'warning',
      healthIssueSeverity: 'warning',
      cooldownSeverity: 'critical',
      noProviderSeverity: 'critical',
    })),
    updateThresholds: jest.fn(async (payload) => ({
      enabled: payload.enabled ?? true,
      lowSampleMultiplier: payload.lowSampleMultiplier ?? 1,
      recentHealthLookbackCount: payload.recentHealthLookbackCount ?? 10,
      selectionChangeSeverity: payload.selectionChangeSeverity || 'info',
      lowSampleSeverity: payload.lowSampleSeverity || 'warning',
      healthIssueSeverity: payload.healthIssueSeverity || 'warning',
      cooldownSeverity: payload.cooldownSeverity || 'critical',
      noProviderSeverity: payload.noProviderSeverity || 'critical',
    })),
    ...overrides,
  };
}

function createGuardrailAnalyticsService(overrides = {}) {
  return {
    summarize: jest.fn(async () => ({
      generatedAt: '2026-06-25T05:00:00.000Z',
      lookbackDays: 30,
      totalCount: 3,
      criticalCount: 1,
      warningCount: 1,
      infoCount: 1,
      purposeCount: 2,
      latestAt: '2026-06-25T04:59:00.000Z',
      codes: [
        {
          guardrailCode: 'selected_provider_low_samples',
          totalCount: 2,
          criticalCount: 1,
          warningCount: 1,
          infoCount: 0,
          providerCount: 1,
          latestAt: '2026-06-25T04:59:00.000Z',
        },
      ],
      purposes: [
        {
          purpose: 'classification',
          totalCount: 2,
          latestAt: '2026-06-25T04:59:00.000Z',
        },
      ],
    })),
    ...overrides,
  };
}

function createGuardrailDigestService(overrides = {}) {
  return {
    buildDigest: jest.fn(async () => ({
      generatedAt: '2026-06-25T05:05:00.000Z',
      level: 'attention',
      lookbackDays: 7,
      policy: {
        lookbackDays: 7,
        maxFindings: 5,
        criticalEventThreshold: 1,
        warningEventThreshold: 5,
        totalEventThreshold: 10,
      },
      summary: {
        totalCount: 3,
        criticalCount: 1,
        warningCount: 1,
        infoCount: 1,
        purposeCount: 2,
        latestAt: '2026-06-25T04:59:00.000Z',
      },
      findings: [
        {
          guardrailCode: 'selected_provider_recent_health_issue',
          level: 'attention',
          dominantSeverity: 'critical',
          totalCount: 1,
          criticalCount: 1,
          warningCount: 0,
          infoCount: 0,
          providerCount: 1,
          latestAt: '2026-06-25T04:59:00.000Z',
          message: 'Preview-selected providers have repeated recent health or cooldown signals.',
          recommendation: 'Inspect provider health history and cooldown settings before relying on this provider for the purpose.',
        },
      ],
      message: 'Guardrail activity crossed digest thresholds and should be reviewed before further calibration changes.',
    })),
    ...overrides,
  };
}

describe('webSearchProviderSettingsHandlers', () => {
  test('lists provider configs through the registry read model', async () => {
    const storage = createStorage({
      listProviderConfigs: jest.fn(async () => [{
        providerKey: 'tavily',
        displayName: 'Tavily',
        apiKey: '••••••••-key',
        configured: true,
      }]),
    });
    const registry = createRegistry();
    const handlers = createWebSearchProviderSettingsHandlers({
      db: { query: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn() },
      webSearchProviderStorage: storage,
      webSearchProviderRegistry: registry,
      webSearchProviderRouter: createRouter(),
    });

    const res = await request(createApp(handlers)).get('/settings/web-search/providers');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({
      providerKey: 'tavily',
      adapterAvailable: true,
      configured: true,
    })]);
    expect(storage.listProviderConfigs).toHaveBeenCalledWith({
      includeDisabled: true,
      includeLegacyBridge: true,
      maskSecrets: true,
    });
  });

  test('returns a safe route diagnostic projection', async () => {
    const router = createRouter({
      getRouteCandidates: jest.fn(async () => [{
        providerKey: 'tavily',
        displayName: 'Tavily',
        priority: 10,
        status: 'available',
        skipReason: null,
        adapter: { providerKey: 'tavily' },
        config: {
          isEnabled: true,
          configured: true,
          apiKey: 'sensitive-api-key',
          config: { projectId: 'sensitive-project' },
        },
        quota: { dailyCostUnits: 2, monthlyCostUnits: 7 },
        usageSummary: { dailyRequestCount: 2, monthlyRequestCount: 7 },
      }]),
    });
    const routeHistory = createRouteHistory({
      listRecentDecisions: jest.fn(async () => [{
        id: 1,
        routeId: '29994c13-e52d-4813-8051-0960ed27d495',
        outcome: 'success',
        selectedProviderKey: 'tavily',
        finalProviderKey: 'tavily',
      }]),
    });
    const healthHistory = createHealthHistory({
      listRecentEvents: jest.fn(async () => [{
        id: 2,
        providerKey: 'tavily',
        eventType: 'cooldown_started',
        healthStatus: 'cooldown',
        errorCode: 'rate_limited',
        cooldownUntil: '2026-06-19T12:05:00.000Z',
      }]),
    });
    const handlers = createWebSearchProviderSettingsHandlers({
      db: { query: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn() },
      webSearchProviderStorage: createStorage(),
      webSearchProviderRegistry: createRegistry(),
      webSearchProviderRouter: router,
      webSearchProviderRouteHistory: routeHistory,
      webSearchProviderHealthHistory: healthHistory,
    });

    const res = await request(createApp(handlers)).get('/settings/web-search/providers/route-diagnostics');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      evaluatedAt: '2026-06-19T12:00:00.000Z',
      selectedProviderKey: 'tavily',
      candidates: [expect.objectContaining({
        providerKey: 'tavily',
        configured: true,
        adapterAvailable: true,
      })],
      recentDecisions: [expect.objectContaining({
        outcome: 'success',
        selectedProviderKey: 'tavily',
      })],
      recentHealthEvents: [expect.objectContaining({
        providerKey: 'tavily',
        eventType: 'cooldown_started',
        healthStatus: 'cooldown',
      })],
    }));
    expect(routeHistory.listRecentDecisions).toHaveBeenCalledWith({ limit: 10 });
    expect(healthHistory.listRecentEvents).toHaveBeenCalledWith({ limit: 10 });
    expect(JSON.stringify(res.body)).not.toContain('sensitive');
  });

  test('lists and updates purpose-specific calibration policies', async () => {
    const calibrationPolicyService = createCalibrationPolicyService({
      listPolicies: jest.fn(async () => [{
        purpose: 'classification',
        isEnabled: true,
        lookbackDays: 14,
        minimumSamples: 3,
        maximumPriorityPenalty: 25,
        outcomeWeight: 15,
      }]),
      upsertPolicy: jest.fn(async (payload) => ({
        purpose: payload.purpose,
        isEnabled: false,
        lookbackDays: 30,
        minimumSamples: 10,
        maximumPriorityPenalty: 20,
        outcomeWeight: 12,
      })),
      listPolicyCoverage: jest.fn(async () => ({
        generatedAt: '2026-06-25T04:00:00.000Z',
        totalPurposes: 2,
        knownPurposeCount: 2,
        explicitPolicyCount: 1,
        fallbackPolicyCount: 1,
        purposes: [
          {
            purpose: 'classification',
            knownPurpose: true,
            hasExplicitPolicy: true,
            coverageSource: 'explicit',
            status: 'covered',
            fallbackReason: null,
          },
          {
            purpose: 'metadata_enrichment',
            knownPurpose: true,
            hasExplicitPolicy: false,
            coverageSource: 'default',
            status: 'fallback',
            fallbackReason: 'default_policy',
          },
        ],
      })),
    });
    const calibrationPreviewService = createCalibrationPreviewService();
    const logger = { info: jest.fn(), error: jest.fn() };
    const handlers = createWebSearchProviderSettingsHandlers({
      db: { query: jest.fn() },
      logger,
      webSearchProviderStorage: createStorage(),
      webSearchProviderRegistry: createRegistry(),
      webSearchProviderRouter: createRouter(),
      webSearchProviderCalibrationPolicyService: calibrationPolicyService,
      webSearchProviderCalibrationPreviewService: calibrationPreviewService,
    });
    const app = createApp(handlers);

    const listRes = await request(app).get('/settings/web-search/provider-calibration-policies');
    const coverageRes = await request(app).get('/settings/web-search/provider-calibration-policies/coverage');
    const previewRes = await request(app)
      .post('/settings/web-search/provider-calibration-policies/classification/preview')
      .send({
        isEnabled: false,
        lookbackDays: 30,
        minimumSamples: 10,
        maximumPriorityPenalty: 20,
        outcomeWeight: 12,
      });
    const updateRes = await request(app)
      .put('/settings/web-search/provider-calibration-policies/classification')
      .send({
        isEnabled: false,
        lookbackDays: 30,
        minimumSamples: 10,
        maximumPriorityPenalty: 20,
        outcomeWeight: 12,
      });

    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual([expect.objectContaining({ purpose: 'classification' })]);
    expect(coverageRes.status).toBe(200);
    expect(coverageRes.body).toEqual(expect.objectContaining({
      totalPurposes: 2,
      explicitPolicyCount: 1,
      fallbackPolicyCount: 1,
      purposes: [
        expect.objectContaining({ purpose: 'classification', status: 'covered' }),
        expect.objectContaining({ purpose: 'metadata_enrichment', status: 'fallback' }),
      ],
    }));
    expect(previewRes.status).toBe(200);
    expect(previewRes.body).toEqual(expect.objectContaining({
      purpose: 'classification',
      selectedProviderKeyBefore: 'tavily',
      selectedProviderKeyAfter: 'brave',
      selectedProviderChanged: true,
    }));
    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toEqual(expect.objectContaining({
      purpose: 'classification',
      isEnabled: false,
      lookbackDays: 30,
    }));
    expect(calibrationPolicyService.upsertPolicy).toHaveBeenCalledWith(expect.objectContaining({
      purpose: 'classification',
      minimumSamples: 10,
    }));
    expect(calibrationPreviewService.previewPolicy).toHaveBeenCalledWith(expect.objectContaining({
      purpose: 'classification',
      minimumSamples: 10,
    }));
    expect(logger.info).toHaveBeenCalledWith(
      'Web search provider calibration policy updated',
      { purpose: 'classification' }
    );
  });

  test('lists and updates guardrail threshold controls', async () => {
    const guardrailThresholdService = createGuardrailThresholdService();
    const logger = { info: jest.fn(), error: jest.fn() };
    const handlers = createWebSearchProviderSettingsHandlers({
      db: { query: jest.fn() },
      logger,
      webSearchProviderStorage: createStorage(),
      webSearchProviderRegistry: createRegistry(),
      webSearchProviderRouter: createRouter(),
      webSearchProviderGuardrailThresholdService: guardrailThresholdService,
    });
    const app = createApp(handlers);

    const listRes = await request(app).get('/settings/web-search/provider-guardrail-thresholds');
    const updateRes = await request(app)
      .put('/settings/web-search/provider-guardrail-thresholds')
      .send({
        enabled: true,
        lowSampleMultiplier: 2,
        recentHealthLookbackCount: 5,
        lowSampleSeverity: 'critical',
      });

    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual(expect.objectContaining({
      lowSampleMultiplier: 1,
      recentHealthLookbackCount: 10,
    }));
    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toEqual(expect.objectContaining({
      lowSampleMultiplier: 2,
      recentHealthLookbackCount: 5,
      lowSampleSeverity: 'critical',
    }));
    expect(guardrailThresholdService.updateThresholds).toHaveBeenCalledWith(expect.objectContaining({
      lowSampleMultiplier: 2,
    }));
    expect(logger.info).toHaveBeenCalledWith('Web search provider guardrail thresholds updated');
  });

  test('returns sanitized guardrail analytics', async () => {
    const guardrailAnalyticsService = createGuardrailAnalyticsService();
    const handlers = createWebSearchProviderSettingsHandlers({
      db: { query: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn() },
      webSearchProviderStorage: createStorage(),
      webSearchProviderRegistry: createRegistry(),
      webSearchProviderRouter: createRouter(),
      webSearchProviderGuardrailAnalyticsService: guardrailAnalyticsService,
    });

    const res = await request(createApp(handlers))
      .get('/settings/web-search/provider-guardrail-analytics');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      lookbackDays: 30,
      totalCount: 3,
      codes: [
        expect.objectContaining({
          guardrailCode: 'selected_provider_low_samples',
          providerCount: 1,
        }),
      ],
    }));
    expect(guardrailAnalyticsService.summarize).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(res.body)).not.toContain('apiKey');
    expect(JSON.stringify(res.body)).not.toContain('query');
    expect(JSON.stringify(res.body)).not.toContain('trace');
  });

  test('returns sanitized guardrail alert digest', async () => {
    const guardrailDigestService = createGuardrailDigestService();
    const handlers = createWebSearchProviderSettingsHandlers({
      db: { query: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn() },
      webSearchProviderStorage: createStorage(),
      webSearchProviderRegistry: createRegistry(),
      webSearchProviderRouter: createRouter(),
      webSearchProviderGuardrailDigestService: guardrailDigestService,
    });

    const res = await request(createApp(handlers))
      .get('/settings/web-search/provider-guardrail-digest');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      level: 'attention',
      lookbackDays: 7,
      findings: [
        expect.objectContaining({
          guardrailCode: 'selected_provider_recent_health_issue',
          recommendation: expect.stringContaining('provider health history'),
        }),
      ],
    }));
    expect(guardrailDigestService.buildDigest).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(res.body)).not.toContain('apiKey');
    expect(JSON.stringify(res.body)).not.toContain('query');
    expect(JSON.stringify(res.body)).not.toContain('trace');
  });

  test('updates Tavily generic storage and mirrors legacy Tavily config in one transaction', async () => {
    const transactionClient = { query: jest.fn(async () => ({ rows: [] })) };
    const transactionStorage = {
      upsertProviderConfig: jest.fn(async () => ({
        providerKey: 'tavily',
        displayName: 'Tavily',
        isEnabled: true,
        apiKey: 'live-key',
        config: {
          searchDepth: 'advanced',
          maxResults: 6,
          includeDomains: ['imdb.com'],
          excludeDomains: [],
        },
      })),
    };
    const db = {
      withTransaction: jest.fn(async (callback) => callback(transactionClient)),
      query: jest.fn(),
    };
    const storage = createStorage({
      withDb: jest.fn(() => transactionStorage),
      getProviderConfig: jest.fn(async () => ({
        providerKey: 'tavily',
        displayName: 'Tavily',
        configured: true,
      })),
    });
    const handlers = createWebSearchProviderSettingsHandlers({
      db,
      logger: { info: jest.fn(), error: jest.fn() },
      webSearchProviderStorage: storage,
      webSearchProviderRegistry: createRegistry(),
      webSearchProviderRouter: createRouter(),
    });

    const res = await request(createApp(handlers))
      .put('/settings/web-search/providers/tavily')
      .send({
        apiKey: 'live-key',
        isEnabled: true,
        priority: 10,
        config: {
          searchDepth: 'advanced',
          maxResults: 6,
          includeDomains: ['imdb.com'],
          excludeDomains: [],
        },
      });

    expect(res.status).toBe(200);
    expect(transactionStorage.upsertProviderConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        providerKey: 'tavily',
        apiKey: 'live-key',
        config: expect.objectContaining({ maxResults: 6 }),
      }),
      { maskSecrets: false }
    );
    expect(transactionClient.query).toHaveBeenCalledWith('DELETE FROM tavily_config');
    expect(transactionClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tavily_config'),
      ['live-key', 'advanced', 6, ['imdb.com'], [], true]
    );
  });

  test('rejects tests for staged providers without adapters', async () => {
    const handlers = createWebSearchProviderSettingsHandlers({
      db: { query: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn() },
      webSearchProviderStorage: createStorage(),
      webSearchProviderRegistry: createRegistry(),
      webSearchProviderRouter: createRouter(),
    });

    const res = await request(createApp(handlers))
      .post('/settings/web-search/providers/brave/test')
      .send({ apiKey: 'brave-key' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({
      error: 'Web search provider adapter is not available yet',
      code: 'provider_adapter_unavailable',
      providerKey: 'brave',
    }));
  });
});
