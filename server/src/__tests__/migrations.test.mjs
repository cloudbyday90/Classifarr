/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
    compareMigrations,
    createMigrationRunner,
    getMigrationSortKey
} from '../config/migrations.mjs';

const __dirname = import.meta.dirname;

describe('Migration Path Resolution', () => {
    test('should resolve migrations directory to absolute path', () => {
        const migrationRunner = createMigrationRunner();

        expect(path.isAbsolute(migrationRunner.migrationsDir)).toBe(true);

        const expectedPath = path.resolve(__dirname, '../../../database/migrations');
        expect(migrationRunner.migrationsDir).toBe(expectedPath);
    });

    test('should support MIGRATIONS_DIR environment variable override', () => {
        const customPath = '/custom/migrations/path';
        const migrationRunner = createMigrationRunner({
            env: { ...process.env, MIGRATIONS_DIR: customPath }
        });

        expect(migrationRunner.migrationsDir).toBe(customPath);
    });

    test('should support SCHEMA_FILE environment variable override', () => {
        const customSchemaPath = '/custom/schema/current.sql';
        const migrationRunner = createMigrationRunner({
            env: { ...process.env, SCHEMA_FILE: customSchemaPath }
        });

        expect(migrationRunner.schemaFile).toBe(customSchemaPath);
    });

    test('init.sql should use script-relative migration includes', () => {
        const initSqlPath = path.resolve(__dirname, '../../../database/init.sql');
        const initSql = fs.readFileSync(initSqlPath, 'utf8');

        expect(initSql).toContain('\\ir migrations/001_add_arr_settings.sql');
        expect(initSql).not.toContain('/app/database/migrations/');
    });
});

describe('Migration Sorting', () => {
    test('getMigrationSortKey should handle numeric migrations', () => {
        expect(getMigrationSortKey('001_initial.sql')).toBe('00000000_000000_0000000001');
        expect(getMigrationSortKey('076_latest.sql')).toBe('00000000_000000_0000000076');
    });

    test('getMigrationSortKey should handle timestamp migrations', () => {
        expect(getMigrationSortKey('20260201_150000_feature.sql')).toBe('20260201_150000');
        expect(getMigrationSortKey('20260201_160000_another.sql')).toBe('20260201_160000');
    });

    test('compareMigrations should sort numeric before timestamp', () => {
        const files = [
            '20260201_150000_feature.sql',
            '001_initial.sql',
            '076_latest.sql',
            '20260201_140000_another.sql'
        ];

        const sorted = files.sort(compareMigrations);

        expect(sorted[0]).toBe('001_initial.sql');
        expect(sorted[1]).toBe('076_latest.sql');
        expect(sorted[2]).toBe('20260201_140000_another.sql');
        expect(sorted[3]).toBe('20260201_150000_feature.sql');
    });
});

describe('AI model identifier migrations', () => {
    test('widen migration covers provider, embedding, usage, and Ollama model columns', () => {
        const migrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260425_120000_widen_ai_model_identifiers.sql'
        );
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        [
            "('ai_provider_config', 'model')",
            "('ai_provider_config', 'ollama_model')",
            "('ai_provider_config', 'embedding_model')",
            "('ai_provider_config', 'embedding_ollama_model')",
            "('ai_provider_config', 'embedding_cloud_model')",
            "('ai_provider_config', 'image_embedding_local_model')",
            "('ai_provider_config', 'image_embedding_cloud_model')",
            "('ai_usage_log', 'model')",
            "('classification_embeddings', 'model')",
            "('ollama_config', 'model')"
        ].forEach(columnPair => {
            expect(migrationSql).toContain(columnPair);
        });
        expect(migrationSql).toContain('ALTER COLUMN %I TYPE TEXT');
    });
});

describe('Image embedding default migrations', () => {
    test('corrective migration makes image embeddings opt-in on sidecar defaults', () => {
        const migrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260425_121000_fix_image_embedding_defaults.sql'
        );
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        expect(migrationSql).toContain("ALTER COLUMN image_embedding_provider_mode SET DEFAULT 'disabled'");
        expect(migrationSql).toContain('ALTER COLUMN image_embedding_local_port SET DEFAULT 8000');
        expect(migrationSql).toContain("image_embedding_provider_mode = 'same'");
        expect(migrationSql).toContain('image_embedding_local_port = 11434');
        expect(migrationSql).toContain("COALESCE(image_embedding_provider_mode, 'disabled') = 'disabled'");
    });
});

