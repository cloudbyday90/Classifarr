import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
    restoreConfidenceSettings,
    restoreMediaServers,
    restoreRadarrConfigs,
    restoreSonarrConfigs,
    restoreLibraries,
    restoreLibraryPolicies,
    restoreLibraryCustomRules,
    restoreLabelPresets,
    restoreScheduledTasks,
    restoreAutoLearnedPreferences,
    restorePathMappings,
    restoreOllamaConfig,
    restoreTmdbConfig,
    restoreOmdbConfig,
    restoreAiConfig,
    restoreWebhookConfig,
    restoreSettings,
    restoreLibraryLabels,
} = await import('../../services/backupRestoreTables.mjs');

const STUB_DDLS = [
    `CREATE TABLE IF NOT EXISTS confidence_settings (
        id SERIAL PRIMARY KEY, setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT NOT NULL, description TEXT, default_value TEXT,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS library_policies (
        id SERIAL PRIMARY KEY, library_id INTEGER, name VARCHAR(255) NOT NULL,
        description TEXT, enabled BOOLEAN DEFAULT true, priority INTEGER DEFAULT 5,
        sort_order INTEGER DEFAULT 0, auto_classify_threshold INTEGER DEFAULT 85,
        prompt_threshold INTEGER DEFAULT 60, require_ai_validation BOOLEAN DEFAULT true,
        trust_patterns BOOLEAN DEFAULT true, trust_rag BOOLEAN DEFAULT true,
        trust_history BOOLEAN DEFAULT true, preset_weight REAL,
        pattern_weight REAL, rag_weight REAL, history_weight REAL,
        combination_mode VARCHAR(20) DEFAULT 'best_match',
        notify_channels JSONB DEFAULT '["app"]'::jsonb,
        exclusive BOOLEAN DEFAULT false,
        source_library_ids JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by INTEGER, profile_weight REAL DEFAULT 0.25 NOT NULL,
        UNIQUE (library_id)
    )`,
    `CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
        task_type VARCHAR(50) DEFAULT 'library_scan' NOT NULL,
        library_id INTEGER, interval_minutes INTEGER,
        enabled BOOLEAN DEFAULT true, run_count INTEGER DEFAULT 0,
        last_result JSONB, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS auto_learned_preferences (
        id SERIAL PRIMARY KEY, library_id INTEGER NOT NULL, policy_id INTEGER,
        preference_type VARCHAR(50) NOT NULL, preference_value TEXT NOT NULL,
        confidence_count INTEGER, source VARCHAR(50) DEFAULT 'user_feedback' NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        UNIQUE (library_id, preference_type, preference_value)
    )`,
    `CREATE TABLE IF NOT EXISTS classification_evidence (
        id SERIAL PRIMARY KEY, scope VARCHAR(50) NOT NULL, media_type VARCHAR(20),
        library_id INTEGER, tmdb_id INTEGER, evidence_key VARCHAR(255),
        evidence_data JSONB, provenance VARCHAR(50) NOT NULL, confidence NUMERIC(5,2),
        usage_count INTEGER DEFAULT 0 NOT NULL, success_rate NUMERIC(5,2),
        status VARCHAR(20) DEFAULT 'active' NOT NULL, created_by VARCHAR(100),
        source_classification_id BIGINT, source_system VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        last_seen_at TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS path_mappings (
        id SERIAL PRIMARY KEY, arr_path VARCHAR(1024) NOT NULL,
        local_path VARCHAR(1024) NOT NULL, is_active BOOLEAN DEFAULT true,
        verified BOOLEAN DEFAULT false, last_verified_at TIMESTAMPTZ,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS omdb_config (
        id SERIAL PRIMARY KEY, api_key VARCHAR(255), is_active BOOLEAN DEFAULT true,
        daily_limit INTEGER DEFAULT 1000, created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ai_config (
        id SERIAL PRIMARY KEY, provider VARCHAR(50), api_key VARCHAR(500),
        model VARCHAR(100), base_url VARCHAR(500)
    )`,
    `CREATE TABLE IF NOT EXISTS backup_audit (
        id SERIAL PRIMARY KEY, operation VARCHAR(50) NOT NULL,
        backup_type VARCHAR(20) NOT NULL, filename VARCHAR(255) NOT NULL,
        file_size BIGINT, status VARCHAR(20) NOT NULL, error_message TEXT,
        user_id INTEGER, ip_address INET, metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
    )`,
];

