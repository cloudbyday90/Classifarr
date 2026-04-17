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

'use strict';

jest.mock('../services/patternSignalCollector', () => ({ collectSignals: jest.fn() }));
jest.mock('../services/classificationEvidenceKeyBuilder', () => ({ buildForScope: jest.fn() }));
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
  }))
}));

const patternSignalCollector = require('../services/patternSignalCollector');
const evidenceKeyBuilder = require('../services/classificationEvidenceKeyBuilder');
const { DiscoveredPatternEvidenceAdapter } = require('../services/discoveredPatternEvidenceAdapter');

function makeAdapter() {
  return new DiscoveredPatternEvidenceAdapter({ patternSignalCollector });
}

beforeEach(() => {
  patternSignalCollector.collectSignals.mockReset();
  evidenceKeyBuilder.buildForScope.mockReset();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// collectRelatedEvidence
// ---------------------------------------------------------------------------

describe('collectRelatedEvidence', () => {
  const metadata = { media_type: 'movie', genres: ['Action'] };

  test('returns empty array when no signals returned', async () => {
    patternSignalCollector.collectSignals.mockResolvedValueOnce([]);
    const result = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(result).toEqual([]);
  });

  test('passes minConfidence to collectSignals', async () => {
    patternSignalCollector.collectSignals.mockResolvedValueOnce([]);
    await makeAdapter().collectRelatedEvidence({ metadata, minConfidence: 50 });
    expect(patternSignalCollector.collectSignals).toHaveBeenCalledWith(metadata, 50);
  });

  test('defaults minConfidence=0 when not provided', async () => {
    patternSignalCollector.collectSignals.mockResolvedValueOnce([]);
    await makeAdapter().collectRelatedEvidence({ metadata });
    expect(patternSignalCollector.collectSignals).toHaveBeenCalledWith(metadata, 0);
  });

  test('maps signal fields to evidence shape', async () => {
    evidenceKeyBuilder.buildForScope.mockReturnValueOnce('genre:action');
    patternSignalCollector.collectSignals.mockResolvedValueOnce([{
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
    evidenceKeyBuilder.buildForScope.mockReturnValueOnce('keyword:spy');
    patternSignalCollector.collectSignals.mockResolvedValueOnce([{
      pattern_id: 1, pattern_type: 'keyword', pattern_value: 'spy',
      library: null, confidence: 60, sample_size: 5, status: 'candidate'
    }]);

    const [item] = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(item.libraryId).toBeNull();
  });

  test('uses null evidenceKey when pattern_value is absent', async () => {
    patternSignalCollector.collectSignals.mockResolvedValueOnce([{
      pattern_id: 1, pattern_type: 'genre', pattern_value: null,
      library: null, confidence: 50, sample_size: 3, status: 'candidate'
    }]);

    const [item] = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(item.evidenceKey).toBeNull();
    expect(evidenceKeyBuilder.buildForScope).not.toHaveBeenCalled();
  });

  test('falls back to 0 for confidence when undefined', async () => {
    evidenceKeyBuilder.buildForScope.mockReturnValueOnce('genre:drama');
    patternSignalCollector.collectSignals.mockResolvedValueOnce([{
      pattern_id: 2, pattern_type: 'genre', pattern_value: 'drama',
      library: { id: 3 }, confidence: undefined, sample_size: undefined, status: undefined
    }]);

    const [item] = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(item.confidence).toBe(0);
    expect(item.usageCount).toBe(0);
    expect(item.status).toBe('candidate');
  });

  test('reads mediaType from metadata.mediaType as fallback', async () => {
    patternSignalCollector.collectSignals.mockResolvedValueOnce([{
      pattern_id: 3, pattern_type: 'genre', pattern_value: null,
      library: null, confidence: 40, sample_size: 2, status: 'candidate'
    }]);

    const [item] = await makeAdapter().collectRelatedEvidence({ metadata: { mediaType: 'show' } });
    expect(item.mediaType).toBe('show');
  });

  test('maps multiple signals', async () => {
    evidenceKeyBuilder.buildForScope.mockReturnValue('key');
    patternSignalCollector.collectSignals.mockResolvedValueOnce([
      { pattern_id: 1, pattern_type: 'genre', pattern_value: 'action', library: { id: 1 }, confidence: 70, sample_size: 5, status: 'approved' },
      { pattern_id: 2, pattern_type: 'keyword', pattern_value: 'spy', library: { id: 2 }, confidence: 55, sample_size: 3, status: 'candidate' }
    ]);

    const result = await makeAdapter().collectRelatedEvidence({ metadata });
    expect(result).toHaveLength(2);
  });
});
