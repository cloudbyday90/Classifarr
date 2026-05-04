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

import classificationEvidenceComparisonService from './classificationEvidenceComparisonService.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('classificationEvidenceTelemetryService');

const LOG_SAMPLE_RATE = 1.0;

class ClassificationEvidenceTelemetryService {
  constructor(deps = {}) {
    this._comparisonService = deps.comparisonService || classificationEvidenceComparisonService;
    this._sampleRate = deps.sampleRate ?? LOG_SAMPLE_RATE;
  }

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
      logger.warn('classificationEvidenceTelemetryService: comparison failed', {
        classificationId,
        error: err.message
      });
    }
  }

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

function createClassificationEvidenceTelemetryService(deps = {}) {
  return new ClassificationEvidenceTelemetryService(deps);
}

const classificationEvidenceTelemetryService = new ClassificationEvidenceTelemetryService();

export default classificationEvidenceTelemetryService;
export { ClassificationEvidenceTelemetryService, createClassificationEvidenceTelemetryService };
