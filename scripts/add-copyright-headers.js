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
const COPYRIGHT_YEAR = `2024-${CURRENT_YEAR}`;

const FILE_PATTERNS = [
  'server/**/*.js',
  'client/src/**/*.{js,vue}',
  'database/migrations/**/*.sql',
  'scripts/**/*.js',
  '!**/node_modules/**',
  '!**/dist/**',
  '!**/build/**'
];

const HEADERS = {
  js: `/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) ${COPYRIGHT_YEAR} Classifarr Contributors
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

`,
  vue: `<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) ${COPYRIGHT_YEAR} Classifarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

`,
  sql: `-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) ${COPYRIGHT_YEAR} Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

`
};

function hasHeader(content) {
  return content.includes('Copyright (C)');
}

function addHeader(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (hasHeader(content)) {
    return false;
  }
  
  const ext = filePath.split('.').pop();
  const header = HEADERS[ext] || HEADERS.js;
  
  // Check if file starts with a shebang
  let newContent;
  if (content.startsWith('#!')) {
    // Preserve shebang on first line
    const firstLineEnd = content.indexOf('\n');
    if (firstLineEnd !== -1) {
      const shebang = content.substring(0, firstLineEnd + 1);
      const restOfContent = content.substring(firstLineEnd + 1);
      newContent = shebang + header + restOfContent;
    } else {
      // File only has shebang, no newline
      newContent = content + '\n' + header;
    }
  } else {
    newContent = header + content;
  }
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

function main() {
  console.log(`\n➕ Adding copyright headers to files without them...\n`);
  
  const files = FILE_PATTERNS.flatMap(pattern => glob.sync(pattern));
  let added = 0;
  
  files.forEach(file => {
    if (addHeader(file)) {
      console.log(`  ✓ ${file}`);
      added++;
    }
  });
  
  console.log(`\n✅ Added headers to ${added} file(s)\n`);
}

main();
