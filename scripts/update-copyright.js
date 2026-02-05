#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const fs = require('fs');
const glob = require('glob');

const CURRENT_YEAR = new Date().getFullYear();
const NEW_PATTERN = `2024-${CURRENT_YEAR}`;
const OLD_OWNER = 'cloudbyday90';
const NEW_OWNER = 'Classifarr Contributors';

const FILE_PATTERNS = [
  'server/**/*.js',
  'client/src/**/*.{js,vue}',
  'database/migrations/**/*.sql',
  'scripts/**/*.js'
];

const IGNORE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/build/**'];

const PATTERNS = {
  js: /Copyright \(C\) (\d{4}|\d{4}-\d{4}) (cloudbyday90|Classifarr Contributors)/g,
  vue: /Copyright \(C\) (\d{4}|\d{4}-\d{4}) (cloudbyday90|Classifarr Contributors)/g,
  sql: /Copyright \(C\) (\d{4}|\d{4}-\d{4}) (cloudbyday90|Classifarr Contributors)/g
};

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const ext = filePath.split('.').pop();
  const pattern = PATTERNS[ext] || PATTERNS.js;
  
  const updated = content.replace(pattern, `Copyright (C) ${NEW_PATTERN} ${NEW_OWNER}`);
  
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
  }
  return false;
}

function main() {
  console.log(`\n🔄 Updating copyright headers to ${NEW_PATTERN}...\n`);
  
  const files = FILE_PATTERNS.flatMap(pattern =>
    glob.sync(pattern, { nodir: true, ignore: IGNORE_PATTERNS })
  );
  let updated = 0;
  
  files.forEach(file => {
    if (updateFile(file)) {
      console.log(`  ✓ ${file}`);
      updated++;
    }
  });
  
  console.log(`\n✅ Updated ${updated} file(s)\n`);
}

main();
