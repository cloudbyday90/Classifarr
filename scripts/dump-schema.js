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
 *   - Host pg_dump in PATH OR a running `classifarr` Docker Compose service
 *   - Optional DB env vars: DB_NAME/DB_HOST/DB_PORT/DB_USER/DB_PASSWORD
 *     (fallbacks to POSTGRES_* vars, then runtime-safe defaults)
 * 
 * OUTPUT:
 *   database/schema/current.sql (commit this to git)
 * 
 * TROUBLESHOOTING:
 *   - "pg_dump: error: connection failed": Check database is running
 *   - "Host pg_dump not found": script will retry with `docker compose exec classifarr pg_dump`
 *   - "permission denied": Ensure database user has schema read access
 *   - "database does not exist": Set DB_NAME environment variable
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_NAME = process.env.DB_NAME || process.env.POSTGRES_DB || 'classifarr';
const DB_HOST = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || process.env.POSTGRES_PORT || '5432';
const DB_USER = process.env.DB_USER || process.env.POSTGRES_USER || 'classifarr';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'classifarr_secret';
const OUTPUT_PATH = path.join(__dirname, '../database/schema/current.sql');

// Validate DB_NAME to prevent shell injection
const DB_NAME_PATTERN = /^[A-Za-z0-9_\-]+$/;
if (!DB_NAME_PATTERN.test(DB_NAME)) {
  console.error('❌ Invalid DB_NAME. Only letters, numbers, underscores, and hyphens are allowed.');
  process.exit(1);
}

function buildPgDumpArgs({ host, port, user, dbName }) {
  return [
    '--schema-only',
    '--exclude-table=schema_migrations',
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
}

function runHostPgDump() {
  return execFileSync('pg_dump', buildPgDumpArgs({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    dbName: DB_NAME
  }), {
    encoding: 'utf8',
    env: {
      ...process.env,
      PGPASSWORD: DB_PASSWORD
    }
  });
}

function runDockerPgDumpFallback() {
  return execFileSync('docker', [
    'compose',
    'exec',
    '-T',
    'classifarr',
    'env',
    `PGPASSWORD=${DB_PASSWORD}`,
    'pg_dump',
    ...buildPgDumpArgs({
      host: 'localhost',
      port: '5432',
      user: DB_USER,
      dbName: DB_NAME
    })
  ], {
    encoding: 'utf8'
  });
}

console.log('📦 Dumping current database schema...');

try {
  // Dump schema-only (no data) using execFileSync for security.
  // Fallback to containerized pg_dump when host binary is not installed.
  let schemaRaw;
  try {
    schemaRaw = runHostPgDump();
  } catch (error) {
    const missingHostBinary = error?.code === 'ENOENT' || String(error?.message || '').includes('ENOENT');
    if (!missingHostBinary) {
      throw error;
    }
    console.log('ℹ️ Host pg_dump not found; retrying via docker compose exec classifarr...');
    schemaRaw = runDockerPgDumpFallback();
  }
  // pg_dump from newer PostgreSQL versions can emit psql-only meta commands
  // (for example \restrict / \unrestrict) that are invalid through node-postgres.
  const schema = schemaRaw
    .split('\n')
    .filter(line => !line.trim().startsWith('\\'))
    .join('\n');
  
  // Get latest migration version
  const migrationsDir = path.join(__dirname, '../database/migrations');
  const latestMigration = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .pop();
  
  const migrationFiles = fs.readdirSync(migrationsDir)
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

-- Migration tracking table
-- (excluded via --exclude-table=schema_migrations but required for tracking)
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);

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
  
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, schemaFile);

  // ── Splice seed data from data-only migrations ─────────────────────────────
  // pg_dump --schema-only omits INSERT statements from migrations. Any migration
  // that only seeds data (no DDL) must be re-applied explicitly so fresh installs
  // have all required default settings, content presets, etc.
  const SEED_MIGRATIONS = [
    '005_add_require_all_confirmations_setting.sql',
    '006_add_clarification_settings.sql',
    '019_cleanup_omdb_config.sql',
    '043_seed_content_presets.sql',
    '044_expand_content_presets.sql',
    '046_event_detection_presets.sql',
    '20260201_010000_add_discord_display_options.sql',
    '20260226_002000_seed_runtime_security_defaults.sql',
  ];

  const seedParts = [
    '',
    '-- ============================================================',
    '-- Seed Data (from data-only migrations, auto-appended by scripts/dump-schema.js)',
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
    if (!fs.existsSync(filepath)) {
      console.warn('⚠️  Seed migration not found, skipping:', filename);
      continue;
    }
    let sql = fs.readFileSync(filepath, 'utf8').replace(/^\uFEFF/, '');
    // Strip standalone BEGIN/COMMIT/ROLLBACK and DO $$ ... END $$; verification blocks
    sql = sql
      .replace(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;.*$/gm, '')
      .replace(/^DO\s+\$\$[\s\S]*?END\s+\$\$\s*;/gm, '');
    seedParts.push(`-- === Seed: ${filename} ===`);
    seedParts.push(sql.trim());
    seedParts.push('');
  }

  const SEED_ANCHOR = '-- Mark all migrations as applied (prevents re-running)';
  let snapshot = fs.readFileSync(OUTPUT_PATH, 'utf8');
  snapshot = snapshot.replace(SEED_ANCHOR, seedParts.join('\n') + '\n' + SEED_ANCHOR);
  fs.writeFileSync(OUTPUT_PATH, snapshot);

  console.log('✅ Schema dumped to:', OUTPUT_PATH);
  console.log('📊 Includes migrations through:', latestMigration);
  console.log('🌱 Seed data included from', SEED_MIGRATIONS.length, 'data-only migrations');
} catch (error) {
  console.error('❌ Schema dump failed:', error.message);
  process.exit(1);
}
