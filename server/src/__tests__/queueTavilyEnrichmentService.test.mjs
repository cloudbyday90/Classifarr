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

import { jest } from '@jest/globals';
import {
  createMockDb,
  createMockLogger,
  createMockModule,
  createNamedMockModule,
  restoreAllAndResetMocks,
} from './helpers/mockFactory.mjs';

const mockTavily = {
  getContentAdvisory: jest.fn(),
  search: jest.fn(),
  searchAnimeInfo: jest.fn()
};
jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', mockTavily));

const mockMetadataNorm = { normalizeMetadataListLower: jest.fn() };
jest.unstable_mockModule('../utils/metadataNormalization.mjs', () => createMockModule(mockMetadataNorm));

const { QueueTavilyEnrichmentService } = await import('../services/queueTavilyEnrichmentService.mjs');

const makeDb = () => createMockDb();
const makeLogger = () => createMockLogger();

beforeEach(() => {
  restoreAllAndResetMocks(
    mockTavily.getContentAdvisory,
    mockTavily.search,
    mockTavily.searchAnimeInfo,
    mockMetadataNorm.normalizeMetadataListLower
  );
});

// ---------------------------------------------------------------------------
// enrich — no active tavily config
// ---------------------------------------------------------------------------

describe('enrich — no config', () => {
  test('returns enrichmentData unchanged when no active tavily config', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    const svc = new QueueTavilyEnrichmentService({ db, logger: makeLogger() });

    const enrichmentData = { omdb: {} };
    const result = await svc.enrich({ title: 'Movie', year: 2024 }, enrichmentData);
    expect(result).toBe(enrichmentData);
    expect(mockTavily.getContentAdvisory).not.toHaveBeenCalled();
  });

  test('returns enrichmentData unchanged when config has no api_key', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: null }] });
    const svc = new QueueTavilyEnrichmentService({ db, logger: makeLogger() });
    const enrichmentData = {};
    const result = await svc.enrich({ title: 'Movie', year: 2024 }, enrichmentData);
    expect(result).toBe(enrichmentData);
  });
});

// ---------------------------------------------------------------------------
// enrich — advisory results
// ---------------------------------------------------------------------------

describe('enrich — advisory enrichment', () => {
  test('adds tavily_advisory when content advisory found', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({
      rows: [{ api_key: 'key123', search_depth: 'advanced', max_results: 3 }]
    });
    mockTavily.getContentAdvisory.mockResolvedValueOnce({
      results: [{ content: 'Some advisory content' }],
      answer: 'PG-13 for action'
    });
    mockTavily.search.mockResolvedValueOnce({ answer: null });
    mockMetadataNorm.normalizeMetadataListLower.mockReturnValueOnce([]);

    const svc = new QueueTavilyEnrichmentService({ db, logger: makeLogger() });
    const enrichmentData = {};
    const result = await svc.enrich({ title: 'Action Movie', year: 2024, genres: [], original_language: 'en' }, enrichmentData);

    expect(result.tavily_advisory).toBeDefined();
    expect(result.tavily_advisory.answer).toBe('PG-13 for action');
    expect(result.tavily_advisory.content).toBe('Some advisory content');
    expect(result.tavily_advisory.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('skips advisory when no results', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] });
    mockTavily.getContentAdvisory.mockResolvedValueOnce({ results: [], answer: null });
    mockTavily.search.mockResolvedValueOnce({ answer: null });
    mockMetadataNorm.normalizeMetadataListLower.mockReturnValueOnce([]);

    const svc = new QueueTavilyEnrichmentService({ db, logger: makeLogger() });
    const result = await svc.enrich({ title: 'X', year: 2020, genres: [], original_language: 'en' }, {});
    expect(result.tavily_advisory).toBeUndefined();
  });

  test('swallows advisory error and continues', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] });
    mockTavily.getContentAdvisory.mockRejectedValueOnce(new Error('API down'));
    mockTavily.search.mockResolvedValueOnce({ answer: null });
    mockMetadataNorm.normalizeMetadataListLower.mockReturnValueOnce([]);

    const svc = new QueueTavilyEnrichmentService({ db, logger: makeLogger() });
    const result = await svc.enrich({ title: 'X', year: 2020, genres: [], original_language: 'en' }, {});
    expect(result.tavily_advisory).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// enrich — holiday results
