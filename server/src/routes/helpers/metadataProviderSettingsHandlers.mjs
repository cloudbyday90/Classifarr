/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildErrorHealthResponse,
  buildHealthyProviderResponse,
  buildUnavailableHealthResponse,
  fetchSingleProviderConfig,
  maskProviderApiKey,
  resolveRequestApiKey,
} from './providerConfigHelpers.mjs';
import {
  buildInvalidTavilySearchRequestResponse,
  buildMissingMetadataProviderApiKeyResponse,
  buildMissingOmdbConfigurationResponse,
  buildOmdbConfigMutationPayload,
  buildTavilyConfigMutationPayload,
  buildTavilySearchOptions,
  buildTmdbConfigMutationPayload,
} from './metadataProviderSettingsSupport.mjs';
import { asyncHandler } from '../../utils/asyncHandler.mjs';
import { ValidationError } from '../../utils/appError.mjs';
import { sendData } from '../../utils/responseHelpers.mjs';

/** @typedef {import('./settingsRouteContracts.mjs').SettingsRequest} SettingsRequest */
/** @typedef {import('./settingsRouteContracts.mjs').SettingsBodyRequest<MetadataProviderHandlerBody>} MetadataProviderRequest */
/** @typedef {import('./settingsRouteContracts.mjs').SettingsResponse} SettingsResponse */

/**
 * @typedef {{
 *   api_key?: string | null,
 *   language?: string | null,
 *   search_depth?: string | null,
 *   max_results?: number | string | null,
 *   include_domains?: string[] | null,
 *   exclude_domains?: string[] | null,
 *   is_active?: boolean | null,
 *   daily_limit?: number | string | null,
 *   query?: string | null,
 *   title?: string | null,
 *   year?: number | string | null,
 *   type?: string | null,
 * }} MetadataProviderHandlerBody
 */

/**
 * @typedef {{
 *   query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, any>[] }>,
 * }} MetadataProviderDbClient
 */

/**
 * @typedef {{
 *   query: MetadataProviderDbClient['query'],
 *   withTransaction: (callback: (client: MetadataProviderDbClient) => Promise<{ rows: Record<string, any>[] }>) => Promise<{ rows: Record<string, any>[] }>,
 * }} MetadataProviderDb
 */

/**
 * @typedef {{
 *   info: (message: string, payload?: Record<string, unknown>) => void,
 *   error: (message: string, payload?: Record<string, unknown>) => void,
 * }} MetadataProviderLogger
 */

/**
 * @typedef {{
 *   healthy: boolean,
 *   ssl_error?: boolean,
 *   api_reachable?: boolean | null,
 *   message: string,
 * }} MetadataProviderHealthResult
 */

/**
 * @typedef {{
 *   testConnection: (apiKey: string) => Promise<unknown>,
 *   checkHealth: (apiKey: string) => Promise<MetadataProviderHealthResult>,
 * }} MetadataProviderConnectionService
 */

/**
 * @typedef {MetadataProviderConnectionService & {
 *   search: (query: string, options: Record<string, unknown>) => Promise<unknown>,
 * }} TavilySettingsService
 */

/**
 * @typedef {MetadataProviderConnectionService & {
 *   getByTitle: (
 *     title?: string | null,
 *     year?: number | string | null,
 *     type?: string | null,
 *     apiKey?: string | null
 *   ) => Promise<unknown>,
 * }} OmdbSettingsService
 */

/**
 * @typedef {{
 *   runGapAnalysis: () => Promise<unknown>,
 * }} MetadataProviderSchedulerService
 */

/**
 * @param {{
 *   db: MetadataProviderDb,
 *   logger: MetadataProviderLogger,
 *   tmdbService: MetadataProviderConnectionService,
 *   tavilyService: TavilySettingsService,
 *   omdbService: OmdbSettingsService,
 *   schedulerService: MetadataProviderSchedulerService,
 * }} options
 */
