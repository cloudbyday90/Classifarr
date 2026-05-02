/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function normalizeHost(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return '';
  }
  return String(value).trim();
}

function normalizePort(value) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function createOllamaSettingsHandlers({ db, service }) {
  return {
    async getConfig(_req, res) {
      try {
        const result = await db.query('SELECT * FROM ollama_config WHERE is_active = true LIMIT 1');
        return res.json(result.rows[0] || null);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async updateConfig(req, res) {
      const client = await db.pool.connect();
      let transactionStarted = false;

      try {
        const { host, port, model, temperature } = req.body || {};

        await client.query('BEGIN');
        transactionStarted = true;

        const existingResult = await client.query('SELECT * FROM ollama_config WHERE is_active = true ORDER BY id ASC LIMIT 1');
        const existing = existingResult.rows[0] || null;

        const nextHost = normalizeHost(host) !== undefined ? normalizeHost(host) : existing?.host;
        const nextPort = normalizePort(port) !== undefined ? normalizePort(port) : existing?.port;
        const nextModel = model !== undefined ? model : existing?.model ?? null;
        const nextTemperature = temperature !== undefined ? temperature : existing?.temperature ?? 0.30;

        if (!nextHost) {
          await client.query('ROLLBACK');
          transactionStarted = false;
          return res.status(400).json({ error: 'Host is required' });
        }

        if (nextPort === null || nextPort === undefined) {
          await client.query('ROLLBACK');
          transactionStarted = false;
          return res.status(400).json({ error: 'A valid port is required' });
        }

        let result;
        if (existing) {
          await client.query('UPDATE ollama_config SET is_active = false WHERE id <> $1 AND is_active = true', [existing.id]);
          result = await client.query(
            `UPDATE ollama_config
             SET host = $1,
                 port = $2,
                 model = $3,
                 temperature = $4,
                 is_active = true,
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [nextHost, nextPort, nextModel, nextTemperature, existing.id]
          );
        } else {
          await client.query('UPDATE ollama_config SET is_active = false WHERE is_active = true');
          result = await client.query(
            `INSERT INTO ollama_config (host, port, model, temperature, is_active)
             VALUES ($1, $2, $3, $4, true)
             RETURNING *`,
            [nextHost, nextPort, nextModel, nextTemperature]
          );
        }

        await client.query('COMMIT');
        transactionStarted = false;

        service.resetConfig();

        return res.json(result.rows[0]);
      } catch (error) {
        if (transactionStarted) {
          await client.query('ROLLBACK');
        }
        return res.status(500).json({ error: error.message });
      } finally {
        client.release();
      }
    },

    async testConnection(req, res) {
      try {
        const { host, port, model } = req.body;
        const result = await service.preflightConnection({
          host,
          port,
          model,
          probeGeneration: false,
          force: true,
        });
        return res.json(result);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async getLastPreflight(_req, res) {
      try {
        return res.json(service.getLastScheduledPreflight());
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async warmModel(req, res) {
      try {
        const { model, keepAlive = '24h' } = req.body;
        const result = await service.warmModel(model, keepAlive);
        return res.json(result);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async warmAllModels(req, res) {
      try {
        const { keepAlive = '24h' } = req.body;
        const result = await service.warmAllModels(keepAlive);
        return res.json(result);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async getModels(req, res) {
      try {
        const { host, port } = req.query;
        const models = await service.getModels(host, port);
        return res.json(models);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async getRecommendedModels(_req, res) {
      try {
        return res.json(service.getRecommendedModels());
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  };
}

export default {
  createOllamaSettingsHandlers,
};