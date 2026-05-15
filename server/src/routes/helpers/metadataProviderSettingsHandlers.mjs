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
  return {
    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async getTmdbConfig(_req, res, next) {
      try {
        const config = await fetchSingleProviderConfig(db, 'tmdb_config', { activeOnly: true });
        return res.json(maskProviderApiKey(config));
      } catch (error) {
        next(error);
      }
    },

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    async updateTmdbConfig(req, res, next) {
      try {
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

        return res.json(maskProviderApiKey(result.rows[0] || null));
      } catch (error) {
        next(error);
      }
    },

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    async testTmdb(req, res, next) {
      try {
        const apiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'tmdb_config',
          submittedApiKey: req.body?.api_key,
          activeOnly: true,
        });

        if (!apiKey) {
          const response = buildMissingMetadataProviderApiKeyResponse();
          return res.status(response.status).json(response.body);
        }

        const result = await tmdbService.testConnection(apiKey);
        return res.json(result);
      } catch (error) {
        next(error);
      }
    },

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async tmdbHealth(_req, res) {
      try {
        const config = await fetchSingleProviderConfig(db, 'tmdb_config', { activeOnly: true });

        if (!config?.api_key) {
          return res.json(buildUnavailableHealthResponse('TMDB API not configured'));
        }

        const healthResult = await tmdbService.checkHealth(config.api_key);
        return res.json(buildHealthyProviderResponse(healthResult));
      } catch (error) {
        return res.status(500).json(buildErrorHealthResponse(error));
      }
    },

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async getTavilyConfig(_req, res, next) {
      try {
        const config = await fetchSingleProviderConfig(db, 'tavily_config');
        return res.json(maskProviderApiKey(config));
      } catch (error) {
        next(error);
      }
    },

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    async updateTavilyConfig(req, res, next) {
      try {
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

        return res.json(maskProviderApiKey(result.rows[0] || null));
      } catch (error) {
        next(error);
      }
    },

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    async testTavily(req, res, next) {
      try {
        const apiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'tavily_config',
          submittedApiKey: req.body?.api_key,
        });

        if (!apiKey) {
          const response = buildMissingMetadataProviderApiKeyResponse();
          return res.status(response.status).json(response.body);
        }

        const result = await tavilyService.testConnection(apiKey);
        return res.json(result);
      } catch (error) {
        next(error);
      }
    },

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    async searchTavily(req, res, next) {
      try {
        const { query, api_key } = req.body || {};
        const apiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'tavily_config',
          submittedApiKey: api_key,
        });

        if (!apiKey || !query) {
          const response = buildInvalidTavilySearchRequestResponse();
          return res.status(response.status).json(response.body);
        }

        const config = await fetchSingleProviderConfig(db, 'tavily_config') || {};
        const result = await tavilyService.search(query, buildTavilySearchOptions(apiKey, config));

        return res.json(result);
      } catch (error) {
        next(error);
      }
    },

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async tavilyHealth(_req, res) {
      try {
        const config = await fetchSingleProviderConfig(db, 'tavily_config', { activeOnly: true });

        if (!config?.api_key) {
          return res.json(buildUnavailableHealthResponse('Tavily API not configured'));
        }

        const healthResult = await tavilyService.checkHealth(config.api_key);
        return res.json(buildHealthyProviderResponse(healthResult));
      } catch (error) {
        return res.status(500).json(buildErrorHealthResponse(error));
      }
    },

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async getOmdbConfig(_req, res, next) {
      try {
        const config = await fetchSingleProviderConfig(db, 'omdb_config');
        return res.json(maskProviderApiKey(config));
      } catch (error) {
        next(error);
      }
    },

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    async updateOmdbConfig(req, res, next) {
      try {
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

        return res.json(maskProviderApiKey(result.rows[0] || null));
      } catch (error) {
        next(error);
      }
    },

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    async testOmdb(req, res, next) {
      try {
        const apiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'omdb_config',
          submittedApiKey: req.body?.api_key,
        });

        if (!apiKey) {
          const response = buildMissingMetadataProviderApiKeyResponse();
          return res.status(response.status).json(response.body);
        }

        const result = await omdbService.testConnection(apiKey);
        return res.json(result);
      } catch (error) {
        next(error);
      }
    },

    /** @param {MetadataProviderRequest} req @param {SettingsResponse} res */
    async searchOmdb(req, res, next) {
      try {
        const { title, year, type } = req.body || {};
        const configResult = await db.query('SELECT api_key FROM omdb_config WHERE is_active = true LIMIT 1');

        if (!configResult.rows[0]?.api_key) {
          const response = buildMissingOmdbConfigurationResponse();
          return res.status(response.status).json(response.body);
        }

        const result = await omdbService.getByTitle(title, year, type, configResult.rows[0].api_key);
        return res.json(result);
      } catch (error) {
        next(error);
      }
    },

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async omdbHealth(_req, res) {
      try {
        const config = await fetchSingleProviderConfig(db, 'omdb_config', { activeOnly: true });

        if (!config?.api_key) {
          return res.json(buildUnavailableHealthResponse('OMDb API not configured'));
        }

        const healthResult = await omdbService.checkHealth(config.api_key);
        return res.json(buildHealthyProviderResponse(healthResult, {
          requests_today: config.requests_today || 0,
          daily_limit: config.daily_limit || 1000,
          remaining_requests: Math.max(0, (config.daily_limit || 1000) - (config.requests_today || 0)),
        }));
      } catch (error) {
        return res.status(500).json(buildErrorHealthResponse(error));
      }
    },
  };
}
