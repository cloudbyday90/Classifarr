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
 * Timestamp-Based Migration Generator
 * ============================================================================
 * 
 * PURPOSE:
 *   Generates new database migration files with timestamp-based naming.
 *   Prevents merge conflicts that occur with numeric migration naming.
 * 
 * BENEFITS:
 *   ✅ Unique timestamps prevent PR conflicts
 *   ✅ Infinite scalability (no 999 migration limit)
 *   ✅ Self-documenting (creation date embedded in filename)
 *   ✅ Follows industry best practices (Rails, Laravel, Django, etc.)
 * 
 * NAMING FORMAT:
 *   YYYYMMDD_HHMMSS_description.sql
 *   Example: 20260201_150322_add_user_preferences.sql
 * 
 * USAGE:
 *   npm run migration:create "description of changes"
 * 
 * WORKFLOW:
 *   1. Run: npm run migration:create "add user notifications"
 *   2. Edit the generated migration file (add your SQL)
 *   3. Test: npm --prefix server run dev
 *   4. Verify: Check database schema
 *   5. Test idempotency: Restart server (should not error)
 *   6. Update snapshot: npm run db:dump-schema
 *   7. Commit: git add database/migrations/*.sql database/schema/current.sql
 * 
 * BEST PRACTICES:
 *   - Use descriptive names: "add_user_preferences" not "update_db"
 *   - Keep migrations focused: One logical change per migration
 *   - Always use IF NOT EXISTS / IF EXISTS for idempotency
 *   - Test on both fresh AND existing databases
 *   - Never edit migrations after they're merged to main
 */

import fs from 'node:fs';
import path from 'node:path';

const __dirname = import.meta.dirname;

const description = process.argv[2];

if (!description) {
  console.error('❌ Error: Migration description required');
  console.log('Usage: npm run migration:create "description of changes"');
  process.exit(1);
}

// Generate timestamp: YYYYMMDD_HHMMSS (in UTC to avoid timezone issues)
const now = new Date();
const timestamp = [
  now.getUTCFullYear(),
  String(now.getUTCMonth() + 1).padStart(2, '0'),
  String(now.getUTCDate()).padStart(2, '0'),
  '_',
  String(now.getUTCHours()).padStart(2, '0'),
  String(now.getUTCMinutes()).padStart(2, '0'),
  String(now.getUTCSeconds()).padStart(2, '0')
].join('');

// Generate filename
const slug = description
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

const filename = `${timestamp}_${slug}.sql`;
const filepath = path.join(__dirname, '../database/migrations', filename);

// Migration template
const template = `-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: ${description}
-- Created: ${now.toISOString()}
-- ═══════════════════════════════════════════════════════════════════════════

-- TODO: Add your migration SQL here

-- Example: Create table
-- CREATE TABLE IF NOT EXISTS my_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT NOW()
-- );

-- Example: Add column
-- ALTER TABLE existing_table 
-- ADD COLUMN IF NOT EXISTS new_column VARCHAR(100);

-- Example: Create index
-- CREATE INDEX IF NOT EXISTS idx_table_column 
-- ON my_table(column_name);
`;

fs.writeFileSync(filepath, template);

console.log('✅ Migration created:', filename);
console.log('📝 Edit:', filepath);
console.log('');
console.log('📚 Migration Best Practices:');
console.log('  1. Use IF NOT EXISTS / IF EXISTS for idempotency');
console.log('  2. Preserve existing data when modifying tables');
console.log('  3. Test on both fresh and existing databases');
console.log('  4. Run twice to verify idempotency');
console.log('');
console.log('💡 After editing, start the dev server to apply migrations:');
console.log('    npm --prefix server run dev');
console.log('💾 Then update the schema snapshot:');
console.log('    npm run db:dump-schema');