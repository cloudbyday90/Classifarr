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

const { ClassificationEvidenceService } = require('../services/classificationEvidenceService');

// Minimal stub deps required by the constructor
const stubDeps = {
  evidenceRepository: {
    findRelatedEvidence: jest.fn().mockResolvedValue([]),
    findExactMatch: jest.fn().mockResolvedValue(null),
    upsertEvidence: jest.fn().mockResolvedValue({}),
  },
  learningPatternEvidenceAdapter: {
    restoreLegacyPattern: jest.fn().mockResolvedValue(null),
  },
};

function makeService() {
  return new ClassificationEvidenceService(stubDeps);
}

describe('ClassificationEvidenceService.buildRelatedEvidenceSummary', () => {
  let svc;
  beforeEach(() => { svc = makeService(); });

  it('returns null when evidence array is empty', () => {
    expect(svc.buildRelatedEvidenceSummary([], [])).toBeNull();
  });

  it('returns null when evidence is not an array', () => {
    expect(svc.buildRelatedEvidenceSummary(null, [])).toBeNull();
    expect(svc.buildRelatedEvidenceSummary(undefined, [])).toBeNull();
  });

  it('returns topLibrary name matched from libraries array', () => {
    const evidence = [
      { libraryId: 3, confidence: 80, scope: 'genre', evidenceKey: 'documentary', provenance: 'learned' },
    ];
    const libraries = [{ id: 3, name: 'Documentaries' }];
    const result = svc.buildRelatedEvidenceSummary(evidence, libraries);
    expect(result.topLibrary).toBe('Documentaries');
    expect(result.confidence).toBe(80);
  });

  it('returns topLibrary null when library is not in the list', () => {
    const evidence = [{ libraryId: 99, confidence: 60, scope: 'genre', evidenceKey: 'action' }];
    const result = svc.buildRelatedEvidenceSummary(evidence, [{ id: 1, name: 'Movies' }]);
    expect(result.topLibrary).toBeNull();
  });

  it('sets hasConflict true when evidence spans multiple libraryIds', () => {
    const evidence = [
      { libraryId: 1, confidence: 80, scope: 'genre', evidenceKey: 'action' },
      { libraryId: 2, confidence: 70, scope: 'genre', evidenceKey: 'comedy' },
    ];
    const result = svc.buildRelatedEvidenceSummary(evidence, []);
    expect(result.hasConflict).toBe(true);
  });

  it('sets hasConflict false when all evidence points to the same library', () => {
    const evidence = [
      { libraryId: 1, confidence: 80, scope: 'genre', evidenceKey: 'action' },
      { libraryId: 1, confidence: 70, scope: 'genre', evidenceKey: 'thriller' },
    ];
    const result = svc.buildRelatedEvidenceSummary(evidence, []);
    expect(result.hasConflict).toBe(false);
  });

  it('topScopes is sorted descending by confidence and capped at 5', () => {
    const evidence = Array.from({ length: 8 }, (_, i) => ({
      libraryId: 1, confidence: 90 - i * 5, scope: `scope${i}`, evidenceKey: `key${i}`,
    }));
    const result = svc.buildRelatedEvidenceSummary(evidence, [{ id: 1, name: 'Movies' }]);
    expect(result.topScopes).toHaveLength(5);
    expect(result.topScopes[0].confidence).toBeGreaterThanOrEqual(result.topScopes[1].confidence);
  });

  it('uses evidenceData.genre as label when present', () => {
    const evidence = [
      { libraryId: 1, confidence: 75, scope: 'genre', evidenceKey: 'raw_key', evidenceData: { genre: 'Horror' } },
    ];
    const result = svc.buildRelatedEvidenceSummary(evidence, []);
    expect(result.topScopes[0].label).toBe('Horror');
  });

  it('falls back to evidenceKey as label when evidenceData is absent', () => {
    const evidence = [
      { libraryId: 1, confidence: 75, scope: 'keyword', evidenceKey: 'supernatural' },
    ];
    const result = svc.buildRelatedEvidenceSummary(evidence, []);
    expect(result.topScopes[0].label).toBe('supernatural');
  });
});
