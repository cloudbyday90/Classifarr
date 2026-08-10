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
  createGhcrManifestRetentionInventory,
} from './lib/ghcrManifestRetentionInventory.mjs';
import {
  DEFAULT_GITHUB_RELEASE_OWNER,
  DEFAULT_GITHUB_RELEASE_REPOSITORY,
  PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS,
  assertReleaseTag,
  createPublishedImageReleaseRetirementPlan,
} from './lib/publishedImageReleaseRetirementPlan.mjs';

function usage() {
  return [
    'Usage:',
    '  npm run release:assess-image-retirement -- --tag <vX.Y.Z-beta>',
    '',
    'Requires GH_TOKEN (or GITHUB_TOKEN) with read access to GitHub Packages and releases.',
    'The command performs GET-only assessment. It never modifies a release, tag, registry manifest, or package version.',
  ].join('\n');
}

function parseArgumentPairs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || !value || values.has(name)) {
      throw new Error(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT);
    }
    values.set(name, value);
  }
  return values;
}

function getConfiguredTag(environment) {
  return typeof environment.npm_config_tag === 'string' && environment.npm_config_tag.trim()
    ? environment.npm_config_tag.trim()
    : null;
}

export function resolvePublishedImageReleaseRetirementPlanOutputPath({ cwd, tag }) {
  const outputRoot = resolve(cwd, '.tmp', 'published-image-release-retirement');
  return resolve(outputRoot, `${tag}-plan.json`);
}

export function parsePublishedImageReleaseRetirementPlanCliArgs(args, {
  cwd = process.cwd(),
  environment = process.env,
} = {}) {
  const normalizedArgs = args.slice();
  while (normalizedArgs[0] === '--') {
    normalizedArgs.shift();
  }
  if (normalizedArgs.length === 1 && normalizedArgs[0] === '--help') {
    return { help: true };
  }
  if (normalizedArgs.length % 2 !== 0) {
    throw new Error(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT);
  }

  const values = parseArgumentPairs(normalizedArgs);
  if ([...values.keys()].some(name => name !== '--tag')) {
    throw new Error(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT);
  }

  const argumentTag = values.has('--tag') ? assertReleaseTag(values.get('--tag')) : null;
  const configuredTag = getConfiguredTag(environment);
  if (!argumentTag && !configuredTag) {
    throw new Error(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT);
  }
  if (argumentTag && configuredTag && argumentTag !== configuredTag) {
    throw new Error(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT);
  }
  const tag = argumentTag || assertReleaseTag(configuredTag);
  const githubToken = environment.GH_TOKEN || environment.GITHUB_TOKEN;
  if (!githubToken?.trim()) {
    throw new Error(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.MISSING_GITHUB_TOKEN);
  }
  return {
    githubToken,
    outputPath: resolvePublishedImageReleaseRetirementPlanOutputPath({ cwd, tag }),
    tag,
  };
}

export function writePublishedImageReleaseRetirementPlan({ cwd = process.cwd(), outputPath, plan }) {
  const outputRoot = resolve(cwd, '.tmp', 'published-image-release-retirement');
  const resolvedOutputPath = resolve(cwd, outputPath);
  const outputRelativePath = relative(outputRoot, resolvedOutputPath);
  if (
    outputRelativePath === '' ||
    outputRelativePath === '..' ||
    outputRelativePath.startsWith(`..${sep}`)
  ) {
    throw new Error(PUBLISHED_IMAGE_RELEASE_RETIREMENT_STATUS_IDS.INVALID_INPUT);
  }

  fs.mkdirSync(outputRoot, { mode: 0o700, recursive: true });
  // The fixed .tmp root prevents retirement assessment from writing outside local evidence storage.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(plan, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return resolvedOutputPath;
}

async function main() {
  try {
    const options = parsePublishedImageReleaseRetirementPlanCliArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    const inventory = await createGhcrManifestRetentionInventory({
      githubToken: options.githubToken,
      owner: DEFAULT_GHCR_OWNER,
      packageName: DEFAULT_GHCR_PACKAGE,
    });
    const plan = await createPublishedImageReleaseRetirementPlan({
      githubToken: options.githubToken,
      inventory,
      owner: DEFAULT_GITHUB_RELEASE_OWNER,
      repository: DEFAULT_GITHUB_RELEASE_REPOSITORY,
      tag: options.tag,
    });
    const outputPath = writePublishedImageReleaseRetirementPlan({
      outputPath: options.outputPath,
      plan,
    });
    process.stdout.write(`Published image retirement assessment completed. Evidence: ${outputPath}\n`);
  } catch (error) {
    const statusId = error?.statusId || error?.message || 'unexpected_failure';
    process.stderr.write(`Published image retirement assessment failed: ${statusId}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
