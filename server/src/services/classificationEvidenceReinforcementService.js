/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const patternReinforcementService = require('./patternReinforcementService');
const classificationEvidenceService = require('./classificationEvidenceService');
const { SIGNAL_TYPES } = require('./signalCollector');
const { normalizeMetadataList } = require('../utils/metadataNormalization');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EvidenceReinforcement');

/**
 * Phase 5: Unified reinforcement façade.
 *
 * Routes post-classification reinforcement through both:
 *   - the legacy discovered_patterns path (via patternReinforcementService), and
 *   - the unified classification_evidence path (via classificationEvidenceService).
 *
 * Callers should switch to this service instead of calling patternReinforcementService
 * directly. The new evidence writes are best-effort — failures do not propagate to callers.
 *
 * Interface mirrors patternReinforcementService so it is a drop-in replacement,
 * with an optional 4th `options` argument for the new evidence channel.
 */
class ClassificationEvidenceReinforcementService {
  constructor(deps = {}) {
    this._legacyService = deps.legacyService || patternReinforcementService;
    this._evidenceService = deps.evidenceService || classificationEvidenceService;
  }

  /**
   * Reinforce after a classification is accepted (no correction made).
   *
   * @param {number} classificationId
   * @param {Array}  patternSignals      - legacy pattern signals from signalCollector.getPatternSignals()
   * @param {number} selectedLibraryId
   * @param {object} [options]
   * @param {object} [options.metadata]  - item metadata, used to extract genres for evidence writes
   * @param {string} [options.mediaType] - 'movie' | 'show'
   */
  async reinforceOnAccept(classificationId, patternSignals, selectedLibraryId, { metadata = null, mediaType = null } = {}) {
    // 1. Legacy path: boost/decay discovered_patterns rows
    await this._legacyService.reinforceOnAccept(classificationId, patternSignals, selectedLibraryId);

    // 2. Unified evidence path: reinforce classification_evidence genre rows when
    //    genre signals were present and metadata is available.
    await this._reinforceGenreEvidence(patternSignals, selectedLibraryId, metadata, mediaType, 'system_accept', classificationId);
  }

  /**
   * Reinforce after a classification is corrected by a user.
   *
   * @param {number} classificationId
   * @param {Array}  patternSignals          - legacy pattern signals
   * @param {number} correctedLibraryId      - the library the user chose
   * @param {object} [options]
   * @param {object} [options.metadata]      - item metadata
   * @param {string} [options.mediaType]     - 'movie' | 'show'
   */
  async reinforceOnCorrection(classificationId, patternSignals, correctedLibraryId, { metadata = null, mediaType = null } = {}) {
    // 1. Legacy path: decay discovered_patterns for wrong predictions
    await this._legacyService.reinforceOnCorrection(classificationId, patternSignals, correctedLibraryId);

    // 2. Unified evidence path: write the corrected genre association so future
    //    classifications benefit from the human decision.
    await this._reinforceGenreEvidence(patternSignals, correctedLibraryId, metadata, mediaType, 'system_correction', classificationId);
  }

  /**
   * Shared internal helper: write genre evidence rows for PATTERN_GENRE signals.
   * Best-effort — any failure is logged but never thrown.
   */
  async _reinforceGenreEvidence(patternSignals, libraryId, metadata, mediaType, createdBy, classificationId) {
    const genreSignals = (patternSignals || []).filter(s => s.type === SIGNAL_TYPES.PATTERN_GENRE);
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

const instance = new ClassificationEvidenceReinforcementService();
module.exports = instance;
module.exports.ClassificationEvidenceReinforcementService = ClassificationEvidenceReinforcementService;
