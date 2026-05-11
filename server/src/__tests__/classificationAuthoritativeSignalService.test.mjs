/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { createMockLogger, createMockModule, createNamedMockModule, createServiceStubs } from './helpers/mockFactory.mjs';

const mediaSyncLibraryStateService = createServiceStubs(['findExistingMedia']);

const contentTypeAnalyzer = createServiceStubs(['analyze']);

const classificationEvidenceService = createServiceStubs(['findExactMatch', 'collectRelatedEvidence']);

const classificationLearnedCorrectionsService = createServiceStubs(['checkLearnedCorrections']);

const logger = createMockLogger();

const loggerModule = {
  createLogger: jest.fn(() => logger),
};

jest.unstable_mockModule('../services/mediaSyncLibraryStateService.mjs', () => ({
  mediaSyncLibraryStateService,
}));
jest.unstable_mockModule('../services/contentTypeAnalyzer.mjs', () => createNamedMockModule('contentTypeAnalyzer', contentTypeAnalyzer));
jest.unstable_mockModule('../services/classificationEvidenceService.mjs', () => ({
  ...classificationEvidenceService,
  classificationEvidenceService,
}));
jest.unstable_mockModule('../services/classificationLearnedCorrectionsService.mjs', () => ({
  ...classificationLearnedCorrectionsService,
  classificationLearnedCorrectionsService,
}));
jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(loggerModule));

const { ClassificationAuthoritativeSignalService } = await import('../services/classificationAuthoritativeSignalService.mjs');

const libraries = [
  { id: 1, name: 'Movies' },
  { id: 2, name: 'Shows' },
];

function makeService() {
  return new ClassificationAuthoritativeSignalService({
    mediaSyncLibraryStateService,
    contentTypeAnalyzer,
    classificationEvidenceService,
    classificationLearnedCorrectionsService,
    logger,
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mediaSyncLibraryStateService.findExistingMedia.mockResolvedValue(null);
  contentTypeAnalyzer.analyze.mockResolvedValue({ analyzed: false, bestMatch: null });
  classificationEvidenceService.findExactMatch.mockResolvedValue(null);
  classificationEvidenceService.collectRelatedEvidence.mockResolvedValue([]);
  classificationLearnedCorrectionsService.checkLearnedCorrections.mockResolvedValue(null);
});

describe('ClassificationAuthoritativeSignalService.evaluate', () => {
  test('returns source_library result immediately when metadata already has an active source library', async () => {
    const metadata = { title: 'Example', tmdb_id: 101, media_type: 'movie', source_library_id: 1 };

    const result = await makeService().evaluate({ metadata, mediaType: 'movie', libraries });

    expect(result.result.method).toBe('source_library');
    expect(result.result.library).toEqual(libraries[0]);
    expect(classificationLearnedCorrectionsService.checkLearnedCorrections).not.toHaveBeenCalled();
  });

  test('returns manual_correction result when a learned correction matches an active library', async () => {
    classificationLearnedCorrectionsService.checkLearnedCorrections.mockResolvedValue({
      corrected_library_id: 2,
      corrected_by: 'user',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    const metadata = { title: 'Example', tmdb_id: 101, media_type: 'movie' };

    const result = await makeService().evaluate({ metadata, mediaType: 'movie', libraries });

    expect(result.result.method).toBe('manual_correction');
    expect(result.result.library).toEqual(libraries[1]);
    expect(mediaSyncLibraryStateService.findExistingMedia).not.toHaveBeenCalled();
  });

  test('returns existing_media result when media sync finds a prior item', async () => {
    mediaSyncLibraryStateService.findExistingMedia.mockResolvedValue({
      library_id: 1,
      library_name: 'Movies',
    });
    const metadata = { title: 'Example', tmdb_id: 101, media_type: 'movie' };

    const result = await makeService().evaluate({ metadata, mediaType: 'movie', libraries });

    expect(result.result.method).toBe('existing_media');
    expect(result.result.library).toEqual(libraries[0]);
    expect(contentTypeAnalyzer.analyze).not.toHaveBeenCalled();
  });

  test('stores contentAnalysis and returns exact_match when exact evidence exists', async () => {
    contentTypeAnalyzer.analyze.mockResolvedValue({
      analyzed: true,
      bestMatch: { type: 'anime', confidence: 88 },
    });
    classificationEvidenceService.findExactMatch.mockResolvedValue({ libraryId: 2, confidence: 100 });
    const metadata = { title: 'Example', tmdb_id: 101, media_type: 'movie' };

    const result = await makeService().evaluate({ metadata, mediaType: 'movie', libraries });

    expect(metadata.contentAnalysis).toEqual({
      analyzed: true,
      bestMatch: { type: 'anime', confidence: 88 },
    });
    expect(result.result.method).toBe('exact_match');
    expect(result.result.library).toEqual(libraries[1]);
  });

  test('returns related evidence when no authoritative result exists', async () => {
    const relatedEvidence = [
      { scope: 'genre', libraryId: 1, confidence: 72 },
      { scope: 'studio', libraryId: 2, confidence: 55 },
    ];
    classificationEvidenceService.collectRelatedEvidence.mockResolvedValue(relatedEvidence);
    const metadata = { title: 'Example', tmdb_id: 101, media_type: 'movie' };

    const result = await makeService().evaluate({ metadata, mediaType: 'movie', libraries });

    expect(result.result).toBeNull();
    expect(result.relatedEvidence).toEqual(relatedEvidence);
    expect(classificationEvidenceService.collectRelatedEvidence).toHaveBeenCalledWith({ metadata });
  });
});
