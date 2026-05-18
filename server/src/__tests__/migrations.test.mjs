/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createMigrationRunner, getMigrationSortKey, compareMigrations } from '../config/migrations.mjs';

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
