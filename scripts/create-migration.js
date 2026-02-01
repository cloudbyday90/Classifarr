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
 * Generates a new timestamp-based migration file
 * Usage: npm run migration:create "add user preferences"
 */

const fs = require('fs');
const path = require('path');

const description = process.argv[2];

if (!description) {
  console.error('❌ Error: Migration description required');
  console.log('Usage: npm run migration:create "description of changes"');
  process.exit(1);
}

// Generate timestamp: YYYYMMDD_HHMMSS
const now = new Date();
const timestamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
  '_',
  String(now.getHours()).padStart(2, '0'),
  String(now.getMinutes()).padStart(2, '0'),
  String(now.getSeconds()).padStart(2, '0')
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
console.log('💡 After editing, run: npm run db:migrate');
