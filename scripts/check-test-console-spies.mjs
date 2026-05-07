/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import fs from 'node:fs';
import path from 'node:path';

const __dirname = import.meta.dirname;

const rootDir = path.resolve(__dirname, '..');
const testsRoot = path.join(rootDir, 'server', 'src', '__tests__');
const allowList = new Set([
  path.join(testsRoot, 'setup', 'consoleHelpers.js')
]);
const pattern = /jest\s*\.\s*spyOn\s*\(\s*console\b/;

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

const candidates = walk(testsRoot).filter(file => file.endsWith('.js'));
const violations = [];

for (const file of candidates) {
  if (allowList.has(file)) {
    continue;
  }

  const contents = fs.readFileSync(file, 'utf8');
  if (pattern.test(contents)) {
    violations.push(path.relative(rootDir, file));
  }
}

if (violations.length > 0) {
  console.error('Direct jest.spyOn(console, ...) usage is not allowed in tests.');
  console.error('Use consoleHelpers instead: server/src/__tests__/setup/consoleHelpers.js');
  console.error('Violations:');
  violations.forEach(file => console.error(`- ${file}`));
  process.exit(1);
}

console.log('Console spy check passed.');