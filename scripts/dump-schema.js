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
 *   - pg_dump must be available in PATH
 *   - DB_NAME environment variable (defaults to 'classifarr_db')
 * 
 * OUTPUT:
 *   database/schema/current.sql (commit this to git)
 * 
 * TROUBLESHOOTING:
 *   - "pg_dump: error: connection failed": Check database is running
 *   - "permission denied": Ensure database user has schema read access
 *   - "database does not exist": Set DB_NAME environment variable
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_NAME = process.env.DB_NAME || 'classifarr_db';
const OUTPUT_PATH = path.join(__dirname, '../database/schema/current.sql');

// Validate DB_NAME to prevent shell injection
const DB_NAME_PATTERN = /^[A-Za-z0-9_\-]+$/;
if (!DB_NAME_PATTERN.test(DB_NAME)) {
  console.error('❌ Invalid DB_NAME. Only letters, numbers, underscores, and hyphens are allowed.');
  process.exit(1);
}

console.log('📦 Dumping current database schema...');

try {
  // Dump schema-only (no data) using execFileSync for security
  const schema = execFileSync('pg_dump', ['--schema-only', DB_NAME], {
    encoding: 'utf8'
  });
  
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

-- Mark all migrations as applied (prevents re-running)
INSERT INTO schema_migrations (filename, applied_at)
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
  
  console.log('✅ Schema dumped to:', OUTPUT_PATH);
  console.log('📊 Includes migrations through:', latestMigration);
} catch (error) {
  console.error('❌ Schema dump failed:', error.message);
  process.exit(1);
}
