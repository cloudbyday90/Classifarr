/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ScopeEvidenceError } from './sourceScopeCatalogEvidence.mjs';
import { CatalogEpisodeEvidenceError } from './catalogEpisodeEvidence.mjs';

const codes = new Set(['source_changed', 'configuration_changed', 'source_seasons_changed',
  'catalog_changed', 'catalog_season_missing', 'catalog_invalid', 'scope_limit',
  'invalid_scope', 'empty_source', 'unmapped_season', 'ambiguous_episode_ids',
  'reused_episode_id', 'missing_tmdb_episode_id', 'episode_absent_from_scope',
  'episode_outside_mapping', 'episode_numbering_differs', 'parent_identity_unresolved',
  'source_unavailable', 'catalog_unavailable', 'timed_out', 'unknown']);

export class SourceMappingCheckError extends Error {
  constructor(code) { super('Source mapping verification deferred'); this.code = codes.has(code) ? code : 'unknown'; }
}

/** Error messages and provider-controlled codes never become stored diagnostics. */
export function sourceMappingFailureCode(error, stage, signal) {
  if (signal?.aborted) return 'timed_out';
  if (error instanceof SourceMappingCheckError) return error.code;
  if (error instanceof ScopeEvidenceError) {
    if (error.code === 'catalog_scope_limit') return 'scope_limit';
    return codes.has(error.code) ? error.code : 'unknown';
  }
  if (error instanceof CatalogEpisodeEvidenceError) return 'catalog_invalid';
  return stage === 'source' ? 'source_unavailable' : stage === 'catalog' ? 'catalog_unavailable' : 'unknown';
}

export function sourceMappingDiagnostic(outcome) {
  if (outcome === 'checking') return { code: 'check_unconfirmed' };
  if (outcome === 'verification_deferred') return { code: 'unknown' };
  if (typeof outcome !== 'string' || !outcome.startsWith('deferred:')) return null;
  const code = outcome.slice(9);
  return { code: codes.has(code) ? code : 'unknown' };
}
