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

const logger = createLogger('policyThresholdIntegrityService');

const POLICY_THRESHOLD_WARNING_DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const POLICY_THRESHOLD_STARTUP_SAMPLE_LIMIT = 10;

function buildNormalizationDedupeKey(source, thresholds = {}, reasons = []) {
  const policyId = Number.parseInt(thresholds?.policy_id, 10);
  const libraryId = Number.parseInt(thresholds?.library_id, 10);
  const normalizedReasons = Array.isArray(reasons) ? reasons.join('|') : 'unknown';

  return [
    'policy-threshold-normalized',
    source || 'runtime',
    Number.isInteger(policyId) ? policyId : 'none',
    Number.isInteger(libraryId) ? libraryId : 'none',
    normalizedReasons || 'none',
  ].join(':');
}

function mapInvalidPolicySample(row = {}) {
  return {
    policyId: Number.parseInt(row.policy_id, 10) || null,
    libraryId: Number.parseInt(row.library_id, 10) || null,
    policyName: row.policy_name || null,
    libraryName: row.library_name || null,
    autoClassifyThreshold: row.auto_classify_threshold ?? null,
    promptThreshold: row.prompt_threshold ?? null,
  };
}

export class PolicyThresholdIntegrityService extends BaseIntegrityService {
  constructor(deps = {}) {
    super(
      {
        db: deps.db || db,
        logger: deps.logger || logger,
        warningDedupeWindowMs: deps.warningDedupeWindowMs,
        startupSampleLimit: deps.startupSampleLimit,
      },
      POLICY_THRESHOLD_WARNING_DEDUPE_WINDOW_MS,
      POLICY_THRESHOLD_STARTUP_SAMPLE_LIMIT
    );
  }

  warnOnNormalizedThresholds({ source = 'runtime', thresholds = {}, normalizedThresholds = null } = {}) {
    if (!normalizedThresholds?.wasNormalized) {
      return false;
    }

    const reasons = Array.isArray(normalizedThresholds.reasons) ? normalizedThresholds.reasons : [];
    const metadata = {
      source,
      policyId: Number.parseInt(thresholds?.policy_id, 10) || null,
      libraryId: Number.parseInt(thresholds?.library_id, 10) || null,
      policyName: thresholds?.policy_name || null,
      libraryName: thresholds?.library_name || null,
      reasons,
      autoClassifyThreshold: thresholds?.auto_classify_threshold ?? null,
      promptThreshold: thresholds?.prompt_threshold ?? null,
    };

    this.logger.warn(
      'Normalized invalid policy thresholds; conservative fallback will be used',
      metadata,
      {
        dedupeKey: buildNormalizationDedupeKey(source, thresholds, reasons),
        dedupeWindowMs: this.warningDedupeWindowMs,
      }
    );

    return true;
  }

  async auditPersistedThresholds({ source = 'startup_preflight' } = {}) {
    const result = await this.db.query(
      `
        WITH invalid_policies AS (
          SELECT
            lp.id AS policy_id,
            lp.library_id,
            lp.name AS policy_name,
            l.name AS library_name,
            lp.auto_classify_threshold,
            lp.prompt_threshold
          FROM library_policies lp
          LEFT JOIN libraries l ON l.id = lp.library_id
          WHERE lp.auto_classify_threshold IS NULL
             OR lp.prompt_threshold IS NULL
             OR lp.auto_classify_threshold < 0
             OR lp.auto_classify_threshold > 95
             OR lp.prompt_threshold < 0
             OR lp.prompt_threshold > lp.auto_classify_threshold
        ),
        invalid_count AS (
          SELECT COUNT(*)::int AS count
          FROM invalid_policies
        )
        SELECT
          invalid_count.count AS invalid_count,
          COALESCE(
            JSON_AGG(sample_rows ORDER BY sample_rows.policy_id) FILTER (WHERE sample_rows.policy_id IS NOT NULL),
            '[]'::json
          ) AS sample_rows
        FROM (
          SELECT *
          FROM invalid_policies
          ORDER BY policy_id
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
    const sample = sampleRows.map(mapInvalidPolicySample);

    if (invalidCount > 0) {
      this.logger.warn(
        'Persisted library policy thresholds are invalid; conservative runtime fallback may be used',
        {
          source,
          invalidCount,
          sample,
        },
        {
          dedupeKey: 'persisted-library-policy-threshold-drift',
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

export const policyThresholdIntegrityService = new PolicyThresholdIntegrityService();
