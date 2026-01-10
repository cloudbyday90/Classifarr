const db = require('../../config/database');

describe('Policy-Driven Schema Integration Test', () => {

    // Ensure test media server exists for tests that require libraries
    beforeAll(async () => {
        await db.query(`
            INSERT INTO media_server (type, name, url, api_key)
            VALUES ('plex', 'Test Media Server', 'http://localhost:32400', 'test-api-key')
            ON CONFLICT DO NOTHING
        `);
    });

    describe('Core Policy Tables', () => {
        test('should have library_policies table', async () => {
            const res = await db.query("SELECT to_regclass('library_policies')");
            expect(res.rows[0].to_regclass).toBe('library_policies');
        });

        test('library_policies should have all required columns', async () => {
            const res = await db.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'library_policies'
                ORDER BY ordinal_position
            `);
            const columns = res.rows.map(r => r.column_name);
            
            // Basic columns
            expect(columns).toContain('id');
            expect(columns).toContain('library_id');
            expect(columns).toContain('name');
            expect(columns).toContain('description');
            expect(columns).toContain('enabled');
            
            // Ordering
            expect(columns).toContain('priority');
            expect(columns).toContain('sort_order');
            
            // Classification behavior
            expect(columns).toContain('auto_classify_threshold');
            expect(columns).toContain('prompt_threshold');
            expect(columns).toContain('require_ai_validation');
            
            // Trust settings
            expect(columns).toContain('trust_patterns');
            expect(columns).toContain('trust_rag');
            expect(columns).toContain('trust_history');
            
            // Weight overrides
            expect(columns).toContain('preset_weight');
            expect(columns).toContain('pattern_weight');
            expect(columns).toContain('rag_weight');
            expect(columns).toContain('history_weight');
            
            // Multi-policy behavior
            expect(columns).toContain('combination_mode');
            expect(columns).toContain('notify_channels');
            expect(columns).toContain('exclusive');
            expect(columns).toContain('source_library_ids');
            
            // Metadata
            expect(columns).toContain('created_at');
            expect(columns).toContain('updated_at');
            expect(columns).toContain('created_by');
        });

        test('library_policies should have proper indexes', async () => {
            const res = await db.query(`
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'library_policies'
            `);
            const indexes = res.rows.map(r => r.indexname);
            
            expect(indexes).toContain('idx_library_policies_library_id');
            expect(indexes).toContain('idx_library_policies_priority');
            expect(indexes).toContain('idx_library_policies_source');
        });

        test('library_policies should have foreign key to libraries', async () => {
            const res = await db.query(`
                SELECT 
                    tc.constraint_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                AND tc.table_name='library_policies'
                AND kcu.column_name = 'library_id'
            `);
            
            expect(res.rows.length).toBeGreaterThan(0);
            expect(res.rows[0].foreign_table_name).toBe('libraries');
        });
    });

    describe('Content Presets Table', () => {
        test('should have content_presets table', async () => {
            const res = await db.query("SELECT to_regclass('content_presets')");
            expect(res.rows[0].to_regclass).toBe('content_presets');
        });

        test('content_presets should have all required columns', async () => {
            const res = await db.query(`
                SELECT column_name
                FROM information_schema.columns 
                WHERE table_name = 'content_presets'
            `);
            const columns = res.rows.map(r => r.column_name);
            
            expect(columns).toContain('id');
            expect(columns).toContain('key');
            expect(columns).toContain('name');
            expect(columns).toContain('description');
            expect(columns).toContain('icon');
            expect(columns).toContain('category');
            expect(columns).toContain('signals');
            expect(columns).toContain('is_system');
            expect(columns).toContain('user_id');
            expect(columns).toContain('is_public');
            expect(columns).toContain('based_on_preset_id');
            expect(columns).toContain('usage_count');
            expect(columns).toContain('display_order');
        });

        test('content_presets signals column should be JSONB type', async () => {
            const res = await db.query(`
                SELECT data_type
                FROM information_schema.columns 
                WHERE table_name = 'content_presets'
                AND column_name = 'signals'
            `);
            
            expect(res.rows[0].data_type).toBe('jsonb');
        });

        test('content_presets should have GIN index on signals', async () => {
            const res = await db.query(`
                SELECT indexname, indexdef
                FROM pg_indexes 
                WHERE tablename = 'content_presets'
                AND indexname = 'idx_content_presets_signals'
            `);
            
            expect(res.rows.length).toBe(1);
            expect(res.rows[0].indexdef).toContain('gin');
        });
    });

    describe('Policy Presets Junction Table', () => {
        test('should have policy_presets table', async () => {
            const res = await db.query("SELECT to_regclass('policy_presets')");
            expect(res.rows[0].to_regclass).toBe('policy_presets');
        });

        test('policy_presets should have unique constraint on policy_id and preset_id', async () => {
            const res = await db.query(`
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_name = 'policy_presets'
                AND constraint_type = 'UNIQUE'
            `);
            
            expect(res.rows.length).toBeGreaterThan(0);
        });

        test('policy_presets should have foreign keys', async () => {
            const res = await db.query(`
                SELECT 
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                AND tc.table_name='policy_presets'
            `);
            
            const foreignKeys = res.rows.map(r => ({
                column: r.column_name,
                references: r.foreign_table_name
            }));
            
            expect(foreignKeys).toContainEqual({
                column: 'policy_id',
                references: 'library_policies'
            });
            expect(foreignKeys).toContainEqual({
                column: 'preset_id',
                references: 'content_presets'
            });
        });
    });

    describe('Policy Overrides Table', () => {
        test('should have policy_overrides table', async () => {
            const res = await db.query("SELECT to_regclass('policy_overrides')");
            expect(res.rows[0].to_regclass).toBe('policy_overrides');
        });

        test('policy_overrides override_config should be JSONB type', async () => {
            const res = await db.query(`
                SELECT data_type
                FROM information_schema.columns 
                WHERE table_name = 'policy_overrides'
                AND column_name = 'override_config'
            `);
            
            expect(res.rows[0].data_type).toBe('jsonb');
        });
    });

    describe('Policy Feedback Log Table', () => {
        test('should have policy_feedback_log table', async () => {
            const res = await db.query("SELECT to_regclass('policy_feedback_log')");
            expect(res.rows[0].to_regclass).toBe('policy_feedback_log');
        });

        test('policy_feedback_log should have all required columns', async () => {
            const res = await db.query(`
                SELECT column_name
                FROM information_schema.columns 
                WHERE table_name = 'policy_feedback_log'
            `);
            const columns = res.rows.map(r => r.column_name);
            
            // Item identification
            expect(columns).toContain('tmdb_id');
            expect(columns).toContain('media_type');
            expect(columns).toContain('title');
            expect(columns).toContain('item_metadata');
            
            // Decision context
            expect(columns).toContain('prompt_type');
            expect(columns).toContain('original_scores');
            expect(columns).toContain('top_suggestion_library_id');
            expect(columns).toContain('top_suggestion_score');
            
            // User decision
            expect(columns).toContain('selected_library_id');
            expect(columns).toContain('selected_policy_id');
            expect(columns).toContain('was_correction');
            expect(columns).toContain('user_reason');
            expect(columns).toContain('user_reason_text');
            
            // Patterns and analysis
            expect(columns).toContain('patterns_created');
            expect(columns).toContain('signal_analysis');
            
            // Timing
            expect(columns).toContain('prompted_at');
            expect(columns).toContain('responded_at');
            expect(columns).toContain('response_time_seconds');
            expect(columns).toContain('source');
        });

        test('policy_feedback_log should have proper indexes', async () => {
            const res = await db.query(`
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'policy_feedback_log'
            `);
            const indexes = res.rows.map(r => r.indexname);
            
            expect(indexes).toContain('idx_policy_feedback_tmdb');
            expect(indexes).toContain('idx_policy_feedback_library');
            expect(indexes).toContain('idx_policy_feedback_policy');
            expect(indexes).toContain('idx_policy_feedback_date');
            expect(indexes).toContain('idx_policy_feedback_was_correction');
        });
    });

    describe('Policy Tuning Suggestions Table', () => {
        test('should have policy_tuning_suggestions table', async () => {
            const res = await db.query("SELECT to_regclass('policy_tuning_suggestions')");
            expect(res.rows[0].to_regclass).toBe('policy_tuning_suggestions');
        });

        test('policy_tuning_suggestions should have all required columns', async () => {
            const res = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns 
                WHERE table_name = 'policy_tuning_suggestions'
            `);
            const columns = res.rows.map(r => r.column_name);
            
            expect(columns).toContain('id');
            expect(columns).toContain('policy_id');
            expect(columns).toContain('suggestion_type');
            expect(columns).toContain('suggestion_config');
            expect(columns).toContain('supporting_feedback_ids');
            expect(columns).toContain('confidence');
            expect(columns).toContain('impact_estimate');
            expect(columns).toContain('status');
            expect(columns).toContain('reviewed_at');
            expect(columns).toContain('reviewed_by');
            expect(columns).toContain('rejection_reason');
        });

        test('policy_tuning_suggestions supporting_feedback_ids should be integer array', async () => {
            const res = await db.query(`
                SELECT data_type, udt_name
                FROM information_schema.columns 
                WHERE table_name = 'policy_tuning_suggestions'
                AND column_name = 'supporting_feedback_ids'
            `);
            
            expect(res.rows[0].data_type).toBe('ARRAY');
        });
    });

    describe('Policy Learning Stats Table', () => {
        test('should have policy_learning_stats table', async () => {
            const res = await db.query("SELECT to_regclass('policy_learning_stats')");
            expect(res.rows[0].to_regclass).toBe('policy_learning_stats');
        });

        test('policy_learning_stats should have unique constraint on policy_id', async () => {
            const res = await db.query(`
                SELECT constraint_name, constraint_type
                FROM information_schema.table_constraints
                WHERE table_name = 'policy_learning_stats'
                AND constraint_type = 'UNIQUE'
            `);
            
            expect(res.rows.length).toBeGreaterThan(0);
        });

        test('policy_learning_stats should have all metric columns', async () => {
            const res = await db.query(`
                SELECT column_name
                FROM information_schema.columns 
                WHERE table_name = 'policy_learning_stats'
            `);
            const columns = res.rows.map(r => r.column_name);
            
            expect(columns).toContain('total_decisions');
            expect(columns).toContain('auto_classified');
            expect(columns).toContain('ai_validated');
            expect(columns).toContain('user_prompted');
            expect(columns).toContain('user_corrections');
            expect(columns).toContain('accuracy_rate');
            expect(columns).toContain('auto_accuracy_rate');
            expect(columns).toContain('last_7_days_accuracy');
            expect(columns).toContain('last_30_days_accuracy');
            expect(columns).toContain('trend');
        });
    });

    describe('Source Library Policy Links Table', () => {
        test('should have source_library_policy_links table', async () => {
            const res = await db.query("SELECT to_regclass('source_library_policy_links')");
            expect(res.rows[0].to_regclass).toBe('source_library_policy_links');
        });

        test('source_library_policy_links should have unique constraint', async () => {
            const res = await db.query(`
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_name = 'source_library_policy_links'
                AND constraint_type = 'UNIQUE'
            `);
            
            expect(res.rows.length).toBeGreaterThan(0);
        });

        test('source_library_policy_links should have proper indexes', async () => {
            const res = await db.query(`
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'source_library_policy_links'
            `);
            const indexes = res.rows.map(r => r.indexname);
            
            expect(indexes).toContain('idx_source_library_links_source');
            expect(indexes).toContain('idx_source_library_links_policy');
        });
    });

    describe('Policy Change Log Table', () => {
        test('should have policy_change_log table', async () => {
            const res = await db.query("SELECT to_regclass('policy_change_log')");
            expect(res.rows[0].to_regclass).toBe('policy_change_log');
        });

        test('policy_change_log should have JSONB columns', async () => {
            const res = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns 
                WHERE table_name = 'policy_change_log'
                AND data_type = 'jsonb'
            `);
            const jsonbColumns = res.rows.map(r => r.column_name);
            
            expect(jsonbColumns).toContain('change_config');
            expect(jsonbColumns).toContain('before_metrics');
            expect(jsonbColumns).toContain('after_metrics');
        });
    });

    describe('Existing Table Modifications', () => {
        test('library_custom_rules should have deprecation columns', async () => {
            const res = await db.query(`
                SELECT column_name
                FROM information_schema.columns 
                WHERE table_name = 'library_custom_rules'
            `);
            const columns = res.rows.map(r => r.column_name);
            
            expect(columns).toContain('deprecated');
            expect(columns).toContain('migrated_to_policy_id');
        });

        test('library_custom_rules should have index on deprecated column', async () => {
            const res = await db.query(`
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'library_custom_rules'
            `);
            const indexes = res.rows.map(r => r.indexname);
            
            expect(indexes).toContain('idx_library_custom_rules_deprecated');
        });

        test('library_custom_rules migrated_to_policy_id should reference library_policies', async () => {
            const res = await db.query(`
                SELECT 
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                AND tc.table_name='library_custom_rules'
                AND kcu.column_name = 'migrated_to_policy_id'
            `);
            
            if (res.rows.length > 0) {
                expect(res.rows[0].foreign_table_name).toBe('library_policies');
            }
        });
    });

    describe('JSONB Operations', () => {
        test('should be able to insert and query JSONB data in library_policies', async () => {
            // Create a test library first
            const libRes = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type)
                SELECT 
                    (SELECT id FROM media_server LIMIT 1),
                    'test-lib-policy-' || gen_random_uuid()::text,
                    'Test Library Policy',
                    'movie'
                WHERE EXISTS (SELECT 1 FROM media_server)
                RETURNING id
            `);

            // Ensure test data exists
            expect(libRes.rows.length).toBeGreaterThan(0);
            
            const libraryId = libRes.rows[0].id;

            // Insert a policy with JSONB data
            const insertRes = await db.query(`
                INSERT INTO library_policies (
                    library_id,
                    name,
                    notify_channels,
                    source_library_ids
                ) VALUES ($1, $2, $3, $4)
                RETURNING id, notify_channels, source_library_ids
            `, [libraryId, 'Test Policy', '["app", "discord"]', '["lib1", "lib2"]']);

            expect(insertRes.rows.length).toBe(1);
            expect(insertRes.rows[0].notify_channels).toEqual(["app", "discord"]);
            expect(insertRes.rows[0].source_library_ids).toEqual(["lib1", "lib2"]);

            // Clean up
            await db.query('DELETE FROM library_policies WHERE id = $1', [insertRes.rows[0].id]);
            await db.query('DELETE FROM libraries WHERE id = $1', [libraryId]);
        });

        test('should be able to insert and query JSONB data in content_presets', async () => {
            const testSignals = {
                genres: ["Action", "Thriller"],
                keywords: ["superhero", "comic book"],
                min_rating: 7.0
            };

            const res = await db.query(`
                INSERT INTO content_presets (
                    key,
                    name,
                    signals,
                    is_system
                ) VALUES ($1, $2, $3, $4)
                RETURNING id, signals
            `, ['test-preset-' + Date.now(), 'Test Preset', JSON.stringify(testSignals), false]);

            expect(res.rows.length).toBe(1);
            expect(res.rows[0].signals).toEqual(testSignals);

            // Clean up
            await db.query('DELETE FROM content_presets WHERE id = $1', [res.rows[0].id]);
        });
    });

    describe('Foreign Key Cascades', () => {
        test('deleting a library should cascade to library_policies', async () => {
            // This test verifies ON DELETE CASCADE is working
            const libRes = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type)
                SELECT 
                    (SELECT id FROM media_server LIMIT 1),
                    'test-cascade-' || gen_random_uuid()::text,
                    'Test Cascade Library',
                    'movie'
                WHERE EXISTS (SELECT 1 FROM media_server)
                RETURNING id
            `);

            // Ensure test data exists
            expect(libRes.rows.length).toBeGreaterThan(0);
            
            const libraryId = libRes.rows[0].id;

            // Create a policy for this library
            const policyRes = await db.query(`
                INSERT INTO library_policies (library_id, name)
                VALUES ($1, $2)
                RETURNING id
            `, [libraryId, 'Test Cascade Policy']);

            const policyId = policyRes.rows[0].id;

            // Verify policy exists
            const checkPolicy = await db.query('SELECT id FROM library_policies WHERE id = $1', [policyId]);
            expect(checkPolicy.rows.length).toBe(1);

            // Delete the library
            await db.query('DELETE FROM libraries WHERE id = $1', [libraryId]);

            // Verify policy was cascaded (deleted)
            const checkPolicyAfter = await db.query('SELECT id FROM library_policies WHERE id = $1', [policyId]);
            expect(checkPolicyAfter.rows.length).toBe(0);
        });
    });

});
