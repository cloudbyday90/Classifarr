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
  RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS,
  buildReleaseCandidateEvidence,
  buildReleaseCandidateNotes,
} from './lib/releaseCandidateEvidence.mjs';

const REQUIRED_OPTION_NAMES = Object.freeze([
  '--ci-readout',
  '--consumer-smoke',
  '--digest',
  '--provider-fault-receipt',
  '--source-revision',
  '--tag',
]);

function usage() {
  return [
    'Usage:',
    '  npm run release:assemble-candidate-evidence -- --tag <vX.Y.Z> --source-revision <git-sha> \\',
    '    --digest <sha256:...> --ci-readout <readout.json> --consumer-smoke <smoke.json> \\',
    '    --provider-fault-receipt <receipt.json>',
    '',
    'Writes bounded JSON evidence and deterministic release notes under .tmp/release-candidate.',
  ].join('\n');
}

function parseArgumentPairs(args) {
  if (args.length === 1 && args[0] === '--help') {
    return { help: true };
  }
  if (args.length === 0 || args.length % 2 !== 0) {
    throw new Error(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.INVALID_INPUT);
  }

  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!REQUIRED_OPTION_NAMES.includes(name) || values.has(name) || !value) {
      throw new Error(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.INVALID_INPUT);
    }
    values.set(name, value);
  }

  if (REQUIRED_OPTION_NAMES.some(name => !values.has(name))) {
    throw new Error(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.INVALID_INPUT);
  }

  return Object.fromEntries(values);
}

function readJson(pathname, cwd) {
  // Artifact paths are supplied by the controlled workflow and parsed before use.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return JSON.parse(fs.readFileSync(resolve(cwd, pathname), 'utf8'));
}

export function createReleaseCandidateOutputPaths({ cwd = process.cwd(), tag }) {
  const releaseDirectory = resolve(cwd, '.tmp', 'release-candidate');
  return {
    evidencePath: resolve(releaseDirectory, `${tag}-evidence.json`),
    notesPath: resolve(releaseDirectory, `${tag}-notes.md`),
  };
}

export function assembleReleaseCandidateEvidence(args, { cwd = process.cwd(), now = () => new Date() } = {}) {
  const options = parseArgumentPairs(args);
  if (options.help) {
    return { help: true };
  }

  const generatedAt = now();
  const evidence = buildReleaseCandidateEvidence({
    ciReadout: readJson(options['--ci-readout'], cwd),
    consumerSmokeEvidence: readJson(options['--consumer-smoke'], cwd),
    digest: options['--digest'],
    generatedAt: generatedAt instanceof Date ? generatedAt.toISOString() : null,
    providerFaultReceipt: readJson(options['--provider-fault-receipt'], cwd),
    sourceRevision: options['--source-revision'],
    tag: options['--tag'],
  });
  const notes = buildReleaseCandidateNotes(evidence);
  const outputPaths = createReleaseCandidateOutputPaths({ cwd, tag: evidence.tag });
  fs.mkdirSync(resolve(cwd, '.tmp', 'release-candidate'), { recursive: true, mode: 0o700 });
  // The tag is validated before paths are constructed; evidence has no secrets or runtime configuration.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.writeFileSync(outputPaths.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.writeFileSync(outputPaths.notesPath, `${notes}\n`, { encoding: 'utf8', mode: 0o600 });

  return { evidence, outputPaths };
}

function main() {
  try {
    const result = assembleReleaseCandidateEvidence(process.argv.slice(2));
    if (result.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    process.stdout.write(`Release candidate evidence: ${result.outputPaths.evidencePath}\n`);
    process.stdout.write(`Release candidate notes: ${result.outputPaths.notesPath}\n`);
  } catch (error) {
    const statusId = error?.statusId || error?.message || 'unexpected_failure';
    process.stderr.write(`Release candidate evidence failed: ${statusId}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
