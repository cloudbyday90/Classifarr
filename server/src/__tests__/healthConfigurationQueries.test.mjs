/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { healthConfigurationQuery } from '../services/healthConfigurationQueries.mjs';

test.each(['radarr', 'sonarr', 'tmdb', 'omdb', 'tavily', 'imageEmbeddings', 'ollama', 'mediaServer'])('%s has a fixed read-only projection without incidental fields', service => {
    const sql = healthConfigurationQuery(service);
    expect(sql).toMatch(/^SELECT /);
    expect(sql).not.toMatch(/\*|requests_today|last_reset_date|updated_at|created_at|daily_limit|models_cache|;/);
});

test.each(['unknown', '__proto__', 'omdb; DROP TABLE omdb_config', null, {}])('unreviewed or arbitrary query keys are rejected: %s', service => {
    expect(() => healthConfigurationQuery(service)).toThrow('Unsupported health configuration query');
});
