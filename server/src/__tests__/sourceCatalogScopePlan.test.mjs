/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { reviewSourceCatalogScopePlan } from '../services/sourceCatalogScopePlan.mjs';

const source = () => ({ mediaServerId: 1, externalId: 'private-source-id', mediaType: 'tv', identityDigest: 'a'.repeat(64) });
const plan = () => ({ version: 'source_catalog_scope_plan.v1', intent: 'preserve_source_grouping', source: source(),
  scope: { kind: 'seasons', coverage: 'complete', sourceSeasonNumbers: [0, 1, 2], mappings: [
    { sourceSeason: 0, tmdbSeriesId: 10, tmdbSeason: 0 },
    { sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 1 },
    { sourceSeason: 2, tmdbSeriesId: 20, tmdbSeason: 1 },
  ] } });

test('preserves one source grouping with explicit typed season edges; never grants authority', () => {
  const input = plan();
  const before = structuredClone(input);
  const report = reviewSourceCatalogScopePlan(input);
  expect(report).toMatchObject({ version: 'source_catalog_scope_plan_review.v1', status: { id: 'valid_draft' },
    canApply: false, verification: 'structure_only', summary: { mediaType: 'tv', scope: 'seasons',
      declaredSourceSeasons: 3, mappedSourceSeasons: 3, unmappedSourceSeasons: 0, targetWorks: 2, coverage: 'complete' } });
  expect(report.planFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  expect(report.requirements).toEqual(['fresh_source_and_membership', 'typed_catalog_scope_evidence',
    'authenticated_operator_review', 'scope_aware_consumers']);
  expect(input).toEqual(before);
  expect(JSON.stringify(report)).not.toMatch(/private-source-id|tmdbSeriesId|identityDigest|mediaServerId/u);
});

test.each(['movie', 'tv'])('accepts a whole-work %s draft, not a live identity', mediaType => {
  const input = { ...plan(), source: { ...source(), mediaType }, scope: { kind: 'whole_work', tmdbId: 30 } };
  expect(reviewSourceCatalogScopePlan(input)).toMatchObject({ canApply: false, status: { id: 'valid_draft' },
    summary: { mediaType, scope: 'whole_work', targetWorks: 1, coverage: 'whole_work', declaredSourceSeasons: null } });
});

test('partial scope cannot silently claim an unmapped season', () => {
  const input = plan(); input.scope.coverage = 'partial'; input.scope.mappings.pop();
  expect(reviewSourceCatalogScopePlan(input)).toMatchObject({ status: { id: 'valid_draft' },
    summary: { coverage: 'partial', mappedSourceSeasons: 2, unmappedSourceSeasons: 1 } });
});

test('fingerprint is canonical but changes with source, evidence, target or scope', () => {
  const input = plan(); const fingerprint = reviewSourceCatalogScopePlan(input).planFingerprint;
  input.scope.sourceSeasonNumbers.reverse(); input.scope.mappings.reverse();
  input.source = Object.fromEntries(Object.entries(input.source).reverse());
  expect(reviewSourceCatalogScopePlan(input).planFingerprint).toBe(fingerprint);
  for (const change of [p => { p.source.mediaServerId = 2; }, p => { p.source.externalId = 'another-item'; },
    p => { p.source.identityDigest = 'b'.repeat(64); }, p => { p.scope.mappings[0].tmdbSeason = 5; },
    p => { p.scope.mappings[0].tmdbSeriesId = 99; }, p => { p.scope.coverage = 'partial'; p.scope.mappings.pop(); }]) {
    const changed = plan(); change(changed);
    const report = reviewSourceCatalogScopePlan(changed);
    expect(report.status.id).toBe('valid_draft');
    expect(report.planFingerprint).not.toBe(fingerprint);
  }
});

test.each([
  ['unknown version', p => { p.version = 'next'; }],
  ['wrong intent', p => { p.intent = 'choose_first'; }],
  ['library-specific authority', p => { p.source.libraryId = 9; }],
  ['credential', p => { p.token = 'private-secret'; }],
  ['actor claim', p => { p.approvedBy = 'admin'; }],
  ['scope URL', p => { p.scope.url = 'http://private-source'; }],
  ['empty mappings', p => { p.scope.mappings = []; }],
  ['duplicate source', p => { p.scope.mappings[1].sourceSeason = 0; }],
  ['duplicate target', p => { p.scope.mappings[2] = { sourceSeason: 2, tmdbSeriesId: 10, tmdbSeason: 1 }; }],
  ['unknown source season', p => { p.scope.mappings[2].sourceSeason = 5; }],
  ['incomplete complete claim', p => { p.scope.mappings.pop(); }],
  ['complete partial claim', p => { p.scope.coverage = 'partial'; }],
  ['duplicate layout season', p => { p.scope.sourceSeasonNumbers = [0, 1, 1]; }],
  ['empty layout', p => { p.scope.sourceSeasonNumbers = []; }],
  ['null source', p => { p.source = null; }],
  ['movie season', p => { p.source.mediaType = 'movie'; }],
  ['mixed scope', p => { p.scope.tmdbId = 10; }],
  ['episode mapping', p => { p.scope.mappings[0].episodeStart = 1; }],
  ['numeric string', p => { p.scope.mappings[0].tmdbSeriesId = '10'; }],
  ['negative season', p => { p.scope.mappings[0].tmdbSeason = -1; }],
  ['oversized season', p => { p.scope.mappings[0].tmdbSeason = 10001; }],
  ['zero target', p => { p.scope.mappings[0].tmdbSeriesId = 0; }],
  ['large target', p => { p.scope.mappings[0].tmdbSeriesId = 2147483648; }],
  ['fractional target', p => { p.scope.mappings[0].tmdbSeriesId = 1.1; }],
  ['non-finite target', p => { p.scope.mappings[0].tmdbSeriesId = NaN; }],
  ['empty ID', p => { p.source.externalId = ' '; }],
  ['control character', p => { p.source.externalId = 'private\nsecret'; }],
  ['oversized ID', p => { p.source.externalId = 'x'.repeat(501); }],
  ['invalid digest', p => { p.source.identityDigest = 'not-verified'; }],
  ['invalid server', p => { p.source.mediaServerId = -1; }],
  ['unknown media type', p => { p.source.mediaType = 'episode'; }],
  ['unknown kind', p => { p.scope.kind = 'episodes'; }],
  ['too many seasons', p => { p.scope.sourceSeasonNumbers = Array.from({ length: 257 }, (_, i) => i); }],
  ['too many mappings', p => { p.scope.mappings = Array(257).fill(p.scope.mappings[0]); }],
  ['sparse season layout', p => { p.scope.sourceSeasonNumbers = Array(3); }],
  ['sparse edges', p => { p.scope.mappings = Array(3); }],
])('rejects %s without echoing submitted values', (_name, change) => {
  const input = plan(); change(input);
  expect(reviewSourceCatalogScopePlan(input)).toEqual({ version: 'source_catalog_scope_plan_review.v1',
    status: { id: 'invalid_draft', reason: 'invalid_scope_plan' }, canApply: false, verification: 'structure_only',
    planFingerprint: null, summary: null, requirements: ['fresh_source_and_membership', 'typed_catalog_scope_evidence',
      'authenticated_operator_review', 'scope_aware_consumers'] });
});

test.each([null, [], 1, 'private-secret', {}, { __proto__: { version: 'source_catalog_scope_plan.v1' } }].map(input => [input]))('rejects malformed document', input => {
  expect(reviewSourceCatalogScopePlan(input).status.id).toBe('invalid_draft');
});

test.each(['12345', '638e96b0-791d-4593-847c-b6ccabc7b719', 'opaque:item/key'])('does not assume Plex-specific source IDs: %s', externalId => {
  const input = plan(); input.source.externalId = externalId;
  expect(reviewSourceCatalogScopePlan(input).status.id).toBe('valid_draft');
});

test('accepts the exact season bound without widening work coverage', () => {
  const input = plan();
  input.scope.sourceSeasonNumbers = Array.from({ length: 256 }, (_, i) => i);
  input.scope.mappings = input.scope.sourceSeasonNumbers.map(i => ({ sourceSeason: i, tmdbSeriesId: 1, tmdbSeason: i }));
  expect(reviewSourceCatalogScopePlan(input).summary).toMatchObject({ mappedSourceSeasons: 256, targetWorks: 1 });
});

test('bounds unique target works, allowing the exact limit', () => {
  const input = plan();
  input.scope.sourceSeasonNumbers = Array.from({ length: 64 }, (_, i) => i);
  input.scope.mappings = input.scope.sourceSeasonNumbers.map(i => ({ sourceSeason: i, tmdbSeriesId: i + 1, tmdbSeason: 0 }));
  expect(reviewSourceCatalogScopePlan(input).summary.targetWorks).toBe(64);
  input.scope.sourceSeasonNumbers.push(64);
  input.scope.mappings.push({ sourceSeason: 64, tmdbSeriesId: 65, tmdbSeason: 0 });
  expect(reviewSourceCatalogScopePlan(input).status.id).toBe('invalid_draft');
});
