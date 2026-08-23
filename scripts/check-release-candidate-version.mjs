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
import { resolve } from 'node:path';

import {
  derivePackageVersionFromReleaseTag,
  validateReleaseCandidateVersion,
} from './lib/releaseCandidateVersion.mjs';
import { validateReleaseCandidateDocumentation } from './lib/releaseCandidateDocumentation.mjs';

const VERSION_PATHS = Object.freeze([
  'package.json',
  'client/package.json',
  'server/package.json',
]);
const LOCKFILE_PATHS = Object.freeze([
  'package-lock.json',
  'client/package-lock.json',
  'server/package-lock.json',
]);
const DISPLAY_VERSION_PATH = 'client/src/constants/appVersion.js';
const README_PATH = 'README.md';
const RELEASE_NOTES_PATH = 'RELEASE_NOTES.md';

function usage() {
  return [
    'Usage:',
    '  npm run release:check-candidate-version -- --tag <vX.Y.Z>',
    '',
    'Checks the release tag against package, lockfile, and public display versions.',
  ].join('\n');
}

function readJson(cwd, pathname) {
  // These fixed repository paths contain version metadata only.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return JSON.parse(fs.readFileSync(resolve(cwd, pathname), 'utf8'));
}

function readDisplayVersion(cwd) {
  // This fixed source file is the single public application-version constant.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const source = fs.readFileSync(resolve(cwd, DISPLAY_VERSION_PATH), 'utf8');
  const match = source.match(/APP_DISPLAY_VERSION\s*=\s*'([^']+)'/u);
  return match?.[1] || null;
}

function readText(cwd, pathname) {
  // These fixed release surfaces contain public version metadata only.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return fs.readFileSync(resolve(cwd, pathname), 'utf8');
}

export function parseReleaseCandidateVersionCliArgs(args) {
  if (args.length === 1 && args[0] === '--help') {
    return { help: true };
  }
  if (args.length !== 2 || args[0] !== '--tag' || !args[1]) {
    throw new Error('invalid_input');
  }
  return { tag: args[1] };
}

export function checkReleaseCandidateVersion({ cwd = process.cwd(), tag } = {}) {
  const packageVersions = VERSION_PATHS.map(pathname => readJson(cwd, pathname).version);
  const lockfileVersions = LOCKFILE_PATHS.flatMap(pathname => {
    const lockfile = readJson(cwd, pathname);
    return [lockfile.version, lockfile.packages?.['']?.version];
  });

  const versionValidation = validateReleaseCandidateVersion({
    displayVersion: readDisplayVersion(cwd),
    lockfileVersions,
    packageVersions,
    tag,
  });
  if (!versionValidation.expectedPackageVersion) {
    return versionValidation;
  }

  const documentationValidation = validateReleaseCandidateDocumentation({
    readme: readText(cwd, README_PATH),
    releaseNotes: readText(cwd, RELEASE_NOTES_PATH),
    tag,
  });

  return {
    ...versionValidation,
    issues: [...versionValidation.issues, ...documentationValidation.issues],
    ok: versionValidation.ok && documentationValidation.ok,
  };
}

function main() {
  try {
    const options = parseReleaseCandidateVersionCliArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    const result = checkReleaseCandidateVersion(options);
    if (!result.ok) {
      process.stderr.write(`Release candidate version check failed: ${result.issues.join(', ')}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `Release candidate version contract passed for ${options.tag} (${result.expectedPackageVersion}).\n`
    );
  } catch (error) {
    process.stderr.write(`Release candidate version check failed: ${error.message}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}

export { derivePackageVersionFromReleaseTag };
