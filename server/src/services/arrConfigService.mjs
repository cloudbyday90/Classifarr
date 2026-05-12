/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isMaskedToken } from '../utils/tokenMasking.mjs';
import {
  buildArrCreatePayload,
  buildArrUpdatePayload,
  createArrConfigError,
  maskArrConfigRow,
  parseArrConfigId,
  validateArrConfigTable,
} from './shared/arrConfigModel.mjs';

async function findStoredApiKey(db, table, config = {}) {
  if (config.id) {
    const existingResult = await db.query(
      `SELECT api_key FROM ${table} WHERE id = $1`,
      [config.id],
    );
    return existingResult.rows[0]?.api_key || null;
  }

  if (config.host && config.port) {
    const existingResult = await db.query(
      `SELECT api_key FROM ${table} WHERE host = $1 AND port = $2`,
      [config.host, config.port],
    );
    return existingResult.rows[0]?.api_key || null;
  }

  return null;
}

async function getConfigById({ db, table, entityLabel, id }) {
  const configId = parseArrConfigId(id);
  if (!configId) {
    throw createArrConfigError(`Valid ${entityLabel.toLowerCase()} configuration id is required`, 400);
  }

  const result = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [configId]);
  if (result.rows.length === 0) {
    throw createArrConfigError(`${entityLabel} configuration not found`, 404);
  }

  return {
    configId,
    config: result.rows[0],
  };
}

export function createArrConfigService({
  db,
  table,
  entityLabel,
  service,
  defaultPort,
  createDefaults = {},
  extraColumns = [],
}) {
  validateArrConfigTable(table);

  const createColumns = [
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

  return {
    async listConfigs() {
      const result = await db.query(`SELECT * FROM ${table} ORDER BY id`);
      return result.rows.map(maskArrConfigRow);
    },

    async createConfig(body) {
      const payload = buildArrCreatePayload({
        body,
        defaultPort,
        createDefaults,
        extraColumns,
      });

      const values = createColumns.map((column) => payload[column]);
      const placeholders = createColumns.map((_, index) => `$${index + 1}`).join(', ');

      const result = await db.query(
        `INSERT INTO ${table} (${createColumns.join(', ')})
         VALUES (${placeholders})
         RETURNING *`,
        values,
      );

      return maskArrConfigRow(result.rows[0]);
    },

    async updateConfig(id, body) {
      const { configId, config: existing } = await getConfigById({
        db,
        table,
        entityLabel,
        id,
      });

      const payload = buildArrUpdatePayload({
        body,
        existing,
        defaultPort,
        extraColumns,
      });

      const assignments = updateColumns.map((column, index) => `${column} = $${index + 1}`);
      const values = updateColumns.map((column) => payload[column]);

      const result = await db.query(
        `UPDATE ${table}
         SET ${assignments.join(', ')},
             updated_at = NOW()
         WHERE id = $${updateColumns.length + 1}
         RETURNING *`,
        [...values, configId],
      );

      return maskArrConfigRow(result.rows[0]);
    },

    async removeConfig(id) {
      const configId = parseArrConfigId(id);
      if (!configId) {
        throw createArrConfigError(`Valid ${entityLabel.toLowerCase()} configuration id is required`, 400);
      }

      await db.query(`DELETE FROM ${table} WHERE id = $1`, [configId]);
      return { success: true };
    },

    async testConfig(body) {
      const config = { ...body };

      if (config.api_key && isMaskedToken(config.api_key)) {
        const realApiKey = await findStoredApiKey(db, table, config);
        if (!realApiKey) {
          return {
            success: false,
            error: { message: 'No saved API key found. Please enter the API key manually.' },
          };
        }

        config.api_key = realApiKey;
      }

      return service.testConnection(config);
    },

    async getRootFolders(id) {
      const { config } = await getConfigById({
        db,
        table,
        entityLabel,
        id,
      });

      return service.getRootFolders(config.url, config.api_key);
    },

    async getQualityProfiles(id) {
      const { config } = await getConfigById({
        db,
        table,
        entityLabel,
        id,
      });

      return service.getQualityProfiles(config.url, config.api_key);
    },
  };
}

export function createArrConfigStatusService({ db }) {
  return {
    async getIncompleteConfigs() {
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
          missingField: 'quality_profile_id',
        });
      });

      sonarrResult.rows.forEach((row) => {
        incompleteConfigs.push({
          type: 'Sonarr',
          name: row.name || `Sonarr ${row.id}`,
          id: row.id,
          missingField: 'quality_profile_id',
        });
      });

      return { incompleteConfigs };
    },
  };
}
