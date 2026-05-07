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
import { dirname, relative } from 'node:path';
import { baselinePath, rootDir, getCurrentCoverage } from './coverage-ratchet-utils.mjs';

function formatPct(value) {
  return `${value.toFixed(2)}%`;
}

function main() {
  const coverage = getCurrentCoverage();
  const payload = {
    updated_at: new Date().toISOString(),
    server: coverage.server,
    client: coverage.client,
  };

  fs.mkdirSync(dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Coverage baseline updated: ${relative(rootDir, baselinePath)}`);
  console.log(
    `server: statements=${formatPct(payload.server.statements)}, branches=${formatPct(payload.server.branches)}, functions=${formatPct(payload.server.functions)}, lines=${formatPct(payload.server.lines)}`
  );
  console.log(
    `client: statements=${formatPct(payload.client.statements)}, branches=${formatPct(payload.client.branches)}, functions=${formatPct(payload.client.functions)}, lines=${formatPct(payload.client.lines)}`
  );
}

try {
  main();
} catch (error) {
  console.error(`Failed to update coverage baseline: ${error.message}`);
  process.exit(1);
}
