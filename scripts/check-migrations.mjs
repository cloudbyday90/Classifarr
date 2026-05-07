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
 * Migration filename validation:
 * - Legacy numeric migrations are allowed only if listed in LEGACY_MIGRATIONS.txt
 *   or LEGACY_MIGRATIONS.md
 * - All new migrations must use timestamp format: YYYYMMDD_HHMMSS_description.sql
 */

import fs from 'node:fs';
import { join } from 'node:path';

const migrationsDir = join(import.meta.dirname, '../database/migrations');
const legacyListCandidates = [
  join(migrationsDir, 'LEGACY_MIGRATIONS.txt'),
  join(migrationsDir, 'LEGACY_MIGRATIONS.md')
];
const legacyListPath = legacyListCandidates.find(candidate => fs.existsSync(candidate));

if (!legacyListPath) {
  console.error('Missing legacy allowlist. Looked for:');
  legacyListCandidates.forEach(candidate => console.error(`  - ${candidate}`));
  process.exit(1);
}

function parseLegacyAllowlist(contents, filename) {
  const lines = contents.split(/\r?\n/).map(line => line.trim());

  if (filename.endsWith('.md')) {
    return lines
      .filter(line => /^\d{3}_.*\.sql$/.test(line));
  }

  return lines.filter(Boolean);
}

const legacyAllowlist = new Set(
  parseLegacyAllowlist(fs.readFileSync(legacyListPath, 'utf8'), legacyListPath)
);

const files = fs.readdirSync(migrationsDir)
  .filter(name => name.endsWith('.sql'));

const numericPattern = /^\d{3}_.*\.sql$/;
const timestampPattern = /^\d{8}_\d{6}_.+\.sql$/;

const unexpectedNumeric = [];
const invalidNames = [];

for (const file of files) {
  if (timestampPattern.test(file)) {
    continue;
  }
  if (numericPattern.test(file)) {
    if (!legacyAllowlist.has(file)) {
      unexpectedNumeric.push(file);
    }
    continue;
  }
  invalidNames.push(file);
}

if (unexpectedNumeric.length || invalidNames.length) {
  if (unexpectedNumeric.length) {
    console.error('New numeric migrations are not allowed:');
    unexpectedNumeric.forEach(file => console.error(`  - ${file}`));
  }
  if (invalidNames.length) {
    console.error('Invalid migration filename(s):');
    invalidNames.forEach(file => console.error(`  - ${file}`));
  }
  console.error('Use timestamped migrations: YYYYMMDD_HHMMSS_description.sql');
  process.exit(1);
}

const missingLegacy = [...legacyAllowlist].filter(name => !files.includes(name));
if (missingLegacy.length) {
  console.warn('Legacy allowlist contains missing files:');
  missingLegacy.forEach(file => console.warn(`  - ${file}`));
}

console.log('Migration naming check passed.');
