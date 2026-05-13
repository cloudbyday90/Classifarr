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

const SERVER_SRC = path.resolve(import.meta.dirname, '..').replace(/\\/g, '/');
const SERVER_PACKAGE_JSON = path.resolve(SERVER_SRC, '..', 'package.json').replace(/\\/g, '/');
const PACKAGE_JSON_IMPORT_RE = /import\s+\w+\s+from\s+['"]([^'"]*package\.json)['"]\s+with\s+\{\s*type:\s*['"]json['"]\s*\}/g;

function collectSourceFiles(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') {
        continue;
      }

      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.mjs')) {
      files.push(fullPath.replace(/\\/g, '/'));
    }
  }

  return files;
}

function relativeToServer(filePath) {
  return path.relative(SERVER_SRC, filePath).replace(/\\/g, '/');
}

const PACKAGE_METADATA_FILES = collectSourceFiles(SERVER_SRC).filter((filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  return PACKAGE_JSON_IMPORT_RE.test(source);
});

describe('Native server package metadata imports', () => {
  for (const filePath of PACKAGE_METADATA_FILES) {
    test(`${relativeToServer(filePath)} resolves package.json imports inside server/package.json`, () => {
      const source = fs.readFileSync(filePath, 'utf8');
      const imports = [...source.matchAll(PACKAGE_JSON_IMPORT_RE)];

      for (const [, specifier] of imports) {
        const resolvedPath = path.resolve(path.dirname(filePath), specifier).replace(/\\/g, '/');

        expect(resolvedPath).toBe(SERVER_PACKAGE_JSON);
      }
    });
  }
});