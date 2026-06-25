/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../../utils/asyncHandler.mjs';
import { ValidationError } from '../../utils/appError.mjs';
import { sendData } from '../../utils/responseHelpers.mjs';
import { normalizeWebSearchProviderKey } from '../../services/webSearchResultNormalizer.mjs';
import { buildWebSearchProviderRouteDiagnostics } from '../../services/webSearchProviderRouteDiagnostics.mjs';
import {
  buildLegacyTavilyConfigFromProvider,
  buildWebSearchProviderMutationPayload,
} from './webSearchProviderSettingsSupport.mjs';

function storageWithDb(storage, db) {
  return typeof storage.withDb === 'function'
    ? storage.withDb(db)
    : storage;
}

async function mirrorTavilyLegacyConfig(dbClient, providerConfig) {
  const legacyConfig = buildLegacyTavilyConfigFromProvider(providerConfig);

  await dbClient.query('DELETE FROM tavily_config');
  return dbClient.query(
    `INSERT INTO tavily_config
       (api_key, search_depth, max_results, include_domains, exclude_domains, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [
      legacyConfig.apiKey,
      legacyConfig.searchDepth,
      legacyConfig.maxResults,
      legacyConfig.includeDomains,
      legacyConfig.excludeDomains,
      legacyConfig.isActive,
    ]
  );
}

function requireProviderKey(providerKey) {
  const normalizedProviderKey = normalizeWebSearchProviderKey(providerKey);
  if (normalizedProviderKey === 'unknown') {
    throw new ValidationError('Invalid web search provider key', { code: 'invalid_provider_key' });
  }
  return normalizedProviderKey;
}

/**
 * @param {{
 *   db: { query: Function, withTransaction?: Function },
 *   logger?: { error?: Function, info?: Function },
 *   webSearchProviderStorage: {
 *     withDb?: Function,
 *     listProviderConfigs: Function,
 *     getProviderConfig: Function,
 *     upsertProviderConfig: Function,
 *   },
 *   webSearchProviderRouter: { getRouteCandidates: Function, nowFn?: Function },
 *   webSearchProviderRouteHistory?: { listRecentDecisions: Function },
 *   webSearchProviderHealthHistory?: { listRecentEvents: Function },
 *   webSearchProviderRegistry: {
 *     getMetadata: Function,
 *     getAdapter: Function,
 *     enrichConfig: Function,
 *   },
 * }} options
 */
export function createWebSearchProviderSettingsHandlers({
  db,
  logger = console,
  webSearchProviderStorage,
  webSearchProviderRegistry,
  webSearchProviderRouter,
  webSearchProviderRouteHistory,
  webSearchProviderHealthHistory,
}) {
  async function saveProviderConfig(payload) {
    if (typeof db.withTransaction !== 'function') {
      const saved = await webSearchProviderStorage.upsertProviderConfig(payload, { maskSecrets: false });
      if (payload.providerKey === 'tavily') {
        await mirrorTavilyLegacyConfig(db, saved);
      }
      return saved;
    }

    return db.withTransaction(async (client) => {
      const transactionStorage = storageWithDb(webSearchProviderStorage, client);
      const saved = await transactionStorage.upsertProviderConfig(payload, { maskSecrets: false });
      if (payload.providerKey === 'tavily') {
        await mirrorTavilyLegacyConfig(client, saved);
      }
      return saved;
    });
  }

  return {
    listProviders: asyncHandler(async (_req, res) => {
      const configs = await webSearchProviderStorage.listProviderConfigs({
        includeDisabled: true,
        includeLegacyBridge: true,
        maskSecrets: true,
      });
      return sendData(res, configs.map((config) => webSearchProviderRegistry.enrichConfig(config)));
    }),

    getRouteDiagnostics: asyncHandler(async (_req, res) => {
      const candidates = await webSearchProviderRouter.getRouteCandidates();
      const diagnostics = buildWebSearchProviderRouteDiagnostics(candidates, {
        now: webSearchProviderRouter.nowFn?.() || new Date(),
      });
      const recentDecisions = webSearchProviderRouteHistory?.listRecentDecisions
        ? await webSearchProviderRouteHistory.listRecentDecisions({ limit: 10 })
        : [];
      const recentHealthEvents = webSearchProviderHealthHistory?.listRecentEvents
        ? await webSearchProviderHealthHistory.listRecentEvents({ limit: 10 })
        : [];
      return sendData(res, {
        ...diagnostics,
        recentDecisions,
        recentHealthEvents,
      });
    }),

    updateProvider: asyncHandler(async (req, res) => {
      const providerKey = requireProviderKey(req.params.providerKey);
      const metadata = webSearchProviderRegistry.getMetadata(providerKey);
      const payload = buildWebSearchProviderMutationPayload({
        ...req.body,
        providerKey,
      }, metadata);

      const saved = await saveProviderConfig(payload);
      const masked = await webSearchProviderStorage.getProviderConfig(providerKey, {
        includeLegacyBridge: true,
        maskSecrets: true,
      });

      logger.info?.('Web search provider settings updated', { providerKey });
      return sendData(res, webSearchProviderRegistry.enrichConfig(masked || saved));
    }),

    testProvider: asyncHandler(async (req, res) => {
      const providerKey = requireProviderKey(req.params.providerKey);
      const adapter = webSearchProviderRegistry.getAdapter(providerKey);
      if (!adapter) {
        throw new ValidationError('Web search provider adapter is not available yet', {
          code: 'provider_adapter_unavailable',
          providerKey,
        });
      }

      const storedConfig = await webSearchProviderStorage.getProviderConfig(providerKey, {
        includeLegacyBridge: true,
        maskSecrets: false,
      });
      const submittedApiKey = typeof req.body?.apiKey === 'string'
        ? req.body.apiKey
        : req.body?.api_key;
      const apiKey = submittedApiKey?.trim() || storedConfig?.apiKey || null;
      if (!apiKey) {
        throw new ValidationError('API key is required', { code: 'api_key_required', providerKey });
      }

      try {
        const result = await adapter.testConnection({
          apiKey,
          config: req.body?.config || storedConfig?.config || {},
        });
        return sendData(res, result);
      } catch (error) {
        logger.error?.('Web search provider test failed', {
          providerKey,
          error: error.message,
        });
        throw error;
      }
    }),
  };
}
