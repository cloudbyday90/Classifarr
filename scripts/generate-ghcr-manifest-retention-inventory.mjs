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
import process from 'node:process';
import { relative, resolve, sep } from 'node:path';

import {
  DEFAULT_GHCR_OWNER,
  DEFAULT_GHCR_PACKAGE,
  GHCR_MANIFEST_RETENTION_STATUS_IDS,
  assertRepositoryComponent,
  createGhcrManifestRetentionInventory,
} from './lib/ghcrManifestRetentionInventory.mjs';

function usage() {
  return [
    'Usage:',
    '  npm run ghcr:retention:inventory [-- --owner cloudbyday90 --package classifarr]',
    '',
    'Requires GH_TOKEN (or GITHUB_TOKEN) with GitHub Packages read access.',
    'The command performs GET-only metadata and manifest reads. It never deletes package versions.',
  ].join('\n');
}

function parseArgumentPairs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || !value || values.has(name)) {
      throw new Error(GHCR_MANIFEST_RETENTION_STATUS_IDS.INVALID_INPUT);
    }
    values.set(name, value);
  }
  return values;
}

export function resolveGhcrRetentionInventoryOutputPath({ cwd, owner, packageName }) {
  const outputRoot = resolve(cwd, '.tmp', 'ghcr-manifest-retention');
  return resolve(outputRoot, `${owner}-${packageName}-inventory.json`);
}

export function parseGhcrManifestRetentionInventoryCliArgs(args, {
  cwd = process.cwd(),
  environment = process.env,
} = {}) {
  if (args.length === 1 && args[0] === '--help') {
    return { help: true };
  }
  if (args.length % 2 !== 0) {
    throw new Error(GHCR_MANIFEST_RETENTION_STATUS_IDS.INVALID_INPUT);
  }

  const values = parseArgumentPairs(args);
  const allowedNames = new Set(['--owner', '--package']);
  if ([...values.keys()].some(name => !allowedNames.has(name))) {
    throw new Error(GHCR_MANIFEST_RETENTION_STATUS_IDS.INVALID_INPUT);
  }

  const owner = assertRepositoryComponent(values.get('--owner') || DEFAULT_GHCR_OWNER, 'owner');
  const packageName = assertRepositoryComponent(values.get('--package') || DEFAULT_GHCR_PACKAGE, 'package');
  const githubToken = environment.GH_TOKEN || environment.GITHUB_TOKEN;
  if (!githubToken?.trim()) {
    throw new Error(GHCR_MANIFEST_RETENTION_STATUS_IDS.MISSING_GITHUB_TOKEN);
  }

  return {
    githubActor: environment.GHCR_ACTOR || environment.GITHUB_ACTOR || owner,
    githubToken,
    outputPath: resolveGhcrRetentionInventoryOutputPath({ cwd, owner, packageName }),
    owner,
    packageName,
  };
}

export function writeGhcrManifestRetentionInventory({ cwd = process.cwd(), inventory, outputPath }) {
  const outputRoot = resolve(cwd, '.tmp', 'ghcr-manifest-retention');
  const resolvedOutputPath = resolve(cwd, outputPath);
  const outputRelativePath = relative(outputRoot, resolvedOutputPath);
  if (
    outputRelativePath === '' ||
    outputRelativePath === '..' ||
    outputRelativePath.startsWith(`..${sep}`)
  ) {
    throw new Error(GHCR_MANIFEST_RETENTION_STATUS_IDS.INVALID_INPUT);
  }

  fs.mkdirSync(outputRoot, { mode: 0o700, recursive: true });
  // The fixed .tmp root prevents an inventory run from writing to an arbitrary path.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(inventory, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return resolvedOutputPath;
}

async function main() {
  try {
    const options = parseGhcrManifestRetentionInventoryCliArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    const inventory = await createGhcrManifestRetentionInventory(options);
    const outputPath = writeGhcrManifestRetentionInventory({
      inventory,
      outputPath: options.outputPath,
    });
    process.stdout.write(
      `GHCR retention inventory completed: ${inventory.summary.manualReviewRequiredCount} manual-review artifact(s). Evidence: ${outputPath}\n`
    );
  } catch (error) {
    const statusId = error?.statusId || error?.message || 'unexpected_failure';
    process.stderr.write(`GHCR retention inventory failed: ${statusId}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
