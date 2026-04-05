/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * classificationEvidenceTelemetryService.js
 *
 * Phase 3 telemetry service. Wraps the comparison service and logs
 * structured mismatch summaries for shadow-read monitoring.
 *
 * This service is NEVER on the hot classification path. All errors are
 * swallowed; a telemetry failure must never surface upstream.
 *
 * Usage:
 *   const telemetry = require('./classificationEvidenceTelemetryService');
 *   // fire-and-forget from a classification completion callback
 *   setImmediate(() => telemetry.recordClassificationEvent({ ... }));
 */

'use strict';

const classificationEvidenceComparisonService = require('./classificationEvidenceComparisonService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classificationEvidenceTelemetryService');

// Internal window for rate-limiting verbose mismatch logs
const LOG_SAMPLE_RATE = 1.0; // log every mismatch (reduce in production if noisy)

class ClassificationEvidenceTelemetryService {
  constructor(deps = {}) {
    this._comparisonService = deps.comparisonService || classificationEvidenceComparisonService;
    this._sampleRate = deps.sampleRate ?? LOG_SAMPLE_RATE;
  }

  /**
   * Record a shadow comparison for one classification event.
   * The caller does not need to await this — it is designed for fire-and-forget.
   *
   * @param {object} params
   * @param {number}   params.classificationId
   * @param {number}   params.tmdbId
   * @param {string}   params.mediaType
   * @param {object}   params.metadata
   * @param {number[]} [params.candidateLibraryIds]
   * @returns {Promise<void>}
   */
  async recordClassificationEvent({ classificationId, tmdbId, mediaType, metadata, candidateLibraryIds = [] }) {
    if (!tmdbId && !metadata) return;

    try {
      const record = await this._comparisonService.buildComparisonRecord({
        classificationId,
        tmdbId: tmdbId ?? null,
        mediaType: mediaType ?? metadata?.media_type ?? null,
        metadata: metadata ?? {},
        candidateLibraryIds
      });

      const logCtx = {
        classificationId,
        tmdbId,
        consistent: record.consistent,
        exactConsistent: record.exact?.consistent,
        relatedConsistent: record.related?.consistent,
        exactReasons: record.exact?.reasons ?? [],
        relatedReasons: record.related?.reasons ?? []
      };

      if (record.consistent) {
        logger.debug('classificationEvidence: shadow comparison consistent', logCtx);
      } else if (Math.random() < this._sampleRate) {
        logger.info('classificationEvidence: shadow comparison mismatch', {
          ...logCtx,
          relatedDetail: record.related?.detail ?? null
        });
      }
    } catch (err) {
      // Telemetry must not throw
      logger.warn('classificationEvidenceTelemetryService: comparison failed', {
        classificationId,
        error: err.message
      });
    }
  }

  /**
   * Record a batch of classification events. Returns the number of mismatches found.
   * Intended for admin/diagnostic use, not hot-path use.
   *
   * @param {object[]} events  - array of { classificationId, tmdbId, mediaType, metadata, candidateLibraryIds }
   * @returns {Promise<{ total: number, mismatches: number, errors: number }>}
   */
  async recordBatch(events) {
    const results = { total: events.length, mismatches: 0, errors: 0 };

    for (const event of events) {
      try {
        const record = await this._comparisonService.buildComparisonRecord({
          classificationId: event.classificationId,
          tmdbId: event.tmdbId ?? null,
          mediaType: event.mediaType ?? event.metadata?.media_type ?? null,
          metadata: event.metadata ?? {},
          candidateLibraryIds: event.candidateLibraryIds ?? []
        });

        if (!record.consistent) results.mismatches++;
      } catch (err) {
        results.errors++;
        logger.warn('classificationEvidenceTelemetryService.recordBatch: event failed', {
          classificationId: event.classificationId,
          error: err.message
        });
      }
    }

    return results;
  }
}

module.exports = new ClassificationEvidenceTelemetryService();
module.exports.ClassificationEvidenceTelemetryService = ClassificationEvidenceTelemetryService;
