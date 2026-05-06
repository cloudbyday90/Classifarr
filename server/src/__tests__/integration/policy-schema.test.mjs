/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');

describe('Policy-Driven Schema Integration Test', () => {

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
            const columns = res.rows.map((row) => row.column_name);

            expect(columns).toContain('id');
            expect(columns).toContain('library_id');
            expect(columns).toContain('name');
            expect(columns).toContain('description');
            expect(columns).toContain('enabled');
            expect(columns).toContain('priority');
            expect(columns).toContain('sort_order');
            expect(columns).toContain('auto_classify_threshold');
            expect(columns).toContain('prompt_threshold');
            expect(columns).toContain('require_ai_validation');
            expect(columns).toContain('trust_patterns');
            expect(columns).toContain('trust_rag');
            expect(columns).toContain('trust_history');
            expect(columns).toContain('preset_weight');
            expect(columns).toContain('pattern_weight');
            expect(columns).toContain('rag_weight');
            expect(columns).toContain('history_weight');
            expect(columns).toContain('combination_mode');
            expect(columns).toContain('notify_channels');
            expect(columns).toContain('exclusive');
            expect(columns).toContain('source_library_ids');
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
            const indexes = res.rows.map((row) => row.indexname);

            expect(indexes).toContain('idx_library_policies_library_id');
            expect(indexes).toContain('idx_library_policies_priority');
            expect(indexes).toContain('idx_library_policies_source');
        });

        test('library_policies should enforce the threshold ladder constraint', async () => {
            const res = await db.query(`
                SELECT conname, pg_get_constraintdef(oid) AS definition
                FROM pg_constraint
                WHERE conrelid = 'public.library_policies'::regclass
                  AND conname = 'chk_library_policies_threshold_ladder'
            `);

            expect(res.rows).toHaveLength(1);
            expect(res.rows[0].definition).toContain('auto_classify_threshold <= 95');
            expect(res.rows[0].definition).toContain('prompt_threshold <= auto_classify_threshold');
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
            const columns = res.rows.map((row) => row.column_name);

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

            const foreignKeys = res.rows.map((row) => ({
                column: row.column_name,
                references: row.foreign_table_name
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
            const columns = res.rows.map((row) => row.column_name);

            expect(columns).toContain('tmdb_id');
            expect(columns).toContain('media_type');
            expect(columns).toContain('title');
            expect(columns).toContain('item_metadata');
            expect(columns).toContain('prompt_type');
            expect(columns).toContain('original_scores');
            expect(columns).toContain('top_suggestion_library_id');
            expect(columns).toContain('top_suggestion_score');
            expect(columns).toContain('selected_library_id');
            expect(columns).toContain('selected_policy_id');
            expect(columns).toContain('was_correction');
            expect(columns).toContain('user_reason');
            expect(columns).toContain('user_reason_text');
            expect(columns).toContain('patterns_created');
            expect(columns).toContain('signal_analysis');
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
            const indexes = res.rows.map((row) => row.indexname);

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
            const columns = res.rows.map((row) => row.column_name);

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
            const columns = res.rows.map((row) => row.column_name);

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
            const indexes = res.rows.map((row) => row.indexname);

            expect(indexes).toContain('idx_source_library_links_source');
            expect(indexes).toContain('idx_source_library_links_policy');
        });
    });
});
