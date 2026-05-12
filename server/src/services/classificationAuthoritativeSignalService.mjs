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
import { contentTypeAnalyzer as contentTypeAnalyzerModule } from './contentTypeAnalyzer.mjs';
import { classificationEvidenceService as classificationEvidenceServiceModule } from './classificationEvidenceService.mjs';
import { classificationLearnedCorrectionsService as classificationLearnedCorrectionsServiceModule } from './classificationLearnedCorrectionsService.mjs';
import { evaluateAuthoritativeSignals } from './classificationAuthoritativeSignalShared.mjs';
import { createLogger } from '../utils/logger.mjs';

const defaultLogger = createLogger('classificationAuthoritativeSignalService');

export class ClassificationAuthoritativeSignalService {
  constructor(deps = {}) {
    this.mediaSyncLibraryStateService = deps.mediaSyncLibraryStateService || mediaSyncLibraryStateServiceModule;
    this.contentTypeAnalyzer = deps.contentTypeAnalyzer || contentTypeAnalyzerModule;
    this.classificationEvidenceService = deps.classificationEvidenceService || classificationEvidenceServiceModule;
    this.classificationLearnedCorrectionsService = deps.classificationLearnedCorrectionsService || classificationLearnedCorrectionsServiceModule;
    this.logger = deps.logger || defaultLogger;
  }

  async evaluate({ metadata, mediaType, libraries }) {
    return evaluateAuthoritativeSignals({
      metadata,
      mediaType,
      libraries,
      mediaSyncLibraryStateService: this.mediaSyncLibraryStateService,
      contentTypeAnalyzer: this.contentTypeAnalyzer,
      classificationEvidenceService: this.classificationEvidenceService,
      classificationLearnedCorrectionsService: this.classificationLearnedCorrectionsService,
      logger: this.logger,
    });
  }
}

export const classificationAuthoritativeSignalService = new ClassificationAuthoritativeSignalService();
