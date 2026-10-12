/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Fixed projections shared by the probe and its captured re-read callback.
// Include display identity and all helper transport inputs, not usage counters.
const queries = new Map([
    ['radarr', `SELECT id, name, url, protocol, host, port, base_path, api_key, verify_ssl, timeout
        FROM radarr_config WHERE is_active = true`],
    ['sonarr', `SELECT id, name, url, protocol, host, port, base_path, api_key, verify_ssl, timeout
        FROM sonarr_config WHERE is_active = true`],
    ['tmdb', 'SELECT id, api_key FROM tmdb_config WHERE is_active = true ORDER BY id DESC LIMIT 1'],
    // Preserve credential-lifecycle changes even when the key itself is unchanged.
    ['omdb', `SELECT id, api_key, credential_generation, credential_rejected_at
        FROM omdb_config WHERE is_active = true ORDER BY id DESC LIMIT 1`],
    ['tavily', `SELECT id, api_key, credential_generation, credential_rejected_at
        FROM tavily_config WHERE is_active = true ORDER BY id DESC LIMIT 1`],
    ['imageEmbeddings', `SELECT rag_image_weight, image_embedding_provider_mode,
        image_embedding_local_host, image_embedding_local_port,
        image_embedding_cloud_provider, image_embedding_cloud_api_key
        FROM ai_provider_config WHERE id = 1`],
]);

/** Only reviewed checks may use narrowed configuration reads. */
export function healthConfigurationQuery(service) {
    const query = queries.get(service);
    if (!query) throw new RangeError('Unsupported health configuration query');
    return query;
}
