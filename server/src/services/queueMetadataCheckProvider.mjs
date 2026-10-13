/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { readMetadataProviderConfig } from './metadataProviderConfigStore.mjs';

/** Credentials stay inside one short-lived provider snapshot, never in the report. */
export function createQueueMetadataCheckProvider({ db, httpGet, executeRateLimited, env = process.env }) {
  return async (database = db) => {
    const config = await readMetadataProviderConfig(database, 'tmdb');
    const key = config ? (config.is_active === true ? config.api_key : null) : env.TMDB_API_KEY;
    const revision = createHash('sha256').update(JSON.stringify([
      config?.id, config?.is_active, config?.updated_at, key || null,
    ])).digest('hex');
    return {
      revision,
      configured: typeof key === 'string' && key.trim().length > 0,
      async getDetails(tmdbId, mediaType, signal) {
        const response = await executeRateLimited(() => {
          signal.throwIfAborted();
          return httpGet(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}`, {
            params: { api_key: key }, signal, timeout: 10000,
            maxResponseBytes: 1048576, redirect: 'error',
          });
        }, { signal });
        return response.data;
      },
    };
  };
}
