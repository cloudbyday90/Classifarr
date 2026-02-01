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
 * Generates database/schema/current.sql from current database state
 * Run this after merging any new migration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_NAME = process.env.DB_NAME || 'classifarr_db';
const OUTPUT_PATH = path.join(__dirname, '../database/schema/current.sql');

console.log('📦 Dumping current database schema...');

try {
  // Dump schema-only (no data)
  const schema = execSync(`pg_dump --schema-only ${DB_NAME}`, {
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
