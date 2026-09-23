/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeProductionCompanies } from '../utils/metadataOrganizations.mjs';
import { isCurrentInventoryTmdbTimestamp } from './inventoryTmdbObservation.mjs';

/** Provider IDs survive name/localization changes; name-only observations remain distinct. */
export function projectCompanyTerms(value) {
  const companies = normalizeProductionCompanies(value);
  return companies === null ? null : [...new Set(companies.map(company =>
    company.id != null ? `tmdb:${company.id}` : `name:${company.name.toLowerCase()}`))].sort();
}

/** Only fresh, identity-bound provider observations can train the company channel. */
export function projectInventoryCompanyMetadata(row) {
  const record = row.company_observation;
  const checked = new Date(row.company_checked_at ?? NaN).getTime();
  if (!['movie', 'tv'].includes(row.media_type) || !Number.isSafeInteger(row.tmdb_id) || row.tmdb_id <= 0 ||
      record?.version !== 1 || record.tmdb_id !== row.tmdb_id || record.media_type !== row.media_type ||
      !isCurrentInventoryTmdbTimestamp(record.fetched_at, checked)) return null;
  const companies = projectCompanyTerms(record.production_companies);
  return companies === null ? null : { productionCompanies: companies };
}

/** Disagreement between copies excludes company evidence, not unrelated metadata. */
export function collectInventoryCompanyMetadata(rows) {
  const result = new Map();
  for (const row of rows) {
    const key = `${row.media_type}:${row.tmdb_id}`, value = projectInventoryCompanyMetadata(row);
    if (!result.has(key)) result.set(key, value);
    else if (JSON.stringify(result.get(key)) !== JSON.stringify(value)) result.set(key, null);
  }
  return result;
}