describe('Backup Restore Tables Integration Tests', () => {
    beforeAll(async () => {
        for (const ddl of STUB_DDLS) {
            await db.query(ddl);
        }
    }, 120_000);

    const CLEANUP_TABLES = [
        'library_custom_rules',
        'library_labels',
        'library_policies',
        'auto_learned_preferences',
        'classification_evidence',
        'scheduled_tasks',
        'path_mappings',
        'label_presets',
        'libraries',
        'radarr_config',
        'sonarr_config',
        'media_server',
        'confidence_settings',
        'ollama_config',
        'tmdb_config',
        'omdb_config',
        'ai_config',
        'webhook_config',
        'settings',
    ];

    afterEach(async () => {
        for (const table of CLEANUP_TABLES) {
            await db.query(`DELETE FROM ${table}`);
        }
    });

    async function _getClient() {
        const client = await db.connect();
        return client;
    }

    describe('restoreConfidenceSettings', () => {
        it('inserts confidence settings', async () => {
            const settings = [
                { setting_key: 'weight_exact_match', setting_value: '30', description: 'Exact match weight', default_value: '25' },
                { setting_key: 'confidence_threshold', setting_value: '75', description: null, default_value: '80' },
            ];

            await restoreConfidenceSettings(db, settings);

            const result = await db.query('SELECT * FROM confidence_settings WHERE setting_key = ANY($1) ORDER BY setting_key', [['weight_exact_match', 'confidence_threshold']]);
            expect(result.rows).toHaveLength(2);
            expect(result.rows[0].setting_key).toBe('confidence_threshold');
            expect(result.rows[0].setting_value).toBe('75');
            expect(result.rows[1].setting_key).toBe('weight_exact_match');
            expect(result.rows[1].setting_value).toBe('30');
        });

        it('upserts on conflict (updates existing)', async () => {
            await db.query(`INSERT INTO confidence_settings (setting_key, setting_value) VALUES ('weight_genre', '20')`);

            await restoreConfidenceSettings(db, [
                { setting_key: 'weight_genre', setting_value: '40', description: 'Updated', default_value: null },
            ]);

            const result = await db.query('SELECT * FROM confidence_settings WHERE setting_key = $1', ['weight_genre']);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].setting_value).toBe('40');
            expect(result.rows[0].description).toBe('Updated');
        });

        it('handles null/undefined settings gracefully', async () => {
            const before = await db.query('SELECT COUNT(*) FROM confidence_settings');
            await restoreConfidenceSettings(db, null);
            await restoreConfidenceSettings(db, undefined);

            const after = await db.query('SELECT COUNT(*) FROM confidence_settings');
            expect(Number(after.rows[0].count)).toBe(Number(before.rows[0].count));
        });
    });

    describe('restoreMediaServers', () => {
        it('inserts media servers', async () => {
            await restoreMediaServers(db, [
                { type: 'plex', name: 'RestoreTest Plex', url: 'http://restore-plex:32400', api_key: 'token123', is_active: true },
            ]);

            const result = await db.query("SELECT * FROM media_server WHERE name = 'RestoreTest Plex'");
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].type).toBe('plex');
            expect(result.rows[0].name).toBe('RestoreTest Plex');
        });

        it('inserts duplicates when no unique constraint', async () => {
            await restoreMediaServers(db, [
                { type: 'plex', name: 'DupTest', url: 'http://first:32400', api_key: 'first', is_active: true },
            ]);

            await restoreMediaServers(db, [
                { type: 'plex', name: 'DupTest', url: 'http://second:32400', api_key: 'second', is_active: false },
            ]);

            const result = await db.query("SELECT * FROM media_server WHERE name = 'DupTest' ORDER BY url");
            expect(result.rows).toHaveLength(2);
            expect(result.rows[0].url).toBe('http://first:32400');
            expect(result.rows[1].url).toBe('http://second:32400');
        });

        it('handles null servers', async () => {
            await restoreMediaServers(db, null);
        });
    });

    describe('restoreRadarrConfigs', () => {
        it('inserts radarr configs', async () => {
            await restoreRadarrConfigs(db, [
                { name: 'Radarr1', url: 'http://radarr:7878', api_key: 'rad-key', is_active: true },
            ]);

            const result = await db.query('SELECT * FROM radarr_config');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].name).toBe('Radarr1');
        });
    });

    describe('restoreSonarrConfigs', () => {
        it('inserts sonarr configs', async () => {
            await restoreSonarrConfigs(db, [
                { name: 'Sonarr1', url: 'http://sonarr:8989', api_key: 'son-key', is_active: true },
            ]);

            const result = await db.query('SELECT * FROM sonarr_config');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].name).toBe('Sonarr1');
        });
    });

    describe('restoreLibraries', () => {
        it('inserts libraries and returns ID map', async () => {
            const map = await restoreLibraries(db, [
                { id: 9001, name: 'RestoreTest Movies', media_type: 'movie', media_server_id: null, external_id: 'ext-rt-1', is_active: true },
                { id: 9002, name: 'RestoreTest TV', media_type: 'tv', media_server_id: null, external_id: 'ext-rt-2', is_active: true },
            ]);

            const result = await db.query("SELECT * FROM libraries WHERE name LIKE 'RestoreTest%' ORDER BY name");
            expect(result.rows).toHaveLength(2);
            expect(result.rows[0].name).toBe('RestoreTest Movies');
            expect(result.rows[1].name).toBe('RestoreTest TV');
            expect(map.size).toBe(2);
            expect(map.has(9001)).toBe(true);
            expect(map.has(9002)).toBe(true);
        });

        it('handles null libraries', async () => {
            const map = await restoreLibraries(db, null);
            expect(map.size).toBe(0);
        });
    });

    describe('restoreLibraryPolicies', () => {
        it('inserts policies with correct columns', async () => {
            const libResult = await db.query(`INSERT INTO libraries (name, external_id, media_type) VALUES ('PolicyLib', 'pl-1', 'movie') RETURNING id`);
            const libraryId = libResult.rows[0].id;

            await restoreLibraryPolicies(db, [
                {
                    library_id: libraryId,
                    name: 'Default Policy',
                    description: 'Auto-classify policy',
                    enabled: true,
                    priority: 10,
                    auto_classify_threshold: 90,
                    trust_patterns: true,
                },
            ], new Map([[libraryId, libraryId]]));

            const result = await db.query('SELECT * FROM library_policies');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].name).toBe('Default Policy');
            expect(result.rows[0].auto_classify_threshold).toBe(90);
            expect(result.rows[0].trust_patterns).toBe(true);
        });

        it('handles JSONB columns correctly', async () => {
            const libResult = await db.query(`INSERT INTO libraries (name, external_id, media_type) VALUES ('JsonbLib', 'jl-1', 'movie') RETURNING id`);
            const libraryId = libResult.rows[0].id;

            await restoreLibraryPolicies(db, [
                {
                    library_id: libraryId,
                    name: 'JSONB Policy',
                    notify_channels: ['app', 'discord'],
                    source_library_ids: [1, 2, 3],
                },
            ], new Map([[libraryId, libraryId]]));

            const result = await db.query('SELECT * FROM library_policies WHERE name = $1', ['JSONB Policy']);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].notify_channels).toEqual(['app', 'discord']);
            expect(result.rows[0].source_library_ids).toEqual([1, 2, 3]);
        });

        it('skips policies when library not in ID map', async () => {
            await restoreLibraryPolicies(db, [
                { library_id: 99999, name: 'Orphan' },
            ], new Map());

            const result = await db.query('SELECT COUNT(*) FROM library_policies');
            expect(Number(result.rows[0].count)).toBe(0);
        });
    });

    describe('restoreLibraryCustomRules', () => {
        it('inserts custom rules with JSONB rule_json', async () => {
            const libResult = await db.query(`INSERT INTO libraries (name, external_id, media_type) VALUES ('RuleLib', 'rl-1', 'movie') RETURNING id`);
            const libraryId = libResult.rows[0].id;

            await restoreLibraryCustomRules(db, [
                {
                    library_id: libraryId,
                    name: 'Genre Rule',
                    description: 'Match action genre',
                    rule_json: { field: 'genre', operator: 'contains', value: 'Action' },
                    is_active: true,
                },
            ], new Map([[libraryId, libraryId]]));

            const result = await db.query('SELECT * FROM library_custom_rules');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].name).toBe('Genre Rule');
            expect(result.rows[0].rule_json).toEqual({ field: 'genre', operator: 'contains', value: 'Action' });
        });
    });

    describe('restoreLabelPresets', () => {
        it('inserts label presets', async () => {
            await restoreLabelPresets(db, [
                { category: 'genre', name: 'action', display_name: 'Action', description: 'Action genre', media_type: 'both', tmdb_match_field: null, tmdb_match_values: null },
            ]);

            const result = await db.query('SELECT * FROM label_presets');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].name).toBe('action');
            expect(result.rows[0].category).toBe('genre');
        });
    });

    describe('restoreScheduledTasks', () => {
        it('inserts scheduled tasks', async () => {
            await restoreScheduledTasks(db, [
                { name: 'Log Cleanup', task_type: 'cleanup_logs', library_id: null, interval_minutes: 1440, enabled: true },
            ], new Map());

            const result = await db.query('SELECT * FROM scheduled_tasks');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].name).toBe('Log Cleanup');
            expect(result.rows[0].interval_minutes).toBe(1440);
        });
    });

    describe('restoreAutoLearnedPreferences', () => {
        it('inserts auto-learned preferences', async () => {
            const libResult = await db.query(`INSERT INTO libraries (name, external_id, media_type) VALUES ('PrefLib', 'prl-1', 'movie') RETURNING id`);
            const libraryId = libResult.rows[0].id;

            await restoreAutoLearnedPreferences(db, [
                {
                    library_id: libraryId,
                    preference_type: 'genre_action',
                    preference_value: 'include',
                    confidence_count: 15,
                    source: 'user_feedback',
                    status: 'active',
                },
            ], new Map([[libraryId, libraryId]]));

            const result = await db.query('SELECT * FROM auto_learned_preferences');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].preference_type).toBe('genre_action');
            expect(result.rows[0].confidence_count).toBe(15);
        });
    });

    describe('restorePathMappings', () => {
        it('inserts path mappings with legacy column names', async () => {
            await restorePathMappings(db, [
                { source_path: '/media/movies', target_path: '/mnt/movies', is_active: true },
            ]);

            const result = await db.query('SELECT * FROM path_mappings');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].arr_path).toBe('/media/movies');
            expect(result.rows[0].local_path).toBe('/mnt/movies');
        });

        it('inserts path mappings with current column names', async () => {
            await restorePathMappings(db, [
                { arr_path: '/media/tv', local_path: '/mnt/tv', is_active: true },
            ]);

            const result = await db.query('SELECT * FROM path_mappings WHERE arr_path = $1', ['/media/tv']);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].local_path).toBe('/mnt/tv');
        });
    });

    describe('restoreOllamaConfig', () => {
        it('inserts ollama config', async () => {
            await restoreOllamaConfig(db, { host: 'localhost', port: 11434, model: 'llama3' });

            const result = await db.query('SELECT * FROM ollama_config');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].host).toBe('localhost');
            expect(result.rows[0].model).toBe('llama3');
        });

        it('handles null config', async () => {
            await restoreOllamaConfig(db, null);
            const result = await db.query('SELECT COUNT(*) FROM ollama_config');
            expect(Number(result.rows[0].count)).toBe(0);
        });
    });

    describe('restoreTmdbConfig', () => {
        it('inserts tmdb config', async () => {
            await restoreTmdbConfig(db, { api_key: 'tmdb-key-123' });

            const result = await db.query('SELECT * FROM tmdb_config');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].api_key).toBe('tmdb-key-123');
        });
    });

    describe('restoreOmdbConfig', () => {
        it('inserts omdb config', async () => {
            await restoreOmdbConfig(db, { api_key: 'omdb-key', is_active: true, daily_limit: 1000 });

            const result = await db.query('SELECT * FROM omdb_config');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].api_key).toBe('omdb-key');
            expect(result.rows[0].daily_limit).toBe(1000);
        });
    });

    describe('restoreAiConfig', () => {
        it('inserts ai config', async () => {
            await restoreAiConfig(db, { provider: 'openai', api_key: 'ai-key', model: 'gpt-4', base_url: null });

            const result = await db.query('SELECT * FROM ai_config');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].provider).toBe('openai');
        });
    });

    describe('restoreWebhookConfig', () => {
        it('inserts webhook config', async () => {
            await restoreWebhookConfig(db, { id: 1, secret_key: 'wh-secret', enabled: true });

            const result = await db.query('SELECT * FROM webhook_config');
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].secret_key).toBe('wh-secret');
        });
    });

    describe('restoreSettings', () => {
        it('inserts settings', async () => {
            await restoreSettings(db, [
                { key: 'log_retention_days', value: '30' },
                { key: 'max_retry_attempts', value: '5' },
            ]);

            const result = await db.query('SELECT * FROM settings ORDER BY key');
            expect(result.rows).toHaveLength(2);
            expect(result.rows[0].key).toBe('log_retention_days');
        });

        it('upserts on conflict', async () => {
            await db.query(`INSERT INTO settings (key, value) VALUES ('log_retention_days', '30')`);
            await restoreSettings(db, [
                { key: 'log_retention_days', value: '60' },
            ]);

            const result = await db.query('SELECT * FROM settings WHERE key = $1', ['log_retention_days']);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].value).toBe('60');
        });
    });

    describe('restoreLibraryLabels', () => {
        it('inserts library labels with label_preset_id', async () => {
            const libResult = await db.query(`INSERT INTO libraries (name, external_id, media_type) VALUES ('LabelLib', 'll-1', 'movie') RETURNING id`);
            const libraryId = libResult.rows[0].id;
            const presetResult = await db.query(`INSERT INTO label_presets (category, name, display_name) VALUES ('genre', 'action', 'Action') RETURNING id`);
            const presetId = presetResult.rows[0].id;

            await restoreLibraryLabels(db, [
                { library_id: libraryId, label_preset_id: presetId, rule_type: 'include' },
            ], new Map([[libraryId, libraryId]]));

            const result = await db.query('SELECT * FROM library_labels WHERE library_id = $1', [libraryId]);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].label_preset_id).toBe(presetId);
            expect(result.rows[0].rule_type).toBe('include');
        });

        it('skips labels when library not in ID map', async () => {
            await restoreLibraryLabels(db, [
                { library_id: 99999, label_preset_id: 1, rule_type: 'include' },
            ], new Map());

            const result = await db.query('SELECT COUNT(*) FROM library_labels');
            expect(Number(result.rows[0].count)).toBe(0);
        });
    });

    describe('Full restore round-trip', () => {
        it('restores all config types from simulated backup data', async () => {
            await restoreConfidenceSettings(db, [
                { setting_key: 'weight_exact', setting_value: '30', description: null, default_value: '25' },
            ]);
            await restoreSettings(db, [
                { key: 'log_retention_days', value: '30' },
            ]);
            await restoreMediaServers(db, [
                { type: 'plex', name: 'TestPlex', url: 'http://plex:32400', api_key: 'tok', is_active: true },
            ]);

            const confidenceCount = await db.query('SELECT COUNT(*) FROM confidence_settings');
            expect(Number(confidenceCount.rows[0].count)).toBe(1);

            const settingsCount = await db.query('SELECT COUNT(*) FROM settings');
            expect(Number(settingsCount.rows[0].count)).toBe(1);

            const serversCount = await db.query('SELECT COUNT(*) FROM media_server');
            expect(Number(serversCount.rows[0].count)).toBe(1);
        });

        it('library ID remapping works across dependent tables', async () => {
            const libResult = await db.query(`INSERT INTO libraries (name, external_id, media_type) VALUES ('RemapLib', 'remap-1', 'movie') RETURNING id`);
            const libraryId = libResult.rows[0].id;
            const idMap = new Map([[libraryId, libraryId]]);

            const presetResult = await db.query(`INSERT INTO label_presets (category, name, display_name) VALUES ('genre', 'remap-label', 'Remap Label') RETURNING id`);
            const presetId = presetResult.rows[0].id;

            await restoreLibraryLabels(db, [
                { library_id: libraryId, label_preset_id: presetId, rule_type: 'include' },
            ], idMap);

            await restoreLibraryPolicies(db, [
                { library_id: libraryId, name: 'Remap Policy', enabled: true, priority: 5 },
            ], idMap);

            await restoreAutoLearnedPreferences(db, [
                { library_id: libraryId, preference_type: 'test', preference_value: 'val', confidence_count: 5, source: 'backup', status: 'active' },
            ], idMap);

            const labels = await db.query('SELECT * FROM library_labels WHERE library_id = $1', [libraryId]);
            expect(labels.rows).toHaveLength(1);

            const policies = await db.query('SELECT * FROM library_policies WHERE library_id = $1', [libraryId]);
            expect(policies.rows).toHaveLength(1);

            const prefs = await db.query('SELECT * FROM auto_learned_preferences WHERE library_id = $1', [libraryId]);
            expect(prefs.rows).toHaveLength(1);
        });
    });
});
