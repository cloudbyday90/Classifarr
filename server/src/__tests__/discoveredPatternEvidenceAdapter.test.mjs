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

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
const mockPatternSignalCollector = { collectSignals: jest.fn() };
jest.unstable_mockModule('../services/patternSignalCollector.mjs', () => ({
  ...mockPatternSignalCollector,
  patternSignalCollector: mockPatternSignalCollector,
}));

const mockClassificationEvidenceKeyBuilder = { buildForScope: jest.fn((scope, value) => `${scope}:${String(value).toLowerCase()}`) };
jest.unstable_mockModule('../services/classificationEvidenceKeyBuilder.mjs', () => ({
  ...mockClassificationEvidenceKeyBuilder,
  classificationEvidenceKeyBuilder: mockClassificationEvidenceKeyBuilder,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { DiscoveredPatternEvidenceAdapter } = await import('../services/discoveredPatternEvidenceAdapter.mjs');

function makeAdapter() {
  return new DiscoveredPatternEvidenceAdapter({ patternSignalCollector: mockPatternSignalCollector });
}

beforeEach(() => {
  mockPatternSignalCollector.collectSignals.mockReset();
  mockClassificationEvidenceKeyBuilder.buildForScope.mockClear();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// collectRelatedEvidence
// ---------------------------------------------------------------------------

describe('collectRelatedEvidence', () => {
  const metadata = { media_type: 'movie', genres: ['Action'] };

  test('returns empty array when no signals returned', async () => {
    mockPatternSignalCollector.collectSignals.mockResolvedValueOnce([]);
    const result = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(result).toEqual([]);
  });

  test('passes minConfidence to collectSignals', async () => {
    mockPatternSignalCollector.collectSignals.mockResolvedValueOnce([]);
    await makeAdapter().collectRelatedEvidence({ metadata, minConfidence: 50 });
    expect(mockPatternSignalCollector.collectSignals).toHaveBeenCalledWith(metadata, 50);
  });

  test('defaults minConfidence=0 when not provided', async () => {
    mockPatternSignalCollector.collectSignals.mockResolvedValueOnce([]);
    await makeAdapter().collectRelatedEvidence({ metadata });
    expect(mockPatternSignalCollector.collectSignals).toHaveBeenCalledWith(metadata, 0);
  });

  test('maps signal fields to evidence shape', async () => {
    mockPatternSignalCollector.collectSignals.mockResolvedValueOnce([{
      pattern_id: 42,
      pattern_type: 'genre',
      pattern_value: 'action',
      library: { id: 5 },
      confidence: 80,
      sample_size: 10,
      status: 'approved'
    }]);

    const [item] = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(item.scope).toBe('genre');
    expect(item.libraryId).toBe(5);
    expect(item.confidence).toBe(80);
    expect(item.usageCount).toBe(10);
    expect(item.successRate).toBeNull();
    expect(item.evidenceKey).toBe('genre:action');
    expect(item.evidenceData).toEqual({ patternId: 42, patternType: 'genre', patternValue: 'action' });
    expect(item.provenance).toBe('mined');
    expect(item.source).toBe('discovered_patterns');
    expect(item.status).toBe('approved');
    expect(item.mediaType).toBe('movie');
  });

  test('uses null libraryId when signal.library is absent', async () => {
    mockPatternSignalCollector.collectSignals.mockResolvedValueOnce([{
      pattern_id: 1, pattern_type: 'keyword', pattern_value: 'spy',
      library: null, confidence: 60, sample_size: 5, status: 'candidate'
    }]);

    const [item] = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(item.libraryId).toBeNull();
  });

  test('uses null evidenceKey when pattern_value is absent', async () => {
    mockPatternSignalCollector.collectSignals.mockResolvedValueOnce([{
      pattern_id: 1, pattern_type: 'genre', pattern_value: null,
      library: null, confidence: 50, sample_size: 3, status: 'candidate'
    }]);

    const [item] = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(item.evidenceKey).toBeNull();
  });

  test('falls back to 0 for confidence when undefined', async () => {
    mockPatternSignalCollector.collectSignals.mockResolvedValueOnce([{
      pattern_id: 2, pattern_type: 'genre', pattern_value: 'drama',
      library: { id: 3 }, confidence: undefined, sample_size: undefined, status: undefined
    }]);

    const [item] = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(item.confidence).toBe(0);
    expect(item.usageCount).toBe(0);
    expect(item.status).toBe('candidate');
  });

  test('reads mediaType from metadata.mediaType as fallback', async () => {
    mockPatternSignalCollector.collectSignals.mockResolvedValueOnce([{
      pattern_id: 3, pattern_type: 'genre', pattern_value: null,
      library: null, confidence: 40, sample_size: 2, status: 'candidate'
    }]);

    const [item] = await makeAdapter().collectRelatedEvidence({ metadata: { mediaType: 'show' } });
    expect(item.mediaType).toBe('show');
  });

  test('maps multiple signals', async () => {
    mockPatternSignalCollector.collectSignals.mockResolvedValueOnce([
      { pattern_id: 1, pattern_type: 'genre', pattern_value: 'action', library: { id: 1 }, confidence: 70, sample_size: 5, status: 'approved' },
      { pattern_id: 2, pattern_type: 'keyword', pattern_value: 'spy', library: { id: 2 }, confidence: 55, sample_size: 3, status: 'candidate' }
    ]);

    const result = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(result).toHaveLength(2);
    expect(result[0].evidenceKey).toBe('genre:action');
    expect(result[1].evidenceKey).toBe('keyword:spy');
  });
});
