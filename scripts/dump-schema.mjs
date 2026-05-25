#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ============================================================================
 * Schema Snapshot Generator
 * ============================================================================
 * 
 * PURPOSE:
 *   Creates a complete database schema snapshot for fast fresh installations.
 *   Instead of running 76+ migrations sequentially (~7.6s), fresh installs
 *   can load one SQL file (~0.6s) - a 13x performance improvement!
 * 
 * WHEN TO RUN:
 *   - After merging any new migration to main branch
 *   - Before releasing a new version
 *   - When onboarding new developers (ensures fresh install works)
 * 
 * HOW IT WORKS:
 *   1. Dumps current database schema (tables, indexes, constraints)
 *   2. Generates INSERT statements to mark all migrations as applied
 *   3. Saves to database/schema/current.sql
 *   4. Fresh installs detect empty DB and load this file instead of migrations
 * 
 * USAGE:
 *   npm run db:dump-schema
 * 
 * REQUIREMENTS:
 *   - PostgreSQL database must be running
 *   - Preferred: a running `classifarr` Docker Compose service so the snapshot
 *     uses a matching PostgreSQL 18 client from the container
 *   - Fallback: host pg_dump in PATH
 *   - Optional DB env vars: DB_NAME/DB_HOST/DB_PORT/DB_USER/DB_PASSWORD
 *     (fallbacks to POSTGRES_* vars, then runtime-safe defaults)
 * 
 * OUTPUT:
 *   database/schema/current.sql (commit this to git)
 * 
 * TROUBLESHOOTING:
 *   - "pg_dump: error: connection failed": Check database is running
 *   - "Host pg_dump not found": start the Classifarr container or install pg_dump
 *   - "server version mismatch": use the containerized PG18 client or install pg_dump 18
 *   - "permission denied": Ensure database user has schema read access
 *   - "database does not exist": Set DB_NAME environment variable
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import * as path from 'node:path';
import { dirname, join, resolve } from 'node:path';

export const PROJECT_POSTGRES_MAJOR = 18;
const DEFAULT_DB_NAME = 'classifarr';
const DEFAULT_DB_HOST = 'localhost';
const DEFAULT_DB_PORT = '5432';
const DEFAULT_DB_USER = 'classifarr';
const DEFAULT_DB_PASSWORD = 'classifarr_secret';
export const OUTPUT_PATH = join(import.meta.dirname, '../database/schema/current.sql');
export const MIGRATIONS_DIR = join(import.meta.dirname, '../database/migrations');
export const SEED_RECONCILIATION_MARKER = '@seed-reconciliation snapshot-required';
export const SEED_MIGRATIONS = [
  '005_add_require_all_confirmations_setting.sql',
  '006_add_clarification_settings.sql',
  '019_cleanup_omdb_config.sql',
  '043_seed_content_presets.sql',
  '044_expand_content_presets.sql',
  '046_event_detection_presets.sql',
  '20260201_010000_add_discord_display_options.sql',
  '20260226_002000_seed_runtime_security_defaults.sql',
  '20260309_140000_task_queue_retention.sql',
  '20260514_121500_normalize_task_queue_retention_setting.sql',
  '20260514_161500_add_task_queue_status_retention_settings.sql',
  '20260517_235500_reconcile_clarification_seed_data.sql',
  '20260518_011500_reconcile_bootstrap_sensitive_seed_data.sql',
  '20260518_013000_reconcile_low_priority_seed_data.sql',
];

export function getDumpConfig(env = process.env) {
  return {
    dbName: env.DB_NAME || env.POSTGRES_DB || DEFAULT_DB_NAME,
    dbHost: env.DB_HOST || env.POSTGRES_HOST || DEFAULT_DB_HOST,
    dbPort: env.DB_PORT || env.POSTGRES_PORT || DEFAULT_DB_PORT,
    dbUser: env.DB_USER || env.POSTGRES_USER || DEFAULT_DB_USER,
    dbPassword: env.DB_PASSWORD || env.POSTGRES_PASSWORD || DEFAULT_DB_PASSWORD,
    dumpContainer: env.DUMP_CONTAINER?.trim() || '',
    preferContainerPgDump: env.PREFER_CONTAINER_PG_DUMP !== 'false',
  };
}

