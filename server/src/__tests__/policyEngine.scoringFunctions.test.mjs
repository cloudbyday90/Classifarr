/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Unit tests for PolicyEngine pure scoring functions.
 * These functions have no DB / external-service dependencies and can be
 * exercised directly via the exported singleton instance.
 */

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
const mockPatternSignalCollector = { collectSignals: jest.fn() };
const mockRagRetriever = { semanticSearch: jest.fn(), getSuggestedLibrary: jest.fn() };
const mockLibraryProfileService = { getProfileScore: jest.fn(), getProfileStats: jest.fn() };
const mockPolicyDecisionBuilder = { normalizeResult: jest.fn(r => r) };
const mockPolicyExclusionService = {
  applyMediaTypeFilter: jest.fn(),
  detectLanguageConflicts: jest.fn(),
  filterValidEvaluations: jest.fn(),
  hasStrictSignalConstraint: jest.fn(),
};
const mockPolicyCandidateRanker = { rankResults: jest.fn(), determineAction: jest.fn() };
const mockLogger = { createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) };

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/patternSignalCollector.mjs', () => ({
  ...mockPatternSignalCollector,
  patternSignalCollector: mockPatternSignalCollector,
}));

jest.unstable_mockModule('../services/ragRetriever.mjs', () => createNamedMockModule('ragRetriever', mockRagRetriever));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => createNamedMockModule('libraryProfileService', mockLibraryProfileService));

jest.unstable_mockModule('../services/policyDecisionBuilder.mjs', () => createNamedMockModule('policyDecisionBuilder', mockPolicyDecisionBuilder));

jest.unstable_mockModule('../services/policyExclusionService.mjs', () => createNamedMockModule('policyExclusionService', mockPolicyExclusionService));

