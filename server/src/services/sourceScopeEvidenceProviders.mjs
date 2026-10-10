/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { httpGet } from '../utils/httpClient.mjs';
import { ServiceUnavailableError, ConflictError } from '../utils/appError.mjs';
import { getTmdbIdentityDetails, findTmdbIdentityByExternalId } from './tmdbIdentitySearch.mjs';
import { getTmdbIdentitySeasonDetails } from './tmdbEpisodeCatalog.mjs';

/** Freeze credentials for one read; never accept a browser-provided destination. */
export function createScopeCatalogProviderFactory(tmdb) {
  return async config => {
    if (config && config.active !== true) throw new ServiceUnavailableError('Catalog provider is unavailable');
    const key = await tmdb.getApiKey();
    const baseUrl = tmdb.baseUrl;
    if (!key || (config && config.key !== key)) throw new ServiceUnavailableError('Catalog provider is unavailable');
    const deps = { baseUrl, getApiKey: async () => key,
      httpGet: (url, options) => httpGet(url, { ...options, redirect: 'error' }),
      executeRateLimited: (fn, options) => tmdb.executeRateLimited(fn, options) };
    return {
      getIdentityDetails: (id, type, options) => getTmdbIdentityDetails(id, type, deps, options),
      findIdentityByExternalId: (id, source, options) => findTmdbIdentityByExternalId(id, source, deps, options),
      getIdentitySeasonDetails: (id, season, options) => getTmdbIdentitySeasonDetails(id, season, deps, options),
      async recheck() {
        if (baseUrl !== tmdb.baseUrl || key !== await tmdb.getApiKey()) {
          throw new ConflictError('Catalog configuration changed', { code: 'scope_evidence_changed' });
        }
      },
    };
  };
}
