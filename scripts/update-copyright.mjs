#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import fs from 'node:fs';
import { globSync } from 'glob';

const CURRENT_YEAR = new Date().getFullYear();
const COPYRIGHT_YEAR = `2024-${CURRENT_YEAR}`;
const OLD_OWNER = 'cloudbyday90';
const NEW_OWNER = 'Classifarr Contributors';

const FILE_PATTERNS = [
  'server/**/*.js',
  'client/src/**/*.{js,vue}',
  'database/migrations/**/*.sql',
  'scripts/**/*.{js,mjs,cjs}'
];

const IGNORE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'];

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
  mjs: `/*
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
  cjs: `/*
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

const COPYRIGHT_RE = /Copyright \(C\) (\d{4}|\d{4}-\d{4}) (cloudbyday90|Classifarr Contributors)/g;

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('Copyright (C)')) {
    const ext = filePath.split('.').pop();
    const header = HEADERS[ext] || HEADERS.js;

    let newContent;
    if (content.startsWith('#!')) {
      const eol = content.indexOf('\n');
      if (eol !== -1) {
        newContent = content.substring(0, eol + 1) + header + content.substring(eol + 1);
      } else {
        newContent = content + '\n' + header;
      }
    } else {
      newContent = header + content;
    }

    fs.writeFileSync(filePath, newContent, 'utf8');
    return 'added';
  }

  const updated = content.replace(COPYRIGHT_RE, `Copyright (C) ${COPYRIGHT_YEAR} ${NEW_OWNER}`);
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return 'updated';
  }

  return null;
}

function main() {
  console.log(`\n🔄 Updating copyright headers to ${COPYRIGHT_YEAR}...\n`);

  const files = FILE_PATTERNS.flatMap(pattern =>
    globSync(pattern, { nodir: true, ignore: IGNORE_PATTERNS })
  );

  let added = 0;
  let updated = 0;

  files.forEach(file => {
    const result = processFile(file);
    if (result === 'added') {
      console.log(`  + ${file}`);
      added++;
    } else if (result === 'updated') {
      console.log(`  ✓ ${file}`);
      updated++;
    }
  });

  console.log(`\n✅ Added headers to ${added} file(s), updated year/owner in ${updated} file(s)\n`);
}

main();