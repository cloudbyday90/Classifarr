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
