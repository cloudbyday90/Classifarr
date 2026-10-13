/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { readMetadataProviderConfig } from './metadataProviderConfigStore.mjs';
import { reviewInteger } from './mediaIdentityReviewContract.mjs';
import { buildTmdbExternalIdRequest } from './tmdbExternalIdMatch.mjs';
import { ValidationError } from '../utils/appError.mjs';

function typedPath(tmdbId, mediaType) {
  if (!['movie', 'tv'].includes(mediaType)) throw new ValidationError('Invalid media type');
  return `${mediaType}/${reviewInteger(tmdbId)}`;
}

/** Credentials stay inside one short-lived provider snapshot, never in the report. */
export function createQueueMetadataCheckProvider({ db, httpGet, executeRateLimited, env = process.env }) {
  return async (database = db) => {
    const config = await readMetadataProviderConfig(database, 'tmdb');
    const key = config ? (config.is_active === true ? config.api_key : null) : env.TMDB_API_KEY;
    const revision = createHash('sha256').update(JSON.stringify([
      config?.id, config?.is_active, config?.updated_at, key || null,
    ])).digest('hex');
    const read = async (path, signal, params = {}) => {
      const response = await executeRateLimited(() => {
        signal.throwIfAborted();
        return httpGet(`https://api.themoviedb.org/3/${path}`, {
          params: { ...params, api_key: key }, signal, timeout: 10000,
          maxResponseBytes: 1048576, redirect: 'error',
        });
      }, { signal });
      return response.data;
    };
    return {
      revision,
      configured: typeof key === 'string' && key.trim().length > 0,
      async getDetails(tmdbId, mediaType, signal) {
        return read(typedPath(tmdbId, mediaType), signal);
      },
      async findByExternalId(externalId, source, signal) {
        const request = buildTmdbExternalIdRequest(externalId, source);
        if (!request) throw new ValidationError('Invalid external identity');
        return read(`find/${request.externalId}`, signal, { external_source: request.source });
      },
      async getExternalIds(tmdbId, mediaType, signal) {
        return read(`${typedPath(tmdbId, mediaType)}/external_ids`, signal);
      },
    };
  };
}
