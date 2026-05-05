/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { mediaSyncLibraryStateService as mediaSyncLibraryStateServiceModule } from './mediaSyncLibraryStateService.mjs';
import contentTypeAnalyzerModule from './contentTypeAnalyzer.mjs';
import { classificationEvidenceService as classificationEvidenceServiceModule } from './classificationEvidenceService.mjs';
import { classificationLearnedCorrectionsService as classificationLearnedCorrectionsServiceModule } from './classificationLearnedCorrectionsService.mjs';
import loggerModule from '../utils/logger.mjs';

const { createLogger } = loggerModule;
const defaultLogger = createLogger('classificationAuthoritativeSignalService');

class ClassificationAuthoritativeSignalService {
  constructor(deps = {}) {
    this.mediaSyncLibraryStateService = deps.mediaSyncLibraryStateService || mediaSyncLibraryStateServiceModule;
    this.contentTypeAnalyzer = deps.contentTypeAnalyzer || contentTypeAnalyzerModule;
    this.classificationEvidenceService = deps.classificationEvidenceService || classificationEvidenceServiceModule;
    this.classificationLearnedCorrectionsService = deps.classificationLearnedCorrectionsService || classificationLearnedCorrectionsServiceModule;
    this.logger = deps.logger || defaultLogger;
  }

  async evaluate({ metadata, mediaType, libraries }) {
    if (metadata.source_library_id) {
      const sourceLibrary = libraries.find((library) => library.id === metadata.source_library_id);
      if (sourceLibrary) {
        this.logger.info('Using source Plex library for classification', {
          title: metadata.title,
          library: sourceLibrary.name,
        });
        return {
          relatedEvidence: [],
          result: {
            library: sourceLibrary,
            confidence: 100,
            method: 'source_library',
            reason: `Already in library: ${sourceLibrary.name} (from Plex)`,
            libraries,
          },
        };
      }
    }

    const learnedCorrection = await this.classificationLearnedCorrectionsService.checkLearnedCorrections(
      metadata.tmdb_id,
      metadata.media_type,
    );
    if (learnedCorrection) {
      const correctedLibrary = libraries.find((library) => library.id === learnedCorrection.corrected_library_id);
      if (correctedLibrary) {
        this.logger.info('Matched learned correction from user', {
          title: metadata.title,
          library: correctedLibrary.name,
          correctedAt: learnedCorrection.created_at,
        });
        return {
          relatedEvidence: [],
          result: {
            library: correctedLibrary,
            confidence: 100,
            method: 'manual_correction',
            reason: `Previously corrected by user: ${learnedCorrection.corrected_by || 'user'}`,
            libraries,
          },
        };
      }
    }

    const existingMedia = await this.mediaSyncLibraryStateService.findExistingMedia(metadata.tmdb_id, mediaType);
    if (existingMedia) {
      this.logger.info('Media already exists in library', {
        tmdbId: metadata.tmdb_id,
        library: existingMedia.library_name,
      });
      return {
        relatedEvidence: [],
        result: {
          library: libraries.find((library) => library.id === existingMedia.library_id),
          confidence: 100,
          method: 'existing_media',
          reason: `Already exists in ${existingMedia.library_name}`,
          libraries,
        },
      };
    }

    const contentAnalysis = await this.contentTypeAnalyzer.analyze(metadata);
    if (contentAnalysis.analyzed && contentAnalysis.bestMatch) {
      this.logger.info('Content type detected', {
        type: contentAnalysis.bestMatch.type,
        confidence: contentAnalysis.bestMatch.confidence,
      });
      metadata.contentAnalysis = contentAnalysis;
    }

    const exactMatch = await this.classificationEvidenceService.findExactMatch({
      tmdbId: metadata.tmdb_id,
      mediaType,
    });
    if (exactMatch) {
      return {
        relatedEvidence: [],
        result: {
          library: libraries.find((library) => library.id === exactMatch.libraryId),
          confidence: 100,
          method: 'exact_match',
          reason: 'Previously classified and confirmed',
          libraries,
        },
      };
    }

    const relatedEvidence = await this.classificationEvidenceService.collectRelatedEvidence({ metadata });
    if (relatedEvidence.length > 0) {
      const top = [...relatedEvidence].sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))[0];
      this.logger.info('Related evidence collected for PolicyEngine scoring', {
        title: metadata.title,
        evidenceCount: relatedEvidence.length,
        topLibraryId: top?.libraryId ?? null,
        topConfidence: top?.confidence ?? 0,
        topScope: top?.scope ?? null,
        uniqueScopes: [...new Set(relatedEvidence.map((evidence) => evidence.scope).filter(Boolean))],
      });
    }

    return { relatedEvidence, result: null };
  }
}

const classificationAuthoritativeSignalService = new ClassificationAuthoritativeSignalService();

export {
  ClassificationAuthoritativeSignalService,
  classificationAuthoritativeSignalService,
};