export function createMetadataProviderSettingsHandlers({
  db,
  logger,
  tmdbService,
  tavilyService,
  omdbService,
  schedulerService,
}) {
  async function buildProviderHealthRouteResponse({ table, service, unavailableMessage, extra = undefined, activeOnly = true }) {
    try {
      const config = await fetchSingleProviderConfig(db, table, { activeOnly });

      if (!config?.api_key) {
        return {
          status: 200,
          body: buildUnavailableHealthResponse(unavailableMessage),
        };
      }

      const healthResult = await service.checkHealth(config.api_key);
      return {
        status: 200,
        body: buildHealthyProviderResponse(
          healthResult,
          typeof extra === 'function' ? extra(config) : (extra || {})
        ),
      };
    } catch (error) {
      return {
        status: 500,
        body: buildErrorHealthResponse(error),
      };
    }
  }

  function requireMetadataProviderApiKey(apiKey) {
    if (!apiKey) {
      throw new ValidationError(buildMissingMetadataProviderApiKeyResponse().body.error);
    }

    return apiKey;
  }

  function requireTavilySearchInput(apiKey, query) {
    if (!apiKey || !query) {
      throw new ValidationError(buildInvalidTavilySearchRequestResponse().body.error);
    }
  }

  return {
    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    getTmdbConfig: asyncHandler(async (_req, res) => {
      const config = await fetchSingleProviderConfig(db, 'tmdb_config', { activeOnly: true });
      return sendData(res, maskProviderApiKey(config));
    }),

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    updateTmdbConfig: asyncHandler(async (req, res) => {
      const result = await db.withTransaction(async (client) => {
        const existingConfig = await fetchSingleProviderConfig(client, 'tmdb_config', { activeOnly: true });
        const payload = buildTmdbConfigMutationPayload(req.body, existingConfig);

        await client.query('UPDATE tmdb_config SET is_active = false');

        return client.query(
          `INSERT INTO tmdb_config (api_key, language, is_active)
           VALUES ($1, $2, true)
           RETURNING *`,
          [payload.apiKey, payload.language]
        );
      });

      return sendData(res, maskProviderApiKey(result.rows[0] || null));
    }),

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    testTmdb: asyncHandler(async (req, res) => {
      const apiKey = requireMetadataProviderApiKey(await resolveRequestApiKey({
        dbOrClient: db,
        table: 'tmdb_config',
        submittedApiKey: req.body?.api_key,
        activeOnly: true,
      }));

      const result = await tmdbService.testConnection(apiKey);
      return sendData(res, result);
    }),

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    tmdbHealth: asyncHandler(async (_req, res) => {
      const response = await buildProviderHealthRouteResponse({
        table: 'tmdb_config',
        service: tmdbService,
        unavailableMessage: 'TMDB API not configured',
      });
      return res.status(response.status).json(response.body);
    }),

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    getTavilyConfig: asyncHandler(async (_req, res) => {
      const config = await fetchSingleProviderConfig(db, 'tavily_config');
      return sendData(res, maskProviderApiKey(config));
    }),

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    updateTavilyConfig: asyncHandler(async (req, res) => {
      const result = await db.withTransaction(async (client) => {
        const existingConfig = await fetchSingleProviderConfig(client, 'tavily_config');
        const payload = buildTavilyConfigMutationPayload(req.body, existingConfig);

        await client.query('DELETE FROM tavily_config');

        return client.query(
          `INSERT INTO tavily_config
           (api_key, search_depth, max_results, include_domains, exclude_domains, is_active, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING *`,
          [
            payload.apiKey,
            payload.searchDepth,
            payload.maxResults,
            payload.includeDomains,
            payload.excludeDomains,
            payload.isActive,
          ]
        );
      });

      return sendData(res, maskProviderApiKey(result.rows[0] || null));
    }),

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    testTavily: asyncHandler(async (req, res) => {
      const apiKey = requireMetadataProviderApiKey(await resolveRequestApiKey({
        dbOrClient: db,
        table: 'tavily_config',
        submittedApiKey: req.body?.api_key,
      }));

      const result = await tavilyService.testConnection(apiKey);
      return sendData(res, result);
    }),

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    searchTavily: asyncHandler(async (req, res) => {
      const { query, api_key } = req.body || {};
      const apiKey = await resolveRequestApiKey({
        dbOrClient: db,
        table: 'tavily_config',
        submittedApiKey: api_key,
      });

      requireTavilySearchInput(apiKey, query);

      const config = await fetchSingleProviderConfig(db, 'tavily_config') || {};
      const result = await tavilyService.search(query, buildTavilySearchOptions(apiKey, config));

      return sendData(res, result);
    }),

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    tavilyHealth: asyncHandler(async (_req, res) => {
      const response = await buildProviderHealthRouteResponse({
        table: 'tavily_config',
        service: tavilyService,
        unavailableMessage: 'Tavily API not configured',
      });
      return res.status(response.status).json(response.body);
    }),

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    getOmdbConfig: asyncHandler(async (_req, res) => {
      const config = await fetchSingleProviderConfig(db, 'omdb_config');
      return sendData(res, maskProviderApiKey(config));
    }),

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    updateOmdbConfig: asyncHandler(async (req, res) => {
      const result = await db.withTransaction(async (client) => {
        const existing = await fetchSingleProviderConfig(client, 'omdb_config');
        const payload = buildOmdbConfigMutationPayload(req.body, existing);

        await client.query('DELETE FROM omdb_config');

        return client.query(
          `INSERT INTO omdb_config (id, api_key, is_active, daily_limit, requests_today, last_reset_date, updated_at)
           VALUES (1, $1, $2, $3, $4, $5, NOW())
           RETURNING *`,
          [payload.apiKey, payload.isActive, payload.dailyLimit, payload.requestsToday, payload.lastResetDate]
        );
      });

      const finalIsActive = result.rows[0]?.is_active;
      if (finalIsActive) {
        logger.info('OMDb settings saved - Triggering immediate gap analysis...');
        schedulerService.runGapAnalysis().catch(err => {
          logger.error('Failed to trigger manual gap analysis:', { error: err.message });
        });
      }

      return sendData(res, maskProviderApiKey(result.rows[0] || null));
    }),

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    testOmdb: asyncHandler(async (req, res) => {
      const apiKey = requireMetadataProviderApiKey(await resolveRequestApiKey({
        dbOrClient: db,
        table: 'omdb_config',
        submittedApiKey: req.body?.api_key,
      }));

      const result = await omdbService.testConnection(apiKey);
      return sendData(res, result);
    }),

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    searchOmdb: asyncHandler(async (req, res) => {
      const { title, year, type } = req.body || {};
      const configResult = await db.query('SELECT api_key FROM omdb_config WHERE is_active = true LIMIT 1');

      if (!configResult.rows[0]?.api_key) {
        throw new ValidationError(buildMissingOmdbConfigurationResponse().body.error);
      }

      const result = await omdbService.getByTitle(title, year, type, configResult.rows[0].api_key);
      return sendData(res, result);
    }),

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    omdbHealth: asyncHandler(async (_req, res) => {
      const response = await buildProviderHealthRouteResponse({
        table: 'omdb_config',
        service: omdbService,
        unavailableMessage: 'OMDb API not configured',
        extra: (config) => ({
          requests_today: config.requests_today || 0,
          daily_limit: config.daily_limit || 1000,
          remaining_requests: Math.max(0, (config.daily_limit || 1000) - (config.requests_today || 0)),
        }),
      });
      return res.status(response.status).json(response.body);
    }),
  };
}