describe('Schema snapshot freshness', () => {
    const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
    const schemaPath = path.resolve(__dirname, '../../../database/schema/current.sql');

    function readSchemaSnapshot() {
        return fs.readFileSync(schemaPath, 'utf8');
    }

    function getCreateTableBlock(schemaSql, tableName) {
        const escapedTable = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = schemaSql.match(new RegExp(`CREATE TABLE public\\.${escapedTable} \\([\\s\\S]*?\\n\\);`));
        return match?.[0] || '';
    }

    test('current.sql marks every migration as applied', () => {
        const schemaSql = readSchemaSnapshot();
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(filename => filename.endsWith('.sql'));

        migrationFiles.forEach(filename => {
            expect(schemaSql).toContain(`'${filename}'`);
        });
    });

    test('current.sql reflects current AI model identifier and image defaults', () => {
        const schemaSql = readSchemaSnapshot();
        const aiProviderConfig = getCreateTableBlock(schemaSql, 'ai_provider_config');
        const aiUsageLog = getCreateTableBlock(schemaSql, 'ai_usage_log');
        const classificationEmbeddings = getCreateTableBlock(schemaSql, 'classification_embeddings');
        const ollamaConfig = getCreateTableBlock(schemaSql, 'ollama_config');

        [
            'model text',
            'ollama_model text',
            'embedding_model text',
            'embedding_ollama_model text',
            'embedding_cloud_model text',
            'image_embedding_local_model text',
            'image_embedding_cloud_model text',
            "image_embedding_provider_mode character varying(30) DEFAULT 'disabled'::character varying",
            'image_embedding_local_port integer DEFAULT 8000'
        ].forEach(expectedColumn => {
            expect(aiProviderConfig).toContain(expectedColumn);
        });

        expect(aiUsageLog).toContain('model text');
        expect(classificationEmbeddings).toContain('model text NOT NULL');
        expect(ollamaConfig).toContain("model text DEFAULT 'qwen3:14b'::character varying NOT NULL");
    });

    test('current.sql includes clarification seed reconciliation for fresh installs', () => {
        const schemaSql = readSchemaSnapshot();

        expect(schemaSql).toContain('-- === Seed: 20260517_235500_reconcile_clarification_seed_data.sql ===');
        expect(schemaSql).toContain("INSERT INTO confidence_thresholds (");
        expect(schemaSql).toContain("'clarify',");
        expect(schemaSql).toContain("INSERT INTO clarification_questions (");
        expect(schemaSql).toContain("What language is this content primarily in?");
    });

    test('current.sql includes bootstrap-sensitive singleton and settings seed reconciliation for fresh installs', () => {
        const schemaSql = readSchemaSnapshot();

        expect(schemaSql).toContain('-- === Seed: 20260518_011500_reconcile_bootstrap_sensitive_seed_data.sql ===');
        expect(schemaSql).toContain('INSERT INTO ai_provider_config (');
        expect(schemaSql).toContain("('weight_source_library', '100', 'Source library signal weight', '100')");
        expect(schemaSql).toContain("('classifarr_media_path', NULL)");
        expect(schemaSql).toContain("('pattern_sync_frequency', 'daily')");
        expect(schemaSql).toContain('INSERT INTO embedding_provider_availability (id)');
    });

    test('current.sql includes lower-priority confidence and retention seed reconciliation for fresh installs', () => {
        const schemaSql = readSchemaSnapshot();

        expect(schemaSql).toContain('-- === Seed: 20260518_013000_reconcile_low_priority_seed_data.sql ===');
        expect(schemaSql).toContain("VALUES ('rag_log_retention_days', '30')");
        expect(schemaSql).toContain("('policy_auto_classify_threshold', '85', 'Confidence % for auto-classification', '85')");
        expect(schemaSql).toContain("('discord_verify_threshold', '60', 'Discord Yes/No verification threshold', '60')");
        expect(schemaSql).toContain("('learning_lookback_days', '30', 'Days of feedback to consider', '30')");
    });

    test('current.sql includes web search provider storage tables and default providers', () => {
        const schemaSql = readSchemaSnapshot();
        const providerCache = getCreateTableBlock(schemaSql, 'web_search_provider_cache');
        const providerConfig = getCreateTableBlock(schemaSql, 'web_search_provider_config');
        const providerHealthEvents = getCreateTableBlock(schemaSql, 'web_search_provider_health_events');
        const providerRouteDecisions = getCreateTableBlock(schemaSql, 'web_search_provider_route_decisions');
        const providerUsage = getCreateTableBlock(schemaSql, 'web_search_provider_usage');
        const providerCalibrationPolicies = getCreateTableBlock(schemaSql, 'web_search_provider_calibration_policies');
        const providerGuardrailEvents = getCreateTableBlock(schemaSql, 'web_search_provider_guardrail_events');

        // Derive the latest migration dynamically so this assertion never needs a
        // manual update when new migration files are added.
        const allMigrationFiles = fs.readdirSync(migrationsDir)
            .filter(filename => filename.endsWith('.sql'))
            .sort(compareMigrations);
        const latestMigrationFilename = allMigrationFiles[allMigrationFiles.length - 1];
        expect(schemaSql).toContain(`-- Latest Migration: ${latestMigrationFilename}`);

        expect(schemaSql).toContain('-- === Seed: 20260614_110500_reconcile_web_search_provider_seed_data.sql ===');
        expect(providerCache).toContain('cache_key character(64) NOT NULL');
        expect(providerCache).toContain('response jsonb NOT NULL');
        expect(providerCache).toContain('expires_at timestamp with time zone NOT NULL');
        expect(providerCache).toContain('metadata jsonb DEFAULT \'{}\'::jsonb NOT NULL');
        expect(providerConfig).toContain('provider_key character varying(40) NOT NULL');
        expect(providerConfig).toContain("config jsonb DEFAULT '{}'::jsonb NOT NULL");
        expect(providerConfig).toContain('cooldown_until timestamp with time zone');
        expect(providerUsage).toContain('provider_key character varying(40) NOT NULL');
        expect(providerUsage).toContain("status character varying(40) NOT NULL");
        expect(providerUsage).toContain('retry_after_seconds integer');
        expect(providerRouteDecisions).toContain('route_id uuid NOT NULL');
        expect(providerRouteDecisions).toContain('candidates jsonb DEFAULT \'[]\'::jsonb NOT NULL');
        expect(providerRouteDecisions).toContain('attempts jsonb DEFAULT \'[]\'::jsonb NOT NULL');
        expect(providerRouteDecisions).toContain('web_search_provider_route_decisions_outcome_check');
        ['success', 'no_provider', 'failed', 'error'].forEach(outcome => {
            expect(providerRouteDecisions).toContain(outcome);
        });
        expect(providerHealthEvents).toContain('provider_key character varying(40) NOT NULL');
        expect(providerHealthEvents).toContain('event_type character varying(40) NOT NULL');
        expect(providerHealthEvents).toContain('health_status character varying(40) NOT NULL');
        expect(providerHealthEvents).toContain('cooldown_until timestamp with time zone');
        expect(providerHealthEvents).toContain('metadata jsonb DEFAULT \'{}\'::jsonb NOT NULL');
        expect(providerHealthEvents).toContain('web_search_provider_health_events_event_type_check');
        ['success', 'error', 'cooldown_started'].forEach(eventType => {
            expect(providerHealthEvents).toContain(eventType);
        });
        expect(providerCalibrationPolicies).toContain('purpose character varying(60) NOT NULL');
        expect(providerCalibrationPolicies).toContain('is_enabled boolean DEFAULT true NOT NULL');
        expect(providerCalibrationPolicies).toContain('lookback_days integer DEFAULT 14 NOT NULL');
        expect(providerCalibrationPolicies).toContain('minimum_samples integer DEFAULT 3');
        expect(providerCalibrationPolicies).toContain('minimum_samples_not_null NOT NULL');
        expect(providerCalibrationPolicies).toContain('maximum_priority_penalty integer DEFAULT 25');
        expect(providerCalibrationPolicies).toContain('maximum_priority_penalty_not_null NOT NULL');
        expect(providerCalibrationPolicies).toContain('outcome_weight integer DEFAULT 15');
        expect(providerCalibrationPolicies).toContain('outcome_weight_not_null NOT NULL');
        expect(providerCalibrationPolicies).toContain('web_search_provider_calibration_policies_purpose_check');
        expect(providerCalibrationPolicies).toContain('web_search_provider_calibration_policies_lookback_days_check');
        expect(providerGuardrailEvents).toContain('purpose character varying(60) DEFAULT \'classification\'::character varying NOT NULL');
        expect(providerGuardrailEvents).toContain('guardrail_code character varying(80) NOT NULL');
        expect(providerGuardrailEvents).toContain('severity character varying(20) NOT NULL');
        expect(providerGuardrailEvents).toContain('metadata jsonb DEFAULT \'{}\'::jsonb NOT NULL');
        expect(providerGuardrailEvents).toContain('web_search_provider_guardrail_events_severity_check');
        ['info', 'warning', 'critical'].forEach(severity => {
            expect(providerGuardrailEvents).toContain(severity);
        });
        expect(schemaSql).toContain("('tavily', 'Tavily', false, 10, '{}'::jsonb)");
        expect(schemaSql).toContain("('brave', 'Brave Search', false, 20, '{}'::jsonb)");
        expect(schemaSql).toContain("('serper', 'Serper.dev', false, 30, '{}'::jsonb)");
        expect(schemaSql).toContain("legacy_source = COALESCE(web_search_provider_config.legacy_source, EXCLUDED.legacy_source)");
        expect(schemaSql).toContain('idx_web_search_provider_cache_expiry');
        expect(schemaSql).toContain('idx_web_search_provider_cache_provider_purpose');
        expect(schemaSql).toContain('idx_web_search_provider_route_decisions_created');
        expect(schemaSql).toContain('idx_web_search_provider_route_decisions_classification');
        expect(schemaSql).toContain('idx_web_search_provider_health_events_provider_time');
        expect(schemaSql).toContain('idx_web_search_provider_health_events_cooldown');
        expect(schemaSql).toContain('idx_web_search_provider_guardrail_events_code_time');
        expect(schemaSql).toContain('idx_web_search_provider_guardrail_events_provider_time');
        expect(schemaSql).toContain('-- === Seed: 20260625_011500_reconcile_web_search_provider_retention_seed_data.sql ===');
        expect(schemaSql).toContain("VALUES ('web_search_provider_usage_retention_days', '62')");
        expect(schemaSql).toContain('-- === Seed: 20260625_030000_add_web_search_provider_route_decision_retention.sql ===');
        expect(schemaSql).toContain("VALUES ('web_search_provider_route_decision_retention_days', '30')");
        expect(schemaSql).toContain('-- === Seed: 20260625_041500_add_web_search_provider_health_retention.sql ===');
        expect(schemaSql).toContain("VALUES ('web_search_provider_health_event_retention_days', '30')");
        expect(schemaSql).toContain('-- === Seed: 20260625_051500_reconcile_web_search_provider_calibration_policy_seed_data.sql ===');
        expect(schemaSql).toContain("VALUES (");
        expect(schemaSql).toContain("'classification',");
        expect(schemaSql).toContain('-- === Seed: 20260625_060000_reconcile_web_search_provider_guardrail_threshold_seed_data.sql ===');
        expect(schemaSql).toContain("VALUES (");
        expect(schemaSql).toContain("'web_search_provider_guardrail_thresholds',");
    });

    test('current.sql includes native policy intent storage tables and indexes', () => {
        const schemaSql = readSchemaSnapshot();
        const migrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260701_160000_add_policy_intent_native_storage.sql'
        );
        const integrityMigrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260713_150000_enforce_single_active_policy_intent.sql'
        );
        const retentionMigrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260714_090000_add_policy_rollback_snapshot_retention_event.sql'
        );
        const reconciliationStateMigrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260715_140000_add_native_intent_reconciliation_state.sql'
        );
        const reconciliationLifecycleMigrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260715_150000_add_native_intent_reconciliation_lifecycle_guards.sql'
        );
        const reconciliationControlMigrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260715_160000_add_native_intent_reconciliation_control.sql'
        );
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        const integrityMigrationSql = fs.readFileSync(integrityMigrationPath, 'utf8');
        const retentionMigrationSql = fs.readFileSync(retentionMigrationPath, 'utf8');
        const reconciliationStateMigrationSql = fs.readFileSync(
            reconciliationStateMigrationPath,
            'utf8'
        );
        const reconciliationLifecycleMigrationSql = fs.readFileSync(
            reconciliationLifecycleMigrationPath,
            'utf8'
        );
        const reconciliationControlMigrationSql = fs.readFileSync(
            reconciliationControlMigrationPath,
            'utf8'
        );
        const policyIntents = getCreateTableBlock(schemaSql, 'policy_intents');
        const policyIntentRules = getCreateTableBlock(schemaSql, 'policy_intent_rules');
        const policyIntentRoutingTargets = getCreateTableBlock(schemaSql, 'policy_intent_routing_targets');
        const policyIntentTemplateApplications = getCreateTableBlock(
            schemaSql,
            'policy_intent_template_applications'
        );
        const policyIntentMigrationEvents = getCreateTableBlock(schemaSql, 'policy_intent_migration_events');
        const policyIntentRollbackSnapshots = getCreateTableBlock(
            schemaSql,
            'policy_intent_rollback_snapshots'
        );
        const policyIntentValidationStatus = getCreateTableBlock(
            schemaSql,
            'policy_intent_validation_status'
        );
        const reconciliationRuns = getCreateTableBlock(
            schemaSql,
            'policy_native_intent_reconciliation_runs'
        );
        const reconciliationOutcomes = getCreateTableBlock(
            schemaSql,
            'policy_native_intent_reconciliation_outcomes'
        );
        const reconciliationStates = getCreateTableBlock(
            schemaSql,
            'policy_native_intent_reconciliation_states'
        );
        const reconciliationHolds = getCreateTableBlock(
            schemaSql,
            'policy_native_intent_reconciliation_holds'
        );
        const reconciliationRestoreGates = getCreateTableBlock(
            schemaSql,
            'policy_native_intent_reconciliation_restore_gates'
        );
        const reconciliationControls = getCreateTableBlock(
            schemaSql,
            'policy_native_intent_reconciliation_controls'
        );
        const reconciliationControlEvents = getCreateTableBlock(
            schemaSql,
            'policy_native_intent_reconciliation_control_events'
        );

        [
            'CREATE TABLE IF NOT EXISTS policy_intents',
            'CREATE TABLE IF NOT EXISTS policy_intent_rules',
            'CREATE TABLE IF NOT EXISTS policy_intent_routing_targets',
            'CREATE TABLE IF NOT EXISTS policy_intent_template_applications',
            'CREATE TABLE IF NOT EXISTS policy_intent_migration_events',
            'CREATE TABLE IF NOT EXISTS policy_intent_rollback_snapshots',
            'CREATE TABLE IF NOT EXISTS policy_intent_validation_status',
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_intents_active_version',
            'CREATE INDEX IF NOT EXISTS idx_policy_intent_rules_values_gin',
            'CREATE INDEX IF NOT EXISTS idx_policy_intent_rollback_snapshots_expiry'
        ].forEach(expectedSnippet => {
            expect(migrationSql).toContain(expectedSnippet);
        });

        expect(policyIntents).toContain('schema_version integer DEFAULT 1 NOT NULL');
        expect(policyIntents).toContain('intent_version integer DEFAULT 1 NOT NULL');
        expect(policyIntents).toContain('review_behavior jsonb DEFAULT \'{}\'::jsonb NOT NULL');
        expect(policyIntents).toContain('validation_status character varying(40) DEFAULT \'pending_validation\'::character varying NOT NULL');
        expect(policyIntents).toContain('policy_intents_schema_version_chk');
        expect(policyIntents).toContain('policy_intents_source_chk');
        expect(policyIntentRules).toContain('"values" jsonb DEFAULT \'{}\'::jsonb NOT NULL');
        expect(policyIntentRules).toContain('policy_intent_rules_collection_role_chk');
        expect(policyIntentRules).toContain('policy_intent_rules_signal_type_chk');
        expect(policyIntentRoutingTargets).toContain('target_status character varying(40) DEFAULT \'configured\'::character varying NOT NULL');
        expect(policyIntentTemplateApplications).toContain('link_state character varying(40) DEFAULT \'applied\'::character varying NOT NULL');
        expect(policyIntentMigrationEvents).toContain('metadata jsonb DEFAULT \'{}\'::jsonb NOT NULL');
        expect(policyIntentMigrationEvents).toContain('policy_intent_migration_events_event_type_chk');
        expect(policyIntentRollbackSnapshots).toContain('snapshot_payload jsonb DEFAULT \'{}\'::jsonb NOT NULL');
        expect(policyIntentRollbackSnapshots).toContain('policy_intent_rollback_snapshots_window_chk');
        expect(policyIntentValidationStatus).toContain('errors jsonb DEFAULT \'[]\'::jsonb NOT NULL');
        expect(policyIntentValidationStatus).toContain('warnings jsonb DEFAULT \'[]\'::jsonb NOT NULL');
        expect(reconciliationRuns).toContain('run_key uuid NOT NULL');
        expect(reconciliationRuns).toContain('policy_native_intent_reconciliation_runs_state_chk');
        expect(reconciliationRuns).toContain('candidate_count integer DEFAULT 0');
        expect(reconciliationRuns).toContain('candidate_count_not_null');
        expect(reconciliationRuns).toContain('policy_native_intent_reconciliation_runs_count_total_chk');
        expect(reconciliationOutcomes).toContain('candidate_fingerprint character varying(71)');
        expect(reconciliationOutcomes).toContain('candidate_fingerprint_not_null');
        expect(reconciliationOutcomes).toContain('policy_native_intent_reconciliation_outcomes_fingerprint_chk');
        expect(reconciliationOutcomes).toContain('policy_native_intent_reconciliation_outcomes_retry_after_evalua');
        expect(reconciliationOutcomes).toContain('retry_not_before timestamp with time zone');
        expect(reconciliationOutcomes).toContain("'requires_maintenance'::character varying");
        expect(reconciliationStates).toContain('policy_id integer NOT NULL');
        expect(reconciliationStates).toContain('candidate_fingerprint character varying(71)');
        expect(reconciliationStates).toContain('failure_count integer DEFAULT 0');
        expect(reconciliationStates).toContain('policy_native_intent_reconciliation_states_fingerprint_chk');
        expect(reconciliationStates).toContain('policy_native_intent_reconciliation_states_outcome_chk');
        expect(reconciliationStates).toContain('policy_native_intent_reconciliation_states_retry_state_chk');
        expect(reconciliationStates).toContain("'requires_maintenance'::character varying");
        expect(reconciliationHolds).toContain('source_event_id bigint');
        expect(reconciliationHolds).toContain('policy_native_intent_reconciliation_holds_release_shape_chk');
        expect(reconciliationRestoreGates).toContain('gate_id smallint');
        expect(reconciliationRestoreGates).toContain(
            'policy_native_intent_reconciliation_restore_gates_state_chk'
        );
        expect(integrityMigrationSql).toContain('LOCK TABLE policy_intents IN SHARE ROW EXCLUSIVE MODE');
        expect(integrityMigrationSql).toContain('active_intent_integrity_repaired');
        expect(integrityMigrationSql).toContain('CREATE UNIQUE INDEX idx_policy_intents_one_active_policy');
        expect(integrityMigrationSql).toContain('DROP INDEX idx_policy_intents_active_version');
        expect(retentionMigrationSql).toContain("'rollback_snapshot_payload_redacted'");
        expect(reconciliationStateMigrationSql).toContain(
            'CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_states'
        );
        expect(reconciliationStateMigrationSql).toContain(
            'CREATE INDEX IF NOT EXISTS idx_policy_native_intent_reconciliation_states_retry'
        );
        expect(reconciliationLifecycleMigrationSql).toContain(
            'CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_holds'
        );
        expect(reconciliationLifecycleMigrationSql).toContain(
            'CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_restore_gates'
        );
        expect(reconciliationControlMigrationSql).toContain(
            'CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_controls'
        );
        expect(reconciliationControlMigrationSql).toContain(
            'CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_control_events'
        );
        expect(reconciliationControlMigrationSql).toContain(
            'CREATE INDEX IF NOT EXISTS idx_policy_native_intent_reconciliation_control_events_occurred'
        );
        expect(reconciliationControlMigrationSql).toContain(
            "VALUES (1, TRUE, 'closed', 'none')"
        );
        expect(reconciliationControls).toContain(
            "automation_enabled boolean DEFAULT true"
        );
        expect(reconciliationControls).toContain(
            "circuit_state character varying(32) DEFAULT 'closed'::character varying"
        );
        expect(reconciliationControls).toContain(
            "recovery_requirement character varying(40) DEFAULT 'none'::character varying"
        );
        expect(reconciliationControls).toContain(
            'policy_native_intent_reconciliation_controls_circuit_shape_chk'
        );
        expect(reconciliationControls).toContain(
            'policy_native_intent_reconciliation_controls_disabled_shape_chk'
        );
        expect(reconciliationControlEvents).toContain(
            'event_type character varying(50)'
        );
        expect(reconciliationControlEvents).toContain(
            'reason_id character varying(80)'
        );
        expect(reconciliationControlEvents).toContain(
            'actor_id integer'
        );
        expect(reconciliationControlEvents).toContain(
            'policy_native_intent_reconciliation_control_events_actor_shape_'
        );
        expect(schemaSql).toContain('CREATE UNIQUE INDEX idx_policy_intents_one_active_policy');
        expect(schemaSql).not.toContain('CREATE UNIQUE INDEX idx_policy_intents_active_version');
        expect(schemaSql).toContain('CREATE INDEX idx_policy_intent_rules_values_gin');
        expect(schemaSql).toContain('CREATE INDEX idx_policy_intent_migration_events_state');
        expect(schemaSql).toContain("'rollback_snapshot_payload_redacted'");
        expect(schemaSql).toContain('CREATE INDEX idx_policy_intent_validation_status_lookup');
        expect(schemaSql).toContain('CREATE INDEX idx_policy_native_intent_reconciliation_runs_finished');
        expect(schemaSql).toContain('CREATE INDEX idx_policy_native_intent_reconciliation_outcomes_policy');
        expect(schemaSql).toContain('CREATE INDEX idx_policy_native_intent_reconciliation_states_retry');
        expect(schemaSql).toContain('CREATE INDEX idx_policy_native_intent_reconciliation_states_outcome');
        expect(schemaSql).toContain('CREATE INDEX idx_policy_native_intent_reconciliation_holds_active');
        expect(schemaSql).toContain(
            'CREATE INDEX idx_policy_native_intent_reconciliation_control_events_occurred'
        );
    });

    test('current.sql includes the library rebuild rollback execution and replacement gates', () => {
        const schemaSql = readSchemaSnapshot();
        const snapshotMigrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260712_120000_add_policy_library_rebuild_execution_gates.sql'
        );
        const replacementMigrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260712_130000_add_policy_library_rebuild_replacement_references.sql'
        );
        const snapshotMigrationSql = fs.readFileSync(snapshotMigrationPath, 'utf8');
        const replacementMigrationSql = fs.readFileSync(replacementMigrationPath, 'utf8');
        const executionGates = getCreateTableBlock(
            schemaSql,
            'policy_library_rebuild_execution_gates'
        );
        const policyIntentMigrationEvents = getCreateTableBlock(
            schemaSql,
            'policy_intent_migration_events'
        );

        [
            'CREATE TABLE IF NOT EXISTS policy_library_rebuild_execution_gates',
            'idx_policy_library_rebuild_execution_gates_idempotency',
            'idx_policy_library_rebuild_execution_gates_transition',
            'idx_policy_library_rebuild_execution_gates_active_policy',
            'idx_policy_library_rebuild_execution_gates_snapshot',
        ].forEach(expectedSnippet => {
            expect(snapshotMigrationSql).toContain(expectedSnippet);
        });

        [
            'replacement_intent_id BIGINT',
            'replacement_event_id BIGINT',
            'replacement_applied_at TIMESTAMPTZ',
            'policy_library_rebuild_execution_gates_replacement_applied_chk',
            'idx_policy_library_rebuild_execution_gates_replacement_intent',
            'library_rebuild_replacement_applied',
        ].forEach(expectedSnippet => {
            expect(replacementMigrationSql).toContain(expectedSnippet);
        });

        expect(executionGates).toContain('idempotency_key character varying(160) NOT NULL');
        expect(executionGates).toMatch(
            /transition_fingerprint character varying\(64\).*NOT NULL/
        );
        expect(executionGates).toContain('rollback_snapshot_id bigint');
        expect(executionGates).toContain('migration_event_id bigint');
        expect(executionGates).toContain('replacement_intent_id bigint');
        expect(executionGates).toContain('replacement_event_id bigint');
        expect(executionGates).toContain('replacement_applied_at timestamp with time zone');
        expect(executionGates).toContain('policy_library_rebuild_execution_gates_persisted_snapshot_chk');
        expect(executionGates).toContain('policy_library_rebuild_execution_gates_replacement_applied_chk');
        expect(schemaSql).toContain('CREATE UNIQUE INDEX idx_policy_library_rebuild_execution_gates_idempotency');
        expect(schemaSql).toContain('CREATE UNIQUE INDEX idx_policy_library_rebuild_execution_gates_active_policy');
        expect(schemaSql).toContain('CREATE INDEX idx_policy_library_rebuild_execution_gates_replacement_intent');
        expect(policyIntentMigrationEvents).toContain('library_rebuild_replacement_applied');
    });

    test('pg_stat_statements is optional in both the schema snapshot and migration path', () => {
        const schemaSql = readSchemaSnapshot();
        const originalMigrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260305_200000_enable_pg_stat_statements.sql'
        );
        const reconcileMigrationPath = path.resolve(
            __dirname,
            '../../../database/migrations/20260516_183500_reconcile_pg_stat_statements_state.sql'
        );
        const migrationSql = fs.readFileSync(originalMigrationPath, 'utf8');
        const reconcileMigrationSql = fs.readFileSync(reconcileMigrationPath, 'utf8');

        [
            'pg_available_extensions',
            "shared_preload_libraries",
            'Skipping pg_stat_statements extension install because the runtime is unavailable or not preloaded.'
        ].forEach(expectedSnippet => {
            expect(schemaSql).toContain(expectedSnippet);
            expect(migrationSql).toContain(expectedSnippet);
        });

        [
            'Applied versioned migrations should be treated as immutable',
            'pg_available_extensions',
            "shared_preload_libraries",
            'Skipping pg_stat_statements reconciliation because the runtime is unavailable or not preloaded.'
        ].forEach(expectedSnippet => {
            expect(reconcileMigrationSql).toContain(expectedSnippet);
        });
    });

    test('current.sql keeps a single canonical schema_migrations definition without orphan helper sequences', () => {
        const schemaSql = readSchemaSnapshot();

        expect(schemaSql).toContain('CREATE TABLE public.schema_migrations (');
        expect(schemaSql).toContain('migration_type character varying(50) DEFAULT \'sql\'::character varying');
        expect(schemaSql).toContain('description text');
        expect(schemaSql).toContain('CREATE SEQUENCE public.schema_migrations_id_seq');
        expect(schemaSql).not.toContain('CREATE SEQUENCE public.schema_migrations_id_seq1');
        expect(schemaSql).not.toContain('CREATE SEQUENCE public.schema_migrations_id_seq2');
        expect(schemaSql).not.toContain('CREATE SEQUENCE public.schema_migrations_new_id_seq');
        expect(schemaSql).not.toContain('ALTER SEQUENCE public.schema_migrations_id_seq1');
        expect(schemaSql).not.toContain('ALTER SEQUENCE public.schema_migrations_id_seq2');
    });
});