jest.unstable_mockModule('../services/policyCandidateRanker.mjs', () => ({
  policyCandidateRanker: mockPolicyCandidateRanker,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

const db = mockDb;
const { policyEngine } = await import('../services/policyEngine.mjs');

describe('PolicyEngine.scoreCertification', () => {
  test('include mode: returns 100 when cert is in the include list', () => {
    expect(policyEngine.scoreCertification({ mode: 'include', include: ['PG', 'G'] }, { certification: 'PG' })).toBe(100);
  });

  test('include mode: returns 0 when cert is NOT in the include list', () => {
    expect(policyEngine.scoreCertification({ mode: 'include', include: ['G'] }, { certification: 'R' })).toBe(0);
  });

  test('include mode: case-insensitive match', () => {
    expect(policyEngine.scoreCertification({ mode: 'include', include: ['pg'] }, { certification: 'PG' })).toBe(100);
  });

  test('exclude mode: returns 0 when cert is in the exclude list', () => {
    expect(policyEngine.scoreCertification({ mode: 'exclude', exclude: ['R', 'NC-17'] }, { certification: 'R' })).toBe(0);
  });

  test('exclude mode: returns 100 when cert is NOT in the exclude list', () => {
    expect(policyEngine.scoreCertification({ mode: 'exclude', exclude: ['R'] }, { certification: 'PG' })).toBe(100);
  });

  test('max mode: returns 100 when cert is within the max (same as max)', () => {
    expect(policyEngine.scoreCertification({ mode: 'max', max: 'PG-13' }, { certification: 'PG-13' })).toBe(100);
  });

  test('max mode: returns 100 when cert is below the max', () => {
    expect(policyEngine.scoreCertification({ mode: 'max', max: 'PG-13' }, { certification: 'G' })).toBe(100);
  });

  test('max mode: returns 0 when cert exceeds the max', () => {
    expect(policyEngine.scoreCertification({ mode: 'max', max: 'PG' }, { certification: 'R' })).toBe(0);
  });

  test('max mode: returns 50 when movie and TV certifications are mixed', () => {
    expect(policyEngine.scoreCertification({ mode: 'max', max: 'PG-13' }, { media_type: 'movie', certification: 'TV-14' })).toBe(50);
  });

  test('max mode: returns 50 when either cert is unknown to the order list', () => {
    expect(policyEngine.scoreCertification({ mode: 'max', max: 'UNRATED' }, { certification: 'PG' })).toBe(50);
  });

  test('returns 0 when item has no certification', () => {
    expect(policyEngine.scoreCertification({ mode: 'include', include: ['PG'] }, {})).toBe(0);
  });

  test('returns 0 on unknown mode', () => {
    expect(policyEngine.scoreCertification({ mode: 'unknown' }, { certification: 'PG' })).toBe(0);
  });

  test('returns 0 on thrown error (bad config)', () => {
    expect(policyEngine.scoreCertification(null, { certification: 'PG' })).toBe(0);
  });
});

describe('PolicyEngine.scoreGenres', () => {
  const anyItem = (genres) => ({ genres });

  test('returns 0 when required genres are missing and item has no genres', () => {
    expect(policyEngine.scoreGenres({ require_any: ['Drama'] }, anyItem([]))).toBe(0);
  });

  test('returns 50 when item has no genres and config is advisory-only', () => {
    expect(policyEngine.scoreGenres({ prefer: ['Drama'], exclude: ['Horror'] }, anyItem([]))).toBe(50);
  });

  test('require_all: returns 100 when all required genres are present', () => {
    expect(policyEngine.scoreGenres({ require_all: ['drama', 'thriller'] }, anyItem(['Drama', 'Thriller', 'Action']))).toBe(100);
  });

  test('require_all: returns 0 when any required genre is missing', () => {
    expect(policyEngine.scoreGenres({ require_all: ['Drama', 'Horror'] }, anyItem(['Drama']))).toBe(0);
  });

  test('require_any: returns 80 or higher when at least one genre matches', () => {
    const score = policyEngine.scoreGenres({ require_any: ['Documentary', 'Drama'] }, anyItem(['Documentary']));
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('require_any: returns 0 when no genre matches', () => {
    expect(policyEngine.scoreGenres({ require_any: ['Horror'] }, anyItem(['Comedy']))).toBe(0);
  });

  test('prefer: boosts score proportionally to match count', () => {
    const one = policyEngine.scoreGenres({ prefer: ['Drama', 'Thriller'] }, anyItem(['Drama']));
    const two = policyEngine.scoreGenres({ prefer: ['Drama', 'Thriller'] }, anyItem(['Drama', 'Thriller']));
    expect(two).toBeGreaterThan(one);
  });

  test('exclude: returns 0 when an excluded genre is present', () => {
    expect(policyEngine.scoreGenres({ exclude: ['Horror'] }, anyItem(['Horror', 'Drama']))).toBe(0);
  });

  test('exclude: returns base score when excluded genre is absent', () => {
    const score = policyEngine.scoreGenres({ exclude: ['Horror'] }, anyItem(['Drama']));
    expect(score).toBe(50);
  });

  test('returns 0 on error (bad config)', () => {
    expect(policyEngine.scoreGenres(null, anyItem(['Drama']))).toBe(0);
  });
});

describe('PolicyEngine.scoreKeywords', () => {
  const item = (keywords, overview = '', title = '') => ({ keywords, overview, title });

  test('require_any: returns 80 when a keyword matches in the keyword list', () => {
    const score = policyEngine.scoreKeywords({ require_any: ['nature'] }, item(['nature', 'wildlife']));
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('require_any: matches against overview text', () => {
    const score = policyEngine.scoreKeywords({ require_any: ['space'] }, item([], 'A documentary about space exploration'));
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('require_any: returns 0 when no keyword found in any text', () => {
    expect(policyEngine.scoreKeywords({ require_any: ['horror'] }, item(['comedy'], 'Light film', 'Fun'))).toBe(0);
  });

  test('does not satisfy require_any through substring accidents', () => {
    expect(policyEngine.scoreKeywords({ require_any: ['art'] }, item([], 'A martial arts epic', 'The Cartographer'))).toBe(0);
  });

  test('does not trigger exclude through substring accidents', () => {
    expect(policyEngine.scoreKeywords({ exclude: ['war'] }, item([], 'A story about reward points', 'Awards Night'))).toBe(50);
  });

  test('matches keywords across punctuation boundaries without dynamic regex construction', () => {
    const score = policyEngine.scoreKeywords({ require_any: ['sci-fi'] }, item([], 'A bold sci-fi adventure', 'Launch Window'));
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('prefer: boosts score for matching keywords', () => {
    const one = policyEngine.scoreKeywords({ prefer: ['war', 'history'] }, item(['war']));
    const two = policyEngine.scoreKeywords({ prefer: ['war', 'history'] }, item(['war', 'history']));
    expect(two).toBeGreaterThan(one);
  });

  test('exclude: returns 0 when excluded keyword is found', () => {
    expect(policyEngine.scoreKeywords({ exclude: ['nudity'] }, item(['nudity', 'drama']))).toBe(0);
  });

  test('returns 50 base when no constraints provided', () => {
    expect(policyEngine.scoreKeywords({}, item(['drama']))).toBe(50);
  });

  test('returns 0 on error (bad config)', () => {
    expect(policyEngine.scoreKeywords(null, item(['drama']))).toBe(0);
  });
});

describe('PolicyEngine.scoreStudios', () => {
  test('require_any: matches studios by name (object array)', () => {
    const item = { production_companies: [{ name: 'Pixar Animation Studios' }] };
    const score = policyEngine.scoreStudios({ require_any: ['Pixar'] }, item);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('require_any: matches on string studio array', () => {
    const item = { studios: ['Warner Bros', 'Universal'] };
    const score = policyEngine.scoreStudios({ require_any: ['Warner'] }, item);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('require_any: returns 0 when no studio matches', () => {
    const item = { studios: ['Pixar'] };
    expect(policyEngine.scoreStudios({ require_any: ['Universal'] }, item)).toBe(0);
  });

  test('returns 50 neutral when item has no studios and no require_any', () => {
    expect(policyEngine.scoreStudios({}, {})).toBe(50);
  });

  test('returns 0 when item has no studios but require_any is set', () => {
    expect(policyEngine.scoreStudios({ require_any: ['Universal'] }, {})).toBe(0);
  });

  test('parses JSON string for studios field', () => {
    const item = { studios: JSON.stringify([{ name: 'A24' }]) };
    const score = policyEngine.scoreStudios({ require_any: ['A24'] }, item);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('prefer: boosts score for matching studios', () => {
    const item = { studios: ['A24', 'Neon'] };
    const base = policyEngine.scoreStudios({}, item);
    const boosted = policyEngine.scoreStudios({ prefer: ['A24'] }, item);
    expect(boosted).toBeGreaterThanOrEqual(base);
  });

  test('returns 0 on error (bad config)', () => {
    expect(policyEngine.scoreStudios(null, {})).toBe(0);
  });
});

describe('PolicyEngine.scoreReleaseYear', () => {
  test('returns 100 when year is within min/max range', () => {
    expect(policyEngine.scoreReleaseYear({ min: 2000, max: 2020 }, { year: 2010 })).toBe(100);
  });

  test('returns 0 when year is below min', () => {
    expect(policyEngine.scoreReleaseYear({ min: 2000 }, { year: 1995 })).toBe(0);
  });

  test('returns 0 when year is above max', () => {
    expect(policyEngine.scoreReleaseYear({ max: 2010 }, { year: 2015 })).toBe(0);
  });

  test('returns 80 when only one bound (min) is set and year satisfies it', () => {
    expect(policyEngine.scoreReleaseYear({ min: 2000 }, { year: 2010 })).toBe(80);
  });

  test('returns 80 when only one bound (max) is set and year satisfies it', () => {
    expect(policyEngine.scoreReleaseYear({ max: 2020 }, { year: 2010 })).toBe(80);
  });

  test('treats zero as a real year value when comparing bounds', () => {
    expect(policyEngine.scoreReleaseYear({ max: 1 }, { year: 0 })).toBe(80);
  });

  test('returns 50 when no bounds are set', () => {
    expect(policyEngine.scoreReleaseYear({}, { year: 2010 })).toBe(50);
  });

  test('returns 50 when item has no year', () => {
    expect(policyEngine.scoreReleaseYear({ min: 2000 }, {})).toBe(50);
  });

  test('returns 0 on error (bad config)', () => {
    expect(policyEngine.scoreReleaseYear(null, { year: 2010 })).toBe(0);
  });
});

describe('PolicyEngine.scoreVoteAverage', () => {
  test('returns 100 when rating is within min/max', () => {
    expect(policyEngine.scoreVoteAverage({ min: 7, max: 10 }, { rating: 8.5 })).toBe(100);
  });

  test('returns 0 when rating is below min', () => {
    expect(policyEngine.scoreVoteAverage({ min: 7 }, { rating: 5 })).toBe(0);
  });

  test('returns 0 when rating is above max', () => {
    expect(policyEngine.scoreVoteAverage({ max: 8 }, { vote_average: 9 })).toBe(0);
  });

  test('returns 80 with only one bound set and within range', () => {
    expect(policyEngine.scoreVoteAverage({ min: 6 }, { rating: 8 })).toBe(80);
  });

  test('treats zero as a real vote average when comparing bounds', () => {
    expect(policyEngine.scoreVoteAverage({ max: 1 }, { vote_average: 0 })).toBe(80);
  });

  test('returns 50 when item has no rating', () => {
    expect(policyEngine.scoreVoteAverage({ min: 7 }, {})).toBe(50);
  });

  test('uses vote_average field as fallback for rating', () => {
    expect(policyEngine.scoreVoteAverage({ min: 7, max: 10 }, { vote_average: 8 })).toBe(100);
  });
});

describe('PolicyEngine.scoreRuntime', () => {
  test('returns 100 when runtime is within min/max minutes', () => {
    expect(policyEngine.scoreRuntime({ min_minutes: 60, max_minutes: 180 }, { runtime: 120 })).toBe(100);
  });

  test('returns 0 when runtime is below min', () => {
    expect(policyEngine.scoreRuntime({ min_minutes: 90 }, { runtime: 45 })).toBe(0);
  });

  test('returns 0 when runtime is above max', () => {
    expect(policyEngine.scoreRuntime({ max_minutes: 120 }, { runtime: 180 })).toBe(0);
  });

  test('returns 80 with only one bound satisfied', () => {
    expect(policyEngine.scoreRuntime({ min_minutes: 60 }, { runtime: 90 })).toBe(80);
  });

  test('treats zero as a real runtime when comparing bounds', () => {
    expect(policyEngine.scoreRuntime({ max_minutes: 1 }, { runtime: 0 })).toBe(80);
  });

  test('returns 50 when item has no runtime', () => {
    expect(policyEngine.scoreRuntime({ min_minutes: 60 }, {})).toBe(50);
  });
});

describe('PolicyEngine.scoreLanguage', () => {
  test('require_any: returns 80 when language is in list', () => {
    const score = policyEngine.scoreLanguage({ require_any: ['en', 'fr'] }, { original_language: 'en' });
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('require_any: returns 0 when language is not in list', () => {
    expect(policyEngine.scoreLanguage({ require_any: ['ja'] }, { original_language: 'en' })).toBe(0);
  });

  test('prefer: returns 90 when language is preferred', () => {
    expect(policyEngine.scoreLanguage({ prefer: ['en'] }, { original_language: 'en' })).toBe(90);
  });

  test('prefer: returns 50 when language is not preferred but also not excluded', () => {
    expect(policyEngine.scoreLanguage({ prefer: ['en'] }, { original_language: 'fr' })).toBe(50);
  });

  test('exclude: returns 0 when language is excluded', () => {
    expect(policyEngine.scoreLanguage({ exclude: ['en'] }, { original_language: 'en' })).toBe(0);
  });

  test('case-insensitive matching for require_any', () => {
    const score = policyEngine.scoreLanguage({ require_any: ['EN'] }, { original_language: 'en' });
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('returns 50 when item has no language', () => {
    expect(policyEngine.scoreLanguage({ require_any: ['en'] }, {})).toBe(50);
  });
});

describe('PolicyEngine.scoreMediaType', () => {
  test('returns 100 when media type is in include list', () => {
    expect(policyEngine.scoreMediaType({ include: ['movie'] }, { media_type: 'movie' })).toBe(100);
  });

  test('returns 0 when media type is NOT in include list', () => {
    expect(policyEngine.scoreMediaType({ include: ['movie'] }, { media_type: 'tv' })).toBe(0);
  });

  test('case-insensitive match', () => {
    expect(policyEngine.scoreMediaType({ include: ['Movie'] }, { media_type: 'movie' })).toBe(100);
  });

  test('returns 50 when item has no media_type', () => {
    expect(policyEngine.scoreMediaType({ include: ['movie'] }, {})).toBe(50);
  });

  test('returns 0 on error (bad config)', () => {
    expect(policyEngine.scoreMediaType(null, { media_type: 'movie' })).toBe(0);
  });
});

describe('PolicyEngine.calculateAgreementMultiplier', () => {
  const policy = (opts = {}) => ({
    presets: opts.presets ?? [{ id: 1 }],
    trust_patterns: opts.trust_patterns ?? true,
    trust_rag: opts.trust_rag ?? true,
    trust_history: opts.trust_history ?? true
  });

  test('returns 1.0 multiplier when only one signal contributes', () => {
    const { multiplier, contributing } = policyEngine.calculateAgreementMultiplier(
      { preset: 0, profile: 80, pattern: 0, rag: 0, history: 0 },
      policy()
    );
    expect(contributing).toBe(1);
    expect(multiplier).toBe(1.0);
  });

  test('returns 1.05 multiplier for 2 contributing signals', () => {
    const { multiplier, contributing } = policyEngine.calculateAgreementMultiplier(
      { preset: 70, profile: 60, pattern: 0, rag: 0, history: 0 },
      policy()
    );
    expect(contributing).toBe(2);
    expect(multiplier).toBe(1.05);
  });

  test('returns 1.12 multiplier for 3 contributing signals', () => {
    const { multiplier, contributing } = policyEngine.calculateAgreementMultiplier(
      { preset: 70, profile: 60, pattern: 55, rag: 0, history: 0 },
      policy()
    );
    expect(contributing).toBe(3);
    expect(multiplier).toBe(1.12);
  });

  test('returns 1.20 multiplier for 4 contributing signals', () => {
    const { multiplier, contributing } = policyEngine.calculateAgreementMultiplier(
      { preset: 70, profile: 60, pattern: 55, rag: 50, history: 0 },
      policy()
    );
    expect(contributing).toBe(4);
    expect(multiplier).toBe(1.20);
  });

  test('returns 1.30 multiplier for 5 contributing signals', () => {
    const { multiplier, contributing } = policyEngine.calculateAgreementMultiplier(
      { preset: 70, profile: 60, pattern: 55, rag: 50, history: 45 },
      policy()
    );
    expect(contributing).toBe(5);
    expect(multiplier).toBe(1.30);
  });

  test('disabled trust_patterns is not counted even if score > 0', () => {
    const { contributing } = policyEngine.calculateAgreementMultiplier(
      { preset: 70, profile: 60, pattern: 80, rag: 0, history: 0 },
      policy({ trust_patterns: false })
    );
    expect(contributing).toBe(2);
  });

  test('counts 0 contributing when all scores are 0', () => {
    const { contributing, multiplier } = policyEngine.calculateAgreementMultiplier(
      { preset: 0, profile: 0, pattern: 0, rag: 0, history: 0 },
      policy()
    );
    expect(contributing).toBe(0);
    expect(multiplier).toBe(1.0);
  });
});

describe('PolicyEngine.scoreRelatedEvidence', () => {
  test('returns 0 for empty evidence array', async () => {
    expect(await policyEngine.scoreRelatedEvidence(5, [])).toBe(0);
  });

  test('returns 0 for null evidence', async () => {
    expect(await policyEngine.scoreRelatedEvidence(5, null)).toBe(0);
  });

  test('returns 0 when no evidence matches the libraryId', async () => {
    const evidence = [{ libraryId: 99, confidence: 90 }];
    expect(await policyEngine.scoreRelatedEvidence(5, evidence)).toBe(0);
  });

  test('returns top confidence for matching libraryId', async () => {
    const evidence = [
      { libraryId: 5, confidence: 80 },
      { libraryId: 5, confidence: 60 }
    ];
    expect(await policyEngine.scoreRelatedEvidence(5, evidence)).toBe(80);
  });

  test('caps at FORMULA_CONFIDENCE_CAP (95)', async () => {
    const evidence = [{ libraryId: 5, confidence: 100 }];
    const score = await policyEngine.scoreRelatedEvidence(5, evidence);
    expect(score).toBe(95);
  });
});

describe('PolicyEngine.scoreRAG', () => {
  test('returns 0 for empty cache', async () => {
    expect(await policyEngine.scoreRAG(5, {}, { matches: [] })).toBe(0);
  });

  test('returns 0 when no cache provided', async () => {
    expect(await policyEngine.scoreRAG(5, {})).toBe(0);
  });

  test('returns 0 when no match for libraryId', async () => {
    const cache = { matches: [{ libraryId: 99, similarity: 0.9 }] };
    expect(await policyEngine.scoreRAG(5, {}, cache)).toBe(0);
  });

  test('returns similarity * 100 for matching libraryId', async () => {
    const cache = { matches: [{ libraryId: 5, similarity: 0.8 }] };
    expect(await policyEngine.scoreRAG(5, {}, cache)).toBe(80);
  });

  test('caps at FORMULA_CONFIDENCE_CAP (95)', async () => {
    const cache = { matches: [{ libraryId: 5, similarity: 1.0 }] };
    const score = await policyEngine.scoreRAG(5, {}, cache);
    expect(score).toBe(95);
  });
});

describe('PolicyEngine.checkAuthoritativeSignals', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null when item has no source_library_id', async () => {
    const result = await policyEngine.checkAuthoritativeSignals({ title: 'Test' });
    expect(result).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('returns null when no policy matches the source library', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    const result = await policyEngine.checkAuthoritativeSignals({ source_library_id: 'lib-abc' });
    expect(result).toBeNull();
  });

  test('returns authoritative match with 100 confidence when policy found', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{
        policy_id: 1,
        library_id: 7,
        policy_name: 'Kids Movies',
        library_name: 'Kids'
      }]
    });

    const result = await policyEngine.checkAuthoritativeSignals({
      source_library_id: 'lib-kids',
      source_library_name: 'Plex Kids'
    });

    expect(result).not.toBeNull();
    expect(result.confidence).toBe(100);
    expect(result.method).toBe('authoritative_source_library');
    expect(result.library_id).toBe(7);
    expect(result.library_name).toBe('Kids');
  });

  test('returns null on db error', async () => {
    mockDb.query.mockRejectedValueOnce(new Error('DB error'));
    const result = await policyEngine.checkAuthoritativeSignals({ source_library_id: 'lib-x' });
    expect(result).toBeNull();
  });
});
