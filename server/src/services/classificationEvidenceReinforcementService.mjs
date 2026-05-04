/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import patternReinforcementService from './patternReinforcementService.mjs';
import classificationEvidenceService from './classificationEvidenceService.mjs';
import { SIGNAL_TYPES } from './signalCollector.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('EvidenceReinforcement');

class ClassificationEvidenceReinforcementService {
  constructor(deps = {}) {
    this._legacyService = deps.legacyService || patternReinforcementService;
    this._evidenceService = deps.evidenceService || classificationEvidenceService;
  }

  async reinforceOnAccept(classificationId, patternSignals, selectedLibraryId, { metadata = null, mediaType = null } = {}) {
    await this._legacyService.reinforceOnAccept(classificationId, patternSignals, selectedLibraryId);

    await this._reinforceGenreEvidence(patternSignals, selectedLibraryId, metadata, mediaType, 'system_accept', classificationId);
  }

  async reinforceOnCorrection(classificationId, patternSignals, correctedLibraryId, { metadata = null, mediaType = null } = {}) {
    await this._legacyService.reinforceOnCorrection(classificationId, patternSignals, correctedLibraryId);

    await this._reinforceGenreEvidence(patternSignals, correctedLibraryId, metadata, mediaType, 'system_correction', classificationId);
  }

  async _reinforceGenreEvidence(patternSignals, libraryId, metadata, mediaType, createdBy, classificationId) {
    const genreSignals = (patternSignals || []).filter((signal) => signal.type === SIGNAL_TYPES.PATTERN_GENRE);
    if (genreSignals.length === 0 || !mediaType || !metadata) return;

    const genres = normalizeMetadataList(metadata.genres);
    if (genres.length === 0) return;

    try {
      await this._evidenceService.reinforceGenrePatterns({
        mediaType,
        libraryId,
        genres,
        createdBy,
      });
      logger.debug('Evidence genre patterns reinforced', {
        classificationId,
        libraryId,
        genres,
        createdBy,
      });
    } catch (error) {
      logger.warn('Evidence genre reinforcement failed (non-fatal)', {
        classificationId,
        libraryId,
        error: error.message,
      });
    }
  }
}

const classificationEvidenceReinforcementService = new ClassificationEvidenceReinforcementService();

export default classificationEvidenceReinforcementService;
export { ClassificationEvidenceReinforcementService };