export function validateDbName(dbName) {
  const dbNamePattern = /^[A-Za-z0-9_\-]+$/;
  return dbNamePattern.test(dbName);
}

export function parsePostgresMajorVersion(versionOutput) {
  const match = String(versionOutput).match(/PostgreSQL\)\s+(\d+)(?:\.\d+)?/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function shouldQuoteAllIdentifiers(pgDumpMajorVersion, expectedMajor = PROJECT_POSTGRES_MAJOR) {
  return Number.isInteger(pgDumpMajorVersion) && pgDumpMajorVersion !== expectedMajor;
}

export function buildPgDumpArgs({ host, port, user, dbName, quoteAllIdentifiers = false }) {
  const args = [
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    '--host',
    String(host),
    '--port',
    String(port),
    '--username',
    String(user),
    '--dbname',
    String(dbName)
  ];
  if (quoteAllIdentifiers) {
    args.push('--quote-all-identifiers');
  }
  return args;
}

export function normalizeSnapshotForComparison(snapshotSql) {
  return String(snapshotSql)
    .replace(/\r\n/g, '\n')
    .replace(/^-- Generated: .*\n/m, '-- Generated: <normalized>\n');
}

function shouldStripSchemaMigrationsDumpSection(section) {
  const headerMatch = section.match(/^--\n-- Name: ([^;]+); Type: [^;]+; Schema: public; Owner: -\n--\n/m);
  if (!headerMatch) {
    return false;
  }

  const name = headerMatch[1].trim();
  if (name.startsWith('idx_schema_migrations_')) {
    return true;
  }

  return /(^|[^A-Za-z0-9])schema_migrations(?:$|[^A-Za-z0-9]|_)/.test(name);
}

export function stripSchemaMigrationsDumpArtifacts(schemaSql) {
  return String(schemaSql)
    .split(/(?=--\n-- Name: )/)
    .filter(section => !shouldStripSchemaMigrationsDumpSection(section))
    .join('');
}

export function buildSchemaMigrationsTrackingSql() {
  return `-- Migration tracking table
CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    applied_at timestamp without time zone DEFAULT now(),
    migration_type character varying(50) DEFAULT 'sql'::character varying,
    description text,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY (id),
    CONSTRAINT schema_migrations_filename_key UNIQUE (filename)
);

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;
ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);
CREATE INDEX idx_schema_migrations_applied ON public.schema_migrations USING btree (applied_at DESC);
CREATE INDEX idx_schema_migrations_type ON public.schema_migrations USING btree (migration_type);
COMMENT ON TABLE public.schema_migrations IS 'Tracks applied database migrations. Supports both legacy numeric (001_name.sql) and timestamp-based (20260201_150000_name.sql) formats.';
`;
}

export function isDeclaredSeedReconciliationMigration(sql) {
  return String(sql).includes(SEED_RECONCILIATION_MARKER);
}

export function findDeclaredSeedReconciliationMigrations({
  fileSystem = fs,
  migrationsDir = MIGRATIONS_DIR,
} = {}) {
  return fileSystem.readdirSync(migrationsDir)
    .filter(filename => filename.endsWith('.sql'))
    .filter((filename) => {
      const filepath = path.join(migrationsDir, filename);
      const sql = fileSystem.readFileSync(filepath, 'utf8');
      return isDeclaredSeedReconciliationMigration(sql);
    })
    .sort(compareMigrationsLikeFilenames);
}

export function getMissingDeclaredSeedMigrations({
  declaredSeedMigrations,
  seedMigrations = SEED_MIGRATIONS,
} = {}) {
  const seedSet = new Set(seedMigrations);
  return declaredSeedMigrations.filter(filename => !seedSet.has(filename));
}

export function assertSeedMigrationCoverage({
  fileSystem = fs,
  migrationsDir = MIGRATIONS_DIR,
  seedMigrations = SEED_MIGRATIONS,
} = {}) {
  const declaredSeedMigrations = findDeclaredSeedReconciliationMigrations({
    fileSystem,
    migrationsDir,
  });
  const missingSeedMigrations = getMissingDeclaredSeedMigrations({
    declaredSeedMigrations,
    seedMigrations,
  });

  if (missingSeedMigrations.length > 0) {
    throw new Error(
      `SEED_MIGRATIONS is missing declared seed reconciliation migration(s): ${missingSeedMigrations.join(', ')}`
    );
  }

  return declaredSeedMigrations;
}

function compareMigrationsLikeFilenames(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

export function listRunningComposeServices(execFileSyncImpl = execFileSync) {
  const output = execFileSyncImpl('docker', ['compose', 'ps', '--status', 'running', '--services'], {
    encoding: 'utf8'
  });
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

export function choosePgDumpSource({
  env = process.env,
  execFileSyncImpl = execFileSync,
} = {}) {
  const config = getDumpConfig(env);
  if (config.dumpContainer) {
    return {
      type: 'docker-exec',
      containerName: config.dumpContainer,
      reason: 'DUMP_CONTAINER was provided',
    };
  }

  if (config.preferContainerPgDump) {
    try {
      const services = listRunningComposeServices(execFileSyncImpl);
      if (services.includes('classifarr')) {
        return {
          type: 'docker-compose',
          reason: 'running classifarr compose service detected',
        };
      }
    } catch {
      // Ignore Docker detection failures and fall back to host tooling.
    }
  }

  return {
    type: 'host',
    reason: 'no preferred containerized pg_dump source detected',
  };
}

export function isPgDumpVersionMismatchError(error) {
  const message = String(error?.message || '');
  return (
    message.includes('server version mismatch') ||
    message.includes('aborting because of server version mismatch') ||
    (message.includes('server version:') && message.includes('pg_dump version:'))
  );
}

export function getHostPgDumpMajorVersion(execFileSyncImpl = execFileSync) {
  const versionOutput = execFileSyncImpl('pg_dump', ['--version'], {
    encoding: 'utf8',
  });
  return parsePostgresMajorVersion(versionOutput);
}

function runHostPgDump({
  config,
  execFileSyncImpl = execFileSync,
  quoteAllIdentifiers = false,
}) {
  return execFileSyncImpl('pg_dump', buildPgDumpArgs({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    dbName: config.dbName,
    quoteAllIdentifiers,
  }), {
    encoding: 'utf8',
    env: {
      ...process.env,
      PGPASSWORD: config.dbPassword
    }
  });
}

function runDockerPgDump({
  config,
  execFileSyncImpl = execFileSync,
}) {
  return execFileSyncImpl('docker', [
    'compose',
    'exec',
    '-T',
    'classifarr',
    'env',
    `PGPASSWORD=${config.dbPassword}`,
    'pg_dump',
    ...buildPgDumpArgs({
      host: DEFAULT_DB_HOST,
      port: DEFAULT_DB_PORT,
      user: config.dbUser,
      dbName: config.dbName,
    })
  ], {
    encoding: 'utf8'
  });
}

function runDockerContainerPgDump({
  containerName,
  config,
  execFileSyncImpl = execFileSync,
}) {
  return execFileSyncImpl('docker', [
    'exec',
    '-i',
    containerName,
    'env',
    `PGPASSWORD=${config.dbPassword}`,
    'pg_dump',
    ...buildPgDumpArgs({
      host: DEFAULT_DB_HOST,
      port: DEFAULT_DB_PORT,
      user: config.dbUser,
      dbName: config.dbName
    })
  ], {
    encoding: 'utf8'
  });
}

function makePgStatStatementsOptional(schemaSql) {
  const pgStatStatementsBlockPattern = /--\s*\n-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -\n--\s*\n\nCREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;\n\n\n--\s*\n-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -\n--\s*\n\nCOMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';/;

  const replacement = `--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

DO $$
DECLARE
    preload_setting text;
BEGIN
    SELECT setting INTO preload_setting
    FROM pg_settings
    WHERE name = 'shared_preload_libraries';

    IF EXISTS (
        SELECT 1
        FROM pg_available_extensions
        WHERE name = 'pg_stat_statements'
    ) AND position('pg_stat_statements' IN COALESCE(preload_setting, '')) > 0 THEN
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;
        COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';
    ELSE
        RAISE NOTICE 'Skipping pg_stat_statements extension install because the runtime is unavailable or not preloaded.';
    END IF;
END $$;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--`;

  return schemaSql.replace(pgStatStatementsBlockPattern, () => replacement);
}

export function dumpSchema({
  env = process.env,
  execFileSyncImpl = execFileSync,
  fileSystem = fs,
  log = console,
} = {}) {
  const config = getDumpConfig(env);
  if (!validateDbName(config.dbName)) {
    throw new Error('Invalid DB_NAME. Only letters, numbers, underscores, and hyphens are allowed.');
  }

  log.log('📦 Dumping current database schema...');

  // Dump schema-only (no data) using execFileSync for security.
  // Prefer a matching PostgreSQL 18 client from the running container when available.
  let schemaRaw;
  const dumpSource = choosePgDumpSource({ env, execFileSyncImpl });

  if (dumpSource.type === 'docker-exec') {
    log.log(`ℹ️ Using docker exec ${dumpSource.containerName} pg_dump (preferred matching PostgreSQL ${PROJECT_POSTGRES_MAJOR} client)...`);
    schemaRaw = runDockerContainerPgDump({
      containerName: dumpSource.containerName,
      config,
      execFileSyncImpl,
    });
  } else if (dumpSource.type === 'docker-compose') {
    log.log(`ℹ️ Using docker compose exec classifarr pg_dump (${dumpSource.reason})...`);
    try {
      schemaRaw = runDockerPgDump({ config, execFileSyncImpl });
    } catch (error) {
      log.warn('⚠️ Containerized pg_dump failed, retrying with host pg_dump...', error.message);
      schemaRaw = null;
    }
  }

  if (schemaRaw == null) {
    let hostPgDumpMajorVersion = null;
    try {
      hostPgDumpMajorVersion = getHostPgDumpMajorVersion(execFileSyncImpl);
    } catch (error) {
      const missingHostBinary = error?.code === 'ENOENT' || String(error?.message || '').includes('ENOENT');
      if (missingHostBinary) {
        throw new Error('Host pg_dump not found and no containerized pg_dump source is available.');
      }
      throw error;
    }

    const quoteAllIdentifiers = shouldQuoteAllIdentifiers(hostPgDumpMajorVersion);
    if (quoteAllIdentifiers) {
      log.log(
        `ℹ️ Host pg_dump major version ${hostPgDumpMajorVersion} differs from embedded PostgreSQL ${PROJECT_POSTGRES_MAJOR}; using --quote-all-identifiers per PostgreSQL guidance.`
      );
    }

    try {
      schemaRaw = runHostPgDump({
        config,
        execFileSyncImpl,
        quoteAllIdentifiers,
      });
    } catch (error) {
      if (isPgDumpVersionMismatchError(error)) {
        throw new Error(
          `Host pg_dump is incompatible with the target server version. Install PostgreSQL ${PROJECT_POSTGRES_MAJOR} client tools or run the classifarr container so the snapshot can use a matching pg_dump.`
        );
      }
      throw error;
    }
  }

  // pg_dump from newer PostgreSQL versions can emit psql-only meta commands
  // (for example \restrict / \unrestrict) that are invalid through node-postgres.
  const schema = stripSchemaMigrationsDumpArtifacts(
    makePgStatStatementsOptional(
      schemaRaw
        .split('\n')
        .filter(line => !line.trim().startsWith('\\'))
        .join('\n')
    )
  );
  
  // Get latest migration version
  const migrationsDir = MIGRATIONS_DIR;
  assertSeedMigrationCoverage({
    fileSystem,
    migrationsDir,
    seedMigrations: SEED_MIGRATIONS,
  });
  const latestMigration = fileSystem.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .pop();
  
  const migrationFiles = fileSystem.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .map(f => `'${f}'`)
    .join(',\n    ');
  
  const schemaFile = `-- Classifarr Database Schema Snapshot
-- Generated: ${new Date().toISOString()}
-- Latest Migration: ${latestMigration}
-- 
-- ⚠️  FOR FRESH INSTALLS ONLY
-- ⚠️  Existing installations should use migrations/
-- 
-- This file represents the complete database state after all migrations.

${schema}

${buildSchemaMigrationsTrackingSql()}

-- Mark all migrations as applied (prevents re-running)
SELECT pg_catalog.set_config('search_path', 'public', false);
INSERT INTO public.schema_migrations (filename, applied_at)
SELECT 
  filename,
  NOW()
FROM unnest(ARRAY[
    ${migrationFiles}
]) AS filename
ON CONFLICT (filename) DO NOTHING;
`;
  
  // ── Splice seed data from data-only migrations ─────────────────────────────
  // pg_dump --schema-only omits INSERT statements from migrations. Any migration
  // that only seeds data (no DDL) must be re-applied explicitly so fresh installs
  // have all required default settings, content presets, etc.
  const seedParts = [
    '',
    '-- ============================================================',
    '-- Seed Data (from data-only migrations, auto-appended by scripts/dump-schema.mjs)',
    '-- These INSERT statements are idempotent (ON CONFLICT DO NOTHING / DO UPDATE).',
    '-- ============================================================',
    '',
    // pg_dump sets search_path='' so unqualified table names in seed migrations
    // would fail without this reset.
    "SELECT pg_catalog.set_config('search_path', 'public', false);",
    '',
  ];

  for (const filename of SEED_MIGRATIONS) {
    const filepath = path.join(migrationsDir, filename);
    if (!fileSystem.existsSync(filepath)) {
      log.warn('⚠️  Seed migration not found, skipping:', filename);
      continue;
    }
    let sql = fileSystem.readFileSync(filepath, 'utf8').replace(/^\uFEFF/, '');
    // Strip standalone BEGIN/COMMIT/ROLLBACK and DO $$ ... END $$; verification blocks
    sql = sql
      .replace(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;.*$/gm, '')
      .replace(/^DO\s+\$\$[\s\S]*?END\s+\$\$\s*;/gm, '');
    seedParts.push(`-- === Seed: ${filename} ===`);
    seedParts.push(sql.trim());
    seedParts.push('');
  }

  const SEED_ANCHOR = '-- Mark all migrations as applied (prevents re-running)';
  const anchorIndex = schemaFile.indexOf(SEED_ANCHOR);
  if (anchorIndex === -1) {
    throw new Error(`Seed anchor not found in schema snapshot: ${SEED_ANCHOR}`);
  }
  const finalSnapshot =
    schemaFile.slice(0, anchorIndex) +
    seedParts.join('\n') +
    '\n' +
    schemaFile.slice(anchorIndex);

  let existingSnapshot = null;
  if (fileSystem.existsSync(OUTPUT_PATH)) {
    existingSnapshot = fileSystem.readFileSync(OUTPUT_PATH, 'utf8');
  }

  const existingNormalized = existingSnapshot == null ? null : normalizeSnapshotForComparison(existingSnapshot);
  const finalNormalized = normalizeSnapshotForComparison(finalSnapshot);
  const lfSnapshot = finalSnapshot.replace(/\r\n/g, '\n');

  if (existingNormalized !== finalNormalized || (existingSnapshot !== null && existingSnapshot.includes('\r\n'))) {
    fileSystem.mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    fileSystem.writeFileSync(OUTPUT_PATH, lfSnapshot);
  }

  log.log('✅ Schema dumped to:', OUTPUT_PATH);
  log.log('📊 Includes migrations through:', latestMigration);
  log.log('🌱 Seed data included from', SEED_MIGRATIONS.length, 'data-only migrations');
}

function main() {
  try {
    dumpSchema();
  } catch (error) {
    console.error('❌ Schema dump failed:', error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
