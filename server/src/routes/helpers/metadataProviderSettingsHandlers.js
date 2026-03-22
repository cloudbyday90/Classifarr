/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function parsePositiveInteger(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createMetadataProviderSettingsHandlers({
  db,
  logger,
  tmdbService,
  tavilyService,
  omdbService,
  schedulerService,
  buildErrorHealthResponse,
  buildHealthyProviderResponse,
  buildUnavailableHealthResponse,
  fetchSingleProviderConfig,
  maskProviderApiKey,
  resolveProviderApiKey,
  resolveRequestApiKey
}) {
  return {
    async getTmdbConfig(_req, res) {
      try {
        const config = await fetchSingleProviderConfig(db, 'tmdb_config', { activeOnly: true });
        return res.json(maskProviderApiKey(config));
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async updateTmdbConfig(req, res) {
      const client = await db.pool.connect();
      let transactionStarted = false;

      try {
        const { api_key, language } = req.body || {};

        await client.query('BEGIN');
        transactionStarted = true;

        const existingConfig = await fetchSingleProviderConfig(client, 'tmdb_config', { activeOnly: true });
        const finalApiKey = resolveProviderApiKey(api_key, existingConfig?.api_key);
        const finalLanguage = language ?? existingConfig?.language ?? 'en-US';

        await client.query('UPDATE tmdb_config SET is_active = false');

        const result = await client.query(
          `INSERT INTO tmdb_config (api_key, language, is_active)
           VALUES ($1, $2, true)
           RETURNING *`,
          [finalApiKey, finalLanguage]
        );

        await client.query('COMMIT');
        transactionStarted = false;

        return res.json(maskProviderApiKey(result.rows[0] || null));
      } catch (error) {
        if (transactionStarted) {
          await client.query('ROLLBACK');
        }
        return res.status(500).json({ error: error.message });
      } finally {
        client.release();
      }
    },

    async testTmdb(req, res) {
      try {
        const apiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'tmdb_config',
          submittedApiKey: req.body?.api_key,
          activeOnly: true
        });

        if (!apiKey) {
          return res.status(400).json({ error: 'API key is required' });
        }

        const result = await tmdbService.testConnection(apiKey);
        return res.json(result);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

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

    async getTavilyConfig(_req, res) {
      try {
        const config = await fetchSingleProviderConfig(db, 'tavily_config');
        return res.json(maskProviderApiKey(config));
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async updateTavilyConfig(req, res) {
      const client = await db.pool.connect();
      let transactionStarted = false;

      try {
        const { api_key, search_depth, max_results, include_domains, exclude_domains, is_active } = req.body || {};

        await client.query('BEGIN');
        transactionStarted = true;

        const existingConfig = await fetchSingleProviderConfig(client, 'tavily_config');
        const finalApiKey = resolveProviderApiKey(api_key, existingConfig?.api_key);

        await client.query('DELETE FROM tavily_config');

        const result = await client.query(
          `INSERT INTO tavily_config
           (api_key, search_depth, max_results, include_domains, exclude_domains, is_active, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING *`,
          [
            finalApiKey,
            search_depth ?? existingConfig?.search_depth ?? 'advanced',
            parsePositiveInteger(max_results, existingConfig?.max_results ?? 5),
            include_domains !== undefined ? include_domains : (existingConfig?.include_domains ?? ['imdb.com', 'rottentomatoes.com']),
            exclude_domains !== undefined ? exclude_domains : (existingConfig?.exclude_domains ?? []),
            is_active ?? existingConfig?.is_active ?? true
          ]
        );

        await client.query('COMMIT');
        transactionStarted = false;

        return res.json(maskProviderApiKey(result.rows[0] || null));
      } catch (error) {
        if (transactionStarted) {
          await client.query('ROLLBACK');
        }
        return res.status(500).json({ error: error.message });
      } finally {
        client.release();
      }
    },

    async testTavily(req, res) {
      try {
        const apiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'tavily_config',
          submittedApiKey: req.body?.api_key
        });

        if (!apiKey) {
          return res.status(400).json({ error: 'API key is required' });
        }

        const result = await tavilyService.testConnection(apiKey);
        return res.json(result);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async searchTavily(req, res) {
      try {
        const { query, api_key } = req.body || {};
        const apiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'tavily_config',
          submittedApiKey: api_key
        });

        if (!apiKey || !query) {
          return res.status(400).json({ error: 'API key and query are required' });
        }

        const config = await fetchSingleProviderConfig(db, 'tavily_config') || {};
        const result = await tavilyService.search(query, {
          apiKey,
          searchDepth: config.search_depth || 'advanced',
          maxResults: config.max_results || 5,
          includeDomains: config.include_domains || ['imdb.com', 'rottentomatoes.com'],
          excludeDomains: config.exclude_domains || []
        });

        return res.json(result);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

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

    async getOmdbConfig(_req, res) {
      try {
        const config = await fetchSingleProviderConfig(db, 'omdb_config');
        return res.json(maskProviderApiKey(config));
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async updateOmdbConfig(req, res) {
      const client = await db.pool.connect();
      let transactionStarted = false;

      try {
        const { api_key, is_active, daily_limit } = req.body || {};

        await client.query('BEGIN');
        transactionStarted = true;

        const existing = await fetchSingleProviderConfig(client, 'omdb_config');

        const finalApiKey = resolveProviderApiKey(api_key, existing?.api_key);
        const finalDailyLimit = parsePositiveInteger(daily_limit, existing?.daily_limit || 1000);
        const finalIsActive = is_active ?? existing?.is_active ?? true;
        const preservedRequestsToday = existing?.requests_today || 0;
        const preservedLastReset = existing?.last_reset_date || null;

        await client.query('DELETE FROM omdb_config');

        const result = await client.query(
          `INSERT INTO omdb_config (id, api_key, is_active, daily_limit, requests_today, last_reset_date, updated_at)
           VALUES (1, $1, $2, $3, $4, $5, NOW())
           RETURNING *`,
          [finalApiKey, finalIsActive, finalDailyLimit, preservedRequestsToday, preservedLastReset]
        );

        await client.query('COMMIT');
        transactionStarted = false;

        if (finalIsActive) {
          logger.info('OMDb settings saved - Triggering immediate gap analysis...');
          schedulerService.runGapAnalysis().catch(err => {
            logger.error('Failed to trigger manual gap analysis:', { error: err.message });
          });
        }

        return res.json(maskProviderApiKey(result.rows[0] || null));
      } catch (error) {
        if (transactionStarted) {
          await client.query('ROLLBACK');
        }
        return res.status(500).json({ error: error.message });
      } finally {
        client.release();
      }
    },

    async testOmdb(req, res) {
      try {
        const apiKey = await resolveRequestApiKey({
          dbOrClient: db,
          table: 'omdb_config',
          submittedApiKey: req.body?.api_key
        });

        if (!apiKey) {
          return res.status(400).json({ error: 'API key is required' });
        }

        const result = await omdbService.testConnection(apiKey);
        return res.json(result);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async searchOmdb(req, res) {
      try {
        const { title, year, type } = req.body || {};
        const configResult = await db.query('SELECT api_key FROM omdb_config WHERE is_active = true LIMIT 1');

        if (!configResult.rows[0]?.api_key) {
          return res.status(400).json({ error: 'OMDb not configured' });
        }

        const result = await omdbService.getByTitle(title, year, type, configResult.rows[0].api_key);
        return res.json(result);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

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
          remaining_requests: Math.max(0, (config.daily_limit || 1000) - (config.requests_today || 0))
        }));
      } catch (error) {
        return res.status(500).json(buildErrorHealthResponse(error));
      }
    }
  };
}

module.exports = {
  createMetadataProviderSettingsHandlers
};
