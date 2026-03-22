/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { maskToken, isMaskedToken } = require('../../utils/tokenMasking');

const ALLOWED_ARR_CONFIG_TABLES = new Set(['radarr_config', 'sonarr_config']);

function maskConfigRow(row) {
  if (!row) return row;
  const nextRow = { ...row };
  if (nextRow.api_key) {
    nextRow.api_key = maskToken(nextRow.api_key);
  }
  return nextRow;
}

function resolvePort(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildConfigShape(body = {}, defaultPort, existing = null) {
  const protocol = body.protocol ?? existing?.protocol ?? 'http';
  const host = body.host ?? existing?.host ?? 'localhost';
  const port = resolvePort(body.port, existing?.port ?? defaultPort);
  const basePath = body.base_path ?? existing?.base_path ?? '';
  const url = body.url || `${protocol}://${host}:${port}${basePath}`;

  return {
    protocol,
    host,
    port,
    base_path: basePath,
    url,
  };
}

async function findStoredApiKey(db, table, config = {}) {
  if (config.id) {
    const existingResult = await db.query(`SELECT api_key FROM ${table} WHERE id = $1`, [config.id]); // sql-interpolation: table is allowlisted to internal ARR config tables and cannot be parameterized
    return existingResult.rows[0]?.api_key || null;
  }

  if (config.host && config.port) {
    const existingResult = await db.query(`SELECT api_key FROM ${table} WHERE host = $1 AND port = $2`, [config.host, config.port]); // sql-interpolation: table is allowlisted to internal ARR config tables and cannot be parameterized
    return existingResult.rows[0]?.api_key || null;
  }

  return null;
}

function createArrConfigHandlers({
  db,
  table,
  entityLabel,
  service,
  defaultPort,
  createDefaults = {},
  extraColumns = [],
}) {
  if (!ALLOWED_ARR_CONFIG_TABLES.has(table)) {
    throw new Error(`Unsupported ARR config table: ${table}`);
  }

  const allColumns = [
    'name',
    'url',
    'api_key',
    'protocol',
    'host',
    'port',
    'base_path',
    'verify_ssl',
    'timeout',
    ...extraColumns,
  ];

  return {
    async list(_req, res) {
      try {
        const result = await db.query(`SELECT * FROM ${table} ORDER BY id`); // sql-interpolation: table is allowlisted to internal ARR config tables and cannot be parameterized
        res.json(result.rows.map(maskConfigRow));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async create(req, res) {
      try {
        const shape = buildConfigShape(req.body, defaultPort);
        const payload = {
          name: req.body.name,
          url: shape.url,
          api_key: req.body.api_key,
          protocol: shape.protocol,
          host: shape.host,
          port: shape.port,
          base_path: shape.base_path,
          verify_ssl: req.body.verify_ssl !== false,
          timeout: req.body.timeout || 30,
        };

        for (const column of extraColumns) {
          payload[column] = req.body[column] ?? createDefaults[column] ?? null;
        }

        const values = allColumns.map((column) => payload[column]);
        const placeholders = allColumns.map((_, index) => `$${index + 1}`).join(', ');

        const result = await db.query(
          `INSERT INTO ${table} (${allColumns.join(', ')})
           VALUES (${placeholders})
           RETURNING *`, // sql-interpolation: table/column names are internal allowlisted constants and cannot use $N placeholders
          values
        );

        res.json(maskConfigRow(result.rows[0]));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async update(req, res) {
      try {
        const id = parsePositiveInteger(req.params.id);
        if (!id) {
          return res.status(400).json({ error: `Valid ${entityLabel.toLowerCase()} configuration id is required` });
        }
        const existingResult = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]); // sql-interpolation: table is allowlisted to internal ARR config tables and cannot be parameterized

        if (existingResult.rows.length === 0) {
          return res.status(404).json({ error: `${entityLabel} configuration not found` });
        }

        const existing = existingResult.rows[0];
        const shape = buildConfigShape(req.body, defaultPort, existing);
        const resolvedApiKey = (req.body.api_key && !isMaskedToken(req.body.api_key))
          ? req.body.api_key
          : existing.api_key;

        const payload = {
          name: req.body.name ?? existing.name,
          url: shape.url,
          api_key: resolvedApiKey,
          protocol: shape.protocol,
          host: shape.host,
          port: shape.port,
          base_path: shape.base_path,
          verify_ssl: req.body.verify_ssl ?? existing.verify_ssl,
          timeout: req.body.timeout ?? existing.timeout,
          is_active: req.body.is_active ?? existing.is_active,
        };

        for (const column of extraColumns) {
          payload[column] = Object.prototype.hasOwnProperty.call(req.body, column)
            ? req.body[column]
            : existing[column];
        }

        const updateColumns = [
          'name',
          'url',
          'api_key',
          'protocol',
          'host',
          'port',
          'base_path',
          'verify_ssl',
          'timeout',
          'is_active',
          ...extraColumns,
        ];

        const assignments = updateColumns.map((column, index) => `${column} = $${index + 1}`);
        const values = updateColumns.map((column) => payload[column]);

        const result = await db.query(
          `UPDATE ${table}
           SET ${assignments.join(', ')},
               updated_at = NOW()
           WHERE id = $${updateColumns.length + 1}
           RETURNING *`, // sql-interpolation: table/column names are internal allowlisted constants and cannot use $N placeholders
          [...values, id]
        );

        res.json(maskConfigRow(result.rows[0]));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async remove(req, res) {
      try {
        const id = parsePositiveInteger(req.params.id);
        if (!id) {
          return res.status(400).json({ error: `Valid ${entityLabel.toLowerCase()} configuration id is required` });
        }
        await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]); // sql-interpolation: table is allowlisted to internal ARR config tables and cannot be parameterized
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async test(req, res) {
      try {
        const config = { ...req.body };

        if (config.api_key && isMaskedToken(config.api_key)) {
          const realApiKey = await findStoredApiKey(db, table, config);

          if (!realApiKey) {
            return res.json({
              success: false,
              error: { message: 'No saved API key found. Please enter the API key manually.' }
            });
          }

          config.api_key = realApiKey;
        }

        const result = await service.testConnection(config);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async rootFolders(req, res) {
      try {
        const id = parsePositiveInteger(req.params.id);
        if (!id) {
          return res.status(400).json({ error: `Valid ${entityLabel.toLowerCase()} configuration id is required` });
        }
        const configResult = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]); // sql-interpolation: table is allowlisted to internal ARR config tables and cannot be parameterized

        if (configResult.rows.length === 0) {
          return res.status(404).json({ error: `${entityLabel} configuration not found` });
        }

        const folders = await service.getRootFolders(configResult.rows[0].url, configResult.rows[0].api_key);
        res.json(folders);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async qualityProfiles(req, res) {
      try {
        const id = parsePositiveInteger(req.params.id);
        if (!id) {
          return res.status(400).json({ error: `Valid ${entityLabel.toLowerCase()} configuration id is required` });
        }
        const configResult = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]); // sql-interpolation: table is allowlisted to internal ARR config tables and cannot be parameterized

        if (configResult.rows.length === 0) {
          return res.status(404).json({ error: `${entityLabel} configuration not found` });
        }

        const profiles = await service.getQualityProfiles(configResult.rows[0].url, configResult.rows[0].api_key);
        res.json(profiles);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  };
}

function createArrConfigStatusHandler({ db }) {
  return async function getArrConfigStatus(_req, res) {
    try {
      const incompleteConfigs = [];

      const [radarrResult, sonarrResult] = await Promise.all([
        db.query('SELECT id, name FROM radarr_config WHERE quality_profile_id IS NULL'),
        db.query('SELECT id, name FROM sonarr_config WHERE quality_profile_id IS NULL'),
      ]);

      radarrResult.rows.forEach((row) => {
        incompleteConfigs.push({
          type: 'Radarr',
          name: row.name || `Radarr ${row.id}`,
          id: row.id,
          missingField: 'quality_profile_id'
        });
      });

      sonarrResult.rows.forEach((row) => {
        incompleteConfigs.push({
          type: 'Sonarr',
          name: row.name || `Sonarr ${row.id}`,
          id: row.id,
          missingField: 'quality_profile_id'
        });
      });

      res.json({ incompleteConfigs });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

module.exports = {
  createArrConfigHandlers,
  createArrConfigStatusHandler,
};
