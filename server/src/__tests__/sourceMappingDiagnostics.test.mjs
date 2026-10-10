/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SourceMappingCheckError, sourceMappingFailureCode, sourceMappingDiagnostic } from '../services/sourceMappingDiagnostics.mjs';
import { ScopeEvidenceError } from '../services/sourceScopeCatalogEvidence.mjs';
import { CatalogEpisodeEvidenceError } from '../services/catalogEpisodeEvidence.mjs';

test.each(['source_changed', 'configuration_changed', 'missing_tmdb_episode_id', 'catalog_changed'])('retains fixed internal reason %s', code => {
  const failure = sourceMappingFailureCode(new SourceMappingCheckError(code), 'validation');
  expect(sourceMappingDiagnostic(`deferred:${failure}`)).toEqual({ code });
});
test.each([
  [new ScopeEvidenceError('catalog_season_missing'), 'catalog_season_missing'],
  [new ScopeEvidenceError('catalog_scope_limit'), 'scope_limit'],
  [new ScopeEvidenceError('private-token'), 'unknown'],
  [new CatalogEpisodeEvidenceError(), 'catalog_invalid'],
  [new SourceMappingCheckError('private-token'), 'unknown'],
])('maps bounded validation errors', (error, code) => {
  expect(sourceMappingFailureCode(error, 'validation')).toBe(code);
});
test.each([['source', 'source_unavailable'], ['catalog', 'catalog_unavailable'], ['validation', 'unknown']])('does not trust external error codes at %s', (stage, code) => {
  expect(sourceMappingFailureCode(Object.assign(new Error('private token'), { code: 'source_changed' }), stage)).toBe(code);
});
test('timeout overrides incidental provider errors and unknown historical data is never exposed', () => {
  expect(sourceMappingFailureCode(new Error('secret'), 'source', AbortSignal.abort())).toBe('timed_out');
  expect(sourceMappingDiagnostic('checking')).toEqual({ code: 'check_unconfirmed' });
  expect(sourceMappingDiagnostic('verification_deferred')).toEqual({ code: 'unknown' });
  expect(sourceMappingDiagnostic('deferred:private-token')).toEqual({ code: 'unknown' });
  expect(sourceMappingDiagnostic('materialized')).toBeNull();
  expect(sourceMappingDiagnostic(null)).toBeNull();
});
