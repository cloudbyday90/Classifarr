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

jest.mock('../services/classificationEvidenceService', () => ({
  buildRelatedEvidenceSummary: jest.fn(),
}));

const { buildSignalContext } = require('../services/policyScoringContextBuilder');
const classificationEvidenceService = require('../services/classificationEvidenceService');

beforeEach(() => {
  classificationEvidenceService.buildRelatedEvidenceSummary.mockReset();
  classificationEvidenceService.buildRelatedEvidenceSummary.mockReturnValue(null);
});

describe('policyScoringContextBuilder.buildSignalContext', () => {
  const libraries = [
    { id: 10, name: 'Movies' },
    { id: 20, name: 'Documentaries' },
  ];

  it('returns suggestedLibrary matched from ranked top library_id', () => {
    const policyResult = { confidence: 85 };
    const ranked = [{ library_id: 20, score: 90, scores: null, weights: null, breakdown: [] }];
    const ctx = buildSignalContext(policyResult, libraries, ranked, []);
    expect(ctx.suggestedLibrary).toEqual({ id: 20, name: 'Documentaries' });
    expect(ctx.confidence).toBe(85);
  });

  it('suggestedLibrary is null when ranked is empty', () => {
    const ctx = buildSignalContext({ confidence: 50 }, libraries, [], []);
    expect(ctx.suggestedLibrary).toBeNull();
    expect(ctx.ranked).toEqual([]);
  });

  it('hasConflict true when top and second-ranked differ by ≤ 10 points', () => {
    const ranked = [
      { library_id: 10, score: 80, breakdown: [] },
      { library_id: 20, score: 74, breakdown: [] },
    ];
    const ctx = buildSignalContext({}, libraries, ranked, []);
    expect(ctx.hasConflict).toBe(true);
  });

  it('hasConflict false when scores differ by more than 10', () => {
    const ranked = [
      { library_id: 10, score: 80, breakdown: [] },
      { library_id: 20, score: 65, breakdown: [] },
    ];
    const ctx = buildSignalContext({}, libraries, ranked, []);
    expect(ctx.hasConflict).toBe(false);
  });

  it('hasConflict false when only one ranked entry', () => {
    const ranked = [{ library_id: 10, score: 80, breakdown: [] }];
    const ctx = buildSignalContext({}, libraries, ranked, []);
    expect(ctx.hasConflict).toBe(false);
  });

  it('uses top.breakdown when present', () => {
    const bd = [{ type: 'preset', score: 50, weight: 1 }];
    const ranked = [{ library_id: 10, score: 80, breakdown: bd }];
    const ctx = buildSignalContext({}, libraries, ranked, []);
    expect(ctx.breakdown).toBe(bd);
  });

  it('falls back to scores-object breakdown when top.breakdown is absent', () => {
    const ranked = [{ library_id: 10, score: 80, breakdown: [], scores: { preset: 30, profile: 20 }, weights: { preset: 1, profile: 1 } }];
    const ctx = buildSignalContext({}, libraries, ranked, []);
    // breakdown is built from scores keys
    expect(ctx.breakdown.some(b => b.type === 'preset')).toBe(true);
  });

  it('calls classificationEvidenceService.buildRelatedEvidenceSummary and propagates result', () => {
    const summary = { topLibrary: 'Movies', confidence: 70, topScopes: [], hasConflict: false };
    classificationEvidenceService.buildRelatedEvidenceSummary.mockReturnValue(summary);
    const evidence = [{ libraryId: 10, confidence: 70 }];
    const ctx = buildSignalContext({}, libraries, [], evidence);
    expect(classificationEvidenceService.buildRelatedEvidenceSummary).toHaveBeenCalledWith(evidence, libraries);
    expect(ctx.relatedEvidenceSummary).toBe(summary);
  });

  it('handles undefined rankedList gracefully', () => {
    const ctx = buildSignalContext({ confidence: 0 }, libraries, undefined, []);
    expect(ctx.ranked).toEqual([]);
    expect(ctx.suggestedLibrary).toBeNull();
  });
});
