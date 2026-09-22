/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeOrganizationName } from '../utils/metadataOrganizations.mjs';
const clean = value => typeof value === 'string' && value.length <= 160
  ? value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().toLowerCase() : '';

/** Stored inventory observations: no policy labels, placement or provider instructions. */
export function projectInventoryCandidateMetadata(row) {
  return { genres: [...new Set((Array.isArray(row.genres) ? row.genres.slice(0, 32) : []).map(clean).filter(Boolean))].sort(),
    studio: normalizeOrganizationName(row.studio)?.toLowerCase() ?? '', rating: clean(row.content_rating) };
}

function queryContentRating(metadata) {
  const aliases = [metadata.certification, metadata.content_rating].filter(value => value != null);
  // Do not choose between contradictory claims or conceal a malformed supplied alias.
  if (aliases.some(value => typeof value !== 'string' || value.length > 160)) return '';
  const ratings = [...new Set(aliases.map(clean).filter(Boolean))];
  return ratings.length === 1 ? ratings[0] : '';
}

/** Adapt classification field names, then use the same bounded training projection. */
export function projectClassificationCandidateMetadata(metadata) {
  const genres = Array.isArray(metadata.genres) ? metadata.genres.slice(0, 32)
    .map(genre => typeof genre === 'string' ? genre : genre?.name) : [];
  return projectInventoryCandidateMetadata({ genres, studio: metadata.studio,
    content_rating: queryContentRating(metadata) });
}
