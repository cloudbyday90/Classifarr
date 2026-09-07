/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Complete fixed statements: no caller-controlled SQL identifiers or expressions.
const definitions = new Map([
    ['tmdb', {
        active: 'SELECT * FROM tmdb_config WHERE is_active = true ORDER BY id DESC LIMIT 1',
        settings: 'SELECT * FROM tmdb_config ORDER BY (is_active IS TRUE) DESC, id DESC LIMIT 1',
        lock: 'LOCK TABLE tmdb_config IN SHARE ROW EXCLUSIVE MODE',
        upsert: `INSERT INTO tmdb_config (id, api_key, language, is_active, updated_at)
            VALUES (COALESCE((SELECT id FROM tmdb_config ORDER BY (is_active IS TRUE) DESC, id DESC LIMIT 1),
                nextval(pg_get_serial_sequence('tmdb_config', 'id'))), $1, $2, $3, NOW())
            ON CONFLICT (id) DO UPDATE SET api_key = EXCLUDED.api_key, language = EXCLUDED.language,
                is_active = EXCLUDED.is_active, updated_at = NOW() RETURNING *`,
        retire: 'UPDATE tmdb_config SET is_active = false WHERE id <> $1 AND is_active = true',
        values: value => [value.apiKey, value.language, value.isActive ?? true],
    }],
    ['omdb', {
        active: 'SELECT * FROM omdb_config WHERE is_active = true ORDER BY id DESC LIMIT 1',
        settings: 'SELECT * FROM omdb_config ORDER BY (is_active IS TRUE) DESC, id DESC LIMIT 1',
        lock: 'LOCK TABLE omdb_config IN SHARE ROW EXCLUSIVE MODE',
        upsert: `INSERT INTO omdb_config (id, api_key, is_active, daily_limit, requests_today, last_reset_date, updated_at)
            VALUES (COALESCE((SELECT id FROM omdb_config ORDER BY (is_active IS TRUE) DESC, id DESC LIMIT 1),
                nextval(pg_get_serial_sequence('omdb_config', 'id'))), $1, $2, $3, $4, $5, NOW())
            ON CONFLICT (id) DO UPDATE SET api_key = EXCLUDED.api_key, is_active = EXCLUDED.is_active,
                daily_limit = EXCLUDED.daily_limit, requests_today = EXCLUDED.requests_today,
                last_reset_date = EXCLUDED.last_reset_date, updated_at = NOW() RETURNING *`,
        retire: 'UPDATE omdb_config SET is_active = false WHERE id <> $1 AND is_active = true',
        values: value => [value.apiKey, value.isActive, value.dailyLimit, value.requestsToday, value.lastResetDate],
    }],
    ['tavily', {
        active: 'SELECT * FROM tavily_config WHERE is_active = true ORDER BY id DESC LIMIT 1',
        settings: 'SELECT * FROM tavily_config ORDER BY (is_active IS TRUE) DESC, id DESC LIMIT 1',
        lock: 'LOCK TABLE tavily_config IN SHARE ROW EXCLUSIVE MODE',
        upsert: `INSERT INTO tavily_config (id, api_key, search_depth, max_results, include_domains, exclude_domains, is_active, updated_at)
            VALUES (COALESCE((SELECT id FROM tavily_config ORDER BY (is_active IS TRUE) DESC, id DESC LIMIT 1),
                nextval(pg_get_serial_sequence('tavily_config', 'id'))), $1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (id) DO UPDATE SET api_key = EXCLUDED.api_key, search_depth = EXCLUDED.search_depth,
                max_results = EXCLUDED.max_results, include_domains = EXCLUDED.include_domains,
                exclude_domains = EXCLUDED.exclude_domains, is_active = EXCLUDED.is_active, updated_at = NOW() RETURNING *`,
        retire: 'UPDATE tavily_config SET is_active = false WHERE id <> $1 AND is_active = true',
        values: value => [value.apiKey, value.searchDepth, value.maxResults, value.includeDomains, value.excludeDomains, value.isActive],
    }],
]);

export function metadataProviderDefinition(provider) {
    const definition = definitions.get(provider);
    if (!definition) throw new Error('Unsupported metadata provider');
    return definition;
}
