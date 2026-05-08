
import { PolicyExclusionService } from '../../services/policyExclusionService.mjs';

describe('PolicyExclusionService', () => {
  let svc;

  beforeEach(() => {
    svc = new PolicyExclusionService();
  });

  describe('hasStrictSignalConstraint', () => {
    it('returns false for null config', () => {
      expect(svc.hasStrictSignalConstraint(null)).toBe(false);
    });

    it('returns false for undefined config', () => {
      expect(svc.hasStrictSignalConstraint(undefined)).toBe(false);
    });

    it('returns false when strict is false', () => {
      expect(svc.hasStrictSignalConstraint({ strict: false, require_any: ['en'] })).toBe(false);
    });

    it('returns false when strict is true but no require_any or exclude', () => {
      expect(svc.hasStrictSignalConstraint({ strict: true })).toBe(false);
    });

    it('returns false when strict is true but require_any is empty', () => {
      expect(svc.hasStrictSignalConstraint({ strict: true, require_any: [] })).toBe(false);
    });

    it('returns false when strict is true but exclude is empty', () => {
      expect(svc.hasStrictSignalConstraint({ strict: true, exclude: [] })).toBe(false);
    });

    it('returns true when strict is true AND has require_any entries', () => {
      expect(svc.hasStrictSignalConstraint({ strict: true, require_any: ['en'] })).toBe(true);
    });

    it('returns true when strict is true AND has exclude entries', () => {
      expect(svc.hasStrictSignalConstraint({ strict: true, exclude: ['zh'] })).toBe(true);
    });

    it('returns true when strict is true AND has both require_any and exclude', () => {
      expect(svc.hasStrictSignalConstraint({ strict: true, require_any: ['en'], exclude: ['zh'] })).toBe(true);
    });
  });

  describe('getStrictLanguageConflict', () => {
    it('returns null when itemLanguage is falsy', () => {
      const config = { strict: true, require_any: ['en'] };
      expect(svc.getStrictLanguageConflict(config, '')).toBeNull();
      expect(svc.getStrictLanguageConflict(config, null)).toBeNull();
      expect(svc.getStrictLanguageConflict(config, undefined)).toBeNull();
    });

    it('returns null when config is not strict', () => {
      expect(svc.getStrictLanguageConflict({ strict: false, require_any: ['en'] }, 'ja')).toBeNull();
    });

    it('returns null when config has no constraints', () => {
      expect(svc.getStrictLanguageConflict({ strict: true }, 'en')).toBeNull();
    });

    it('returns require_any_mismatch when item lang is not in require_any', () => {
      const config = { strict: true, require_any: ['en', 'fr'] };
      const result = svc.getStrictLanguageConflict(config, 'ja');
      expect(result).not.toBeNull();
      expect(result.type).toBe('require_any_mismatch');
      expect(result.requiredLanguages).toEqual(['en', 'fr']);
      expect(result.excludedLanguages).toEqual([]);
    });

    it('returns null when item lang is in require_any', () => {
      const config = { strict: true, require_any: ['en', 'fr'] };
      expect(svc.getStrictLanguageConflict(config, 'fr')).toBeNull();
    });

    it('normalises case on require_any check', () => {
      const config = { strict: true, require_any: ['EN'] };
      expect(svc.getStrictLanguageConflict(config, 'en')).toBeNull();
      expect(svc.getStrictLanguageConflict(config, 'ja')).not.toBeNull();
    });

    it('returns excluded_language when item lang is in exclude', () => {
      const config = { strict: true, exclude: ['zh', 'ko'] };
      const result = svc.getStrictLanguageConflict(config, 'zh');
      expect(result).not.toBeNull();
      expect(result.type).toBe('excluded_language');
      expect(result.excludedLanguages).toEqual(['zh', 'ko']);
      expect(result.requiredLanguages).toEqual([]);
    });

    it('returns null when item lang is not in exclude', () => {
      const config = { strict: true, exclude: ['zh'] };
      expect(svc.getStrictLanguageConflict(config, 'en')).toBeNull();
    });

    it('require_any takes precedence over exclude when both present', () => {
      const config = { strict: true, require_any: ['en'], exclude: ['zh'] };
      const result = svc.getStrictLanguageConflict(config, 'ja');
      expect(result.type).toBe('require_any_mismatch');
    });
  });

  describe('applyMediaTypeFilter', () => {
    const policies = [
      { id: 1, library_media_type: 'movie' },
      { id: 2, library_media_type: 'show' },
      { id: 3, library_media_type: 'Movie' },
      { id: 4, library_media_type: null },
    ];

    it('returns all policies with skipped=0 when itemMediaType is falsy', () => {
      const result = svc.applyMediaTypeFilter(policies, null);
      expect(result.candidatePolicies).toHaveLength(policies.length);
      expect(result.skipped).toBe(0);
    });

    it('returns all policies with skipped=0 when itemMediaType is empty string', () => {
      const result = svc.applyMediaTypeFilter(policies, '');
      expect(result.candidatePolicies).toHaveLength(policies.length);
      expect(result.skipped).toBe(0);
    });

    it('filters to matching media_type only (case-insensitive on library side)', () => {
      const result = svc.applyMediaTypeFilter(policies, 'movie');
      expect(result.candidatePolicies.map(p => p.id)).toEqual([1, 3]);
      expect(result.skipped).toBe(2);
    });

    it('returns empty candidatePolicies when no policy matches', () => {
      const result = svc.applyMediaTypeFilter(policies, 'music');
      expect(result.candidatePolicies).toHaveLength(0);
      expect(result.skipped).toBe(policies.length);
    });

    it('returns empty array with skipped=0 for empty policies list', () => {
      const result = svc.applyMediaTypeFilter([], 'movie');
      expect(result.candidatePolicies).toHaveLength(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe('detectLanguageConflicts', () => {
    it('returns empty results when itemLanguage is falsy', () => {
      const policies = [{ id: 1, name: 'P', library_id: 1, library_name: 'L',
        presets: [{ signals: { language: { strict: true, require_any: ['en'] } } }] }];
      const result = svc.detectLanguageConflicts(policies, [], '');
      expect(result.languageConflicts).toHaveLength(0);
      expect(result.languageConflictPolicyIds.size).toBe(0);
    });

    it('detects conflict when item language does not match require_any', () => {
      const policy = { id: 10, name: 'English Only', library_id: 5, library_name: 'English',
        presets: [{ signals: { language: { strict: true, require_any: ['en'] } } }] };
      const evaluations = [{ policy_id: 10, score: 80 }];
      const { languageConflicts, languageConflictPolicyIds } = svc.detectLanguageConflicts(
        [policy], evaluations, 'ja'
      );
      expect(languageConflicts).toHaveLength(1);
      expect(languageConflicts[0].policy_id).toBe(10);
      expect(languageConflicts[0].score).toBe(80);
      expect(languageConflicts[0].item_language).toBe('ja');
      expect(languageConflictPolicyIds.has(10)).toBe(true);
    });

    it('does not detect conflict for advisory (non-strict) language config', () => {
      const policy = { id: 11, name: 'P', library_id: 1, library_name: 'L',
        presets: [{ signals: { language: { strict: false, require_any: ['en'] } } }] };
      const { languageConflicts, languageConflictPolicyIds } = svc.detectLanguageConflicts(
        [policy], [], 'ja'
      );
      expect(languageConflicts).toHaveLength(0);
      expect(languageConflictPolicyIds.size).toBe(0);
    });

    it('does not detect conflict when item language matches require_any', () => {
      const policy = { id: 12, name: 'P', library_id: 1, library_name: 'L',
        presets: [{ signals: { language: { strict: true, require_any: ['en'] } } }] };
      const { languageConflicts } = svc.detectLanguageConflicts([policy], [], 'en');
      expect(languageConflicts).toHaveLength(0);
    });

    it('adds only one conflict entry per policy even with multiple presets that conflict', () => {
      const policy = {
        id: 13, name: 'P', library_id: 1, library_name: 'L',
        presets: [
          { signals: { language: { strict: true, require_any: ['en'] } } },
          { signals: { language: { strict: true, require_any: ['fr'] } } },
        ]
      };
      const { languageConflicts, languageConflictPolicyIds } = svc.detectLanguageConflicts(
        [policy], [], 'ja'
      );
      expect(languageConflicts).toHaveLength(1);
      expect(languageConflictPolicyIds.size).toBe(1);
    });

    it('uses score=0 as fallback when evaluation for policy is missing', () => {
      const policy = { id: 14, name: 'P', library_id: 1, library_name: 'L',
        presets: [{ signals: { language: { strict: true, require_any: ['en'] } } }] };
      const { languageConflicts } = svc.detectLanguageConflicts([policy], [], 'ja');
      expect(languageConflicts[0].score).toBe(0);
    });

    it('populates required_languages and excluded_languages on conflict record', () => {
      const policy = { id: 15, name: 'P', library_id: 1, library_name: 'L',
        presets: [{ signals: { language: { strict: true, require_any: ['en'], exclude: ['zh'] } } }] };
      const { languageConflicts } = svc.detectLanguageConflicts([policy], [], 'ja');
      expect(languageConflicts[0].required_languages).toEqual(['en']);
      expect(languageConflicts[0].excluded_languages).toEqual(['zh']);
    });
  });

  describe('filterValidEvaluations', () => {
    it('filters out evaluations with score <= 0', () => {
      const evals = [
        { policy_id: 1, score: 0 },
        { policy_id: 2, score: -5 },
        { policy_id: 3, score: 50 },
      ];
      const result = svc.filterValidEvaluations(evals, new Set());
      expect(result).toHaveLength(1);
      expect(result[0].policy_id).toBe(3);
    });

    it('filters out evaluations whose policy_id is in the conflict set', () => {
      const evals = [
        { policy_id: 1, score: 80 },
        { policy_id: 2, score: 70 },
      ];
      const result = svc.filterValidEvaluations(evals, new Set([1]));
      expect(result).toHaveLength(1);
      expect(result[0].policy_id).toBe(2);
    });

    it('filters on id field when policy_id is absent', () => {
      const evals = [
        { id: 10, score: 60 },
        { id: 11, score: 55 },
      ];
      const result = svc.filterValidEvaluations(evals, new Set([10]));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(11);
    });

    it('returns all when no conflicts and all scores > 0', () => {
      const evals = [{ policy_id: 1, score: 40 }, { policy_id: 2, score: 60 }];
      const result = svc.filterValidEvaluations(evals, new Set());
      expect(result).toHaveLength(2);
    });

    it('returns empty array when all are either zero-score or conflicted', () => {
      const evals = [
        { policy_id: 1, score: 0 },
        { policy_id: 2, score: 50 },
      ];
      const result = svc.filterValidEvaluations(evals, new Set([2]));
      expect(result).toHaveLength(0);
    });

    it('defaults languageConflictIds to empty set when omitted', () => {
      const evals = [{ policy_id: 1, score: 30 }];
      const result = svc.filterValidEvaluations(evals);
      expect(result).toHaveLength(1);
    });
  });
});
