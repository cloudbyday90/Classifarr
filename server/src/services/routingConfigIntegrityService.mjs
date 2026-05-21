/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { BaseIntegrityService } from '../utils/baseIntegrityService.mjs';

const logger = createLogger('routingConfigIntegrityService');

const ROUTING_WARNING_DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const ROUTING_STARTUP_SAMPLE_LIMIT = 10;

function normalizeArrType(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function buildRoutingDriftDedupeKey(reasonCode, library = {}, extra = {}) {
  const resolvedLibrary = library && typeof library === 'object' ? library : {};
  const arrType = normalizeArrType(extra.arrType ?? resolvedLibrary.arr_type) || 'none';
  const arrId = Number.parseInt(extra.arrId ?? resolvedLibrary.arr_id, 10);
  const libraryId = Number.parseInt(resolvedLibrary?.id ?? resolvedLibrary?.library_id, 10);
  const missingFields = Array.isArray(extra.missingFields) ? extra.missingFields.slice().sort().join('|') : 'none';

  return [
    'routing-drift',
    reasonCode || 'unknown',
    Number.isInteger(libraryId) ? libraryId : 'none',
    arrType,
    Number.isInteger(arrId) ? arrId : 'none',
    missingFields,
  ].join(':');
}

function mapInvalidMappingSample(row = {}) {
  return {
    libraryId: Number.parseInt(row.library_id, 10) || null,
    libraryName: row.library_name || null,
    arrType: normalizeArrType(row.arr_type),
    arrConfigId: Number.parseInt(row.arr_config_id, 10) || null,
    issue: row.issue || 'unknown',
  };
}

export class RoutingConfigIntegrityService extends BaseIntegrityService {
  constructor(deps = {}) {
    super(
      {
        db: deps.db || db,
        logger: deps.logger || logger,
        warningDedupeWindowMs: deps.warningDedupeWindowMs,
        startupSampleLimit: deps.startupSampleLimit,
      },
      ROUTING_WARNING_DEDUPE_WINDOW_MS,
      ROUTING_STARTUP_SAMPLE_LIMIT
    );
  }

  warnRoutingDrift({ reasonCode, library = {}, metadata = {}, details = {} } = {}) {
    const resolvedLibrary = library && typeof library === 'object' ? library : {};
    const messageByReason = {
      no_mapping: 'No *arr mapping available for routing; routing will be skipped until configuration is completed',
      missing_arr_id: 'Missing *arr config ID for routed library; routing will be skipped until configuration is repaired',
      config_missing_or_inactive: 'Mapped *arr config is missing or inactive; routing will be skipped until configuration is repaired',
      missing_required_settings: 'Required *arr routing settings are missing; routing will be skipped until configuration is repaired',
    };

    const message = messageByReason[reasonCode];
    if (!message) {
      return false;
    }

    const warningDetails = {
      title: metadata?.title || null,
      libraryId: Number.parseInt(resolvedLibrary?.id ?? resolvedLibrary?.library_id, 10) || null,
      libraryName: resolvedLibrary?.name || resolvedLibrary?.library_name || null,
      arrType: normalizeArrType(details.arrType ?? resolvedLibrary?.arr_type),
      arrConfigId: Number.parseInt(details.arrId ?? resolvedLibrary?.arr_id, 10) || null,
      missingFields: Array.isArray(details.missingFields) ? details.missingFields : [],
    };

    this.logger.warn(message, warningDetails, {
      dedupeKey: buildRoutingDriftDedupeKey(reasonCode, resolvedLibrary, details),
      dedupeWindowMs: this.warningDedupeWindowMs,
    });

    return true;
  }

  async auditPersistedMappings({ source = 'startup_preflight' } = {}) {
    const result = await this.db.query(
      `
        WITH invalid_mappings AS (
          SELECT
            lam.library_id,
            l.name AS library_name,
            lam.arr_type,
            lam.arr_config_id,
            CASE
              WHEN lam.arr_type IS NULL OR lam.arr_type NOT IN ('radarr', 'sonarr') THEN 'invalid_arr_type'
              WHEN lam.arr_config_id IS NULL THEN 'missing_arr_config_id'
              WHEN lam.arr_type = 'radarr' AND rc.id IS NULL THEN 'radarr_config_missing_or_inactive'
              WHEN lam.arr_type = 'sonarr' AND sc.id IS NULL THEN 'sonarr_config_missing_or_inactive'
              ELSE NULL
            END AS issue
          FROM library_arr_mappings lam
          LEFT JOIN libraries l ON l.id = lam.library_id
          LEFT JOIN radarr_config rc
            ON lam.arr_type = 'radarr'
           AND rc.id = lam.arr_config_id
           AND rc.is_active = true
          LEFT JOIN sonarr_config sc
            ON lam.arr_type = 'sonarr'
           AND sc.id = lam.arr_config_id
           AND sc.is_active = true
          WHERE (
            lam.arr_type IS NULL
            OR lam.arr_type NOT IN ('radarr', 'sonarr')
            OR lam.arr_config_id IS NULL
            OR (lam.arr_type = 'radarr' AND rc.id IS NULL)
            OR (lam.arr_type = 'sonarr' AND sc.id IS NULL)
          )
        ),
        invalid_count AS (
          SELECT COUNT(*)::int AS count
          FROM invalid_mappings
        )
        SELECT
          invalid_count.count AS invalid_count,
          COALESCE(
            JSON_AGG(sample_rows ORDER BY sample_rows.library_id) FILTER (WHERE sample_rows.library_id IS NOT NULL),
            '[]'::json
          ) AS sample_rows
        FROM (
          SELECT *
          FROM invalid_mappings
          WHERE issue IS NOT NULL
          ORDER BY library_id
          LIMIT $1
        ) sample_rows
        CROSS JOIN invalid_count
        GROUP BY invalid_count.count
      `,
      [this.startupSampleLimit]
    );

    const row = result.rows[0] || {};
    const invalidCount = Number.parseInt(row.invalid_count, 10) || 0;
    const sampleRows = Array.isArray(row.sample_rows) ? row.sample_rows : [];
    const sample = sampleRows.map(mapInvalidMappingSample);

    if (invalidCount > 0) {
      this.logger.warn(
        'Persisted *arr library mappings are incomplete or reference inactive configs; routing will be skipped until configuration is repaired',
        {
          source,
          invalidCount,
          sample,
        },
        {
          dedupeKey: 'persisted-routing-config-drift',
          dedupeWindowMs: this.warningDedupeWindowMs,
        }
      );
    }

    return {
      invalidCount,
      sample,
    };
  }
}

export const routingConfigIntegrityService = new RoutingConfigIntegrityService();
