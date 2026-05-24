#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import fs from 'node:fs';

const CURRENT_YEAR = new Date().getFullYear();
const EXPECTED_PATTERN = `2024-${CURRENT_YEAR}`;
const OLD_PATTERN = /Copyright \(C\) (\d{4}|\d{4}-\d{4}) (cloudbyday90|Classifarr Contributors)/g;

const FILE_PATTERNS = [
  'server/**/*.js',
  'client/src/**/*.{js,vue}',
  'database/migrations/**/*.sql',
  'scripts/**/*.{js,mjs,cjs}'
];

const IGNORE_SEGMENTS = ['node_modules', 'dist', 'build', 'coverage'];

const isIgnored = (path) => IGNORE_SEGMENTS.some(seg => path.includes(seg));

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const firstLines = content.split('\n').slice(0, 10).join('\n');

  const match = firstLines.match(OLD_PATTERN);
  if (!match) {
    return { valid: false, reason: 'No copyright header found' };
  }

  if (!firstLines.includes(EXPECTED_PATTERN)) {
    return { valid: false, reason: `Expected ${EXPECTED_PATTERN}, found ${match[0]}` };
  }

  if (!firstLines.includes('Classifarr Contributors')) {
    return { valid: false, reason: 'Expected owner "Classifarr Contributors"' };
  }

  return { valid: true };
}

function main() {
  const files = FILE_PATTERNS.flatMap(pattern =>
    fs.globSync(pattern, { exclude: isIgnored })
  );
  const errors = [];

  files.forEach(file => {
    const result = checkFile(file);
    if (!result.valid) {
      errors.push(`${file}: ${result.reason}`);
    }
  });

  if (errors.length > 0) {
    console.error(`\n❌ Copyright compliance check FAILED\n`);
    console.error(`Found ${errors.length} file(s) with outdated/missing copyright headers:\n`);
    errors.forEach(err => console.error(`  - ${err}`));
    console.error(`\n💡 Run: npm run update-copyright\n`);
    process.exit(1);
  }

  console.log(`✅ Copyright compliance check PASSED (${files.length} files checked)`);
}

main();