// ---------------------------------------------------------------------------

describe('enrich — holiday enrichment', () => {
  test('adds tavily_holiday when answer found', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] });
    mockTavily.getContentAdvisory.mockResolvedValueOnce({ results: [], answer: null });
    mockTavily.search.mockResolvedValueOnce({ answer: 'Yes it is a holiday film' });
    mockMetadataNorm.normalizeMetadataListLower.mockReturnValueOnce([]);

    const svc = new QueueTavilyEnrichmentService({ db, logger: makeLogger() });
    const result = await svc.enrich({ title: 'Elf', year: 2003, genres: [], original_language: 'en' }, {});
    expect(result.tavily_holiday).toBeDefined();
    expect(result.tavily_holiday.answer).toBe('Yes it is a holiday film');
  });
});

// ---------------------------------------------------------------------------
// enrich — anime results
// ---------------------------------------------------------------------------

describe('enrich — anime enrichment', () => {
  test('adds tavily_anime for Japanese language content', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] });
    mockTavily.getContentAdvisory.mockResolvedValueOnce({ results: [], answer: null });
    mockTavily.search.mockResolvedValueOnce({ answer: null });
    mockMetadataNorm.normalizeMetadataListLower.mockReturnValueOnce(['action']);
    mockTavily.searchAnimeInfo.mockResolvedValueOnce({
      results: [
        { url: 'https://mal.net', title: 'Naruto Info', content: 'A'.repeat(600) }
      ],
      answer: 'Shonen anime'
    });

    const svc = new QueueTavilyEnrichmentService({ db, logger: makeLogger() });
    const result = await svc.enrich({ title: 'Naruto', year: 2002, genres: [], original_language: 'ja' }, {});
    expect(result.tavily_anime).toBeDefined();
    expect(result.tavily_anime.answer).toBe('Shonen anime');
    expect(result.tavily_anime.results[0].snippet).toHaveLength(500);
  });

  test('adds tavily_anime when genres contain anime', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] });
    mockTavily.getContentAdvisory.mockResolvedValueOnce({ results: [], answer: null });
    mockTavily.search.mockResolvedValueOnce({ answer: null });
    mockMetadataNorm.normalizeMetadataListLower.mockReturnValueOnce(['anime', 'action']);
    mockTavily.searchAnimeInfo.mockResolvedValueOnce({
      results: [{ url: 'https://mal.net', title: 'T', content: 'test content' }],
      answer: null
    });

    const svc = new QueueTavilyEnrichmentService({ db, logger: makeLogger() });
    await svc.enrich({ title: 'My Hero Academia', year: 2016, genres: ['Anime'], original_language: 'en' }, {});
    expect(mockTavily.searchAnimeInfo).toHaveBeenCalled();
  });

  test('swallows anime search error', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] });
    mockTavily.getContentAdvisory.mockResolvedValueOnce({ results: [], answer: null });
    mockTavily.search.mockResolvedValueOnce({ answer: null });
    mockMetadataNorm.normalizeMetadataListLower.mockReturnValueOnce([]);
    mockTavily.searchAnimeInfo.mockRejectedValueOnce(new Error('Anime API failed'));

    const svc = new QueueTavilyEnrichmentService({ db, logger: makeLogger() });
    const result = await svc.enrich({ title: 'X', year: 2020, genres: [], original_language: 'ja' }, {});
    expect(result.tavily_anime).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// enrich — top-level error handling
// ---------------------------------------------------------------------------

describe('enrich — top-level error handling', () => {
  test('returns enrichmentData unchanged on unexpected DB error', async () => {
    const db = makeDb();
    db.query.mockRejectedValueOnce(new Error('DB crash'));
    const logger = makeLogger();
    const svc = new QueueTavilyEnrichmentService({ db, logger });
    const enrichmentData = { existing: true };
    const result = await svc.enrich({ title: 'X', year: 2020 }, enrichmentData);
    expect(result).toBe(enrichmentData);
    expect(logger.warn).toHaveBeenCalled();
  });
});
