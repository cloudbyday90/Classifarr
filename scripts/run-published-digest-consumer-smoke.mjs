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
  PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS,
  assertSourceRevision,
  parsePublishedImageReference,
  runPublishedDigestConsumerSmoke,
} from './lib/publishedDigestConsumerSmoke.mjs';

function usage() {
  return [
    'Usage:',
    '  npm run release:smoke:published-digest -- --image <registry/image@sha256:...> --source-revision <git-sha>',
    '',
    'The command accepts only the published GHCR or Docker Hub Classifarr image digest.',
  ].join('\n');
}

function parseArgumentPairs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || !value || values.has(name)) {
      throw new Error(PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.INVALID_INPUT);
    }
    values.set(name, value);
  }
  return values;
}

function resolveEvidenceOutputPath({ cwd, sourceRevision }) {
  return resolve(
    cwd,
    '.tmp',
    'release-consumer-smoke',
    `${sourceRevision.toLowerCase()}-published-digest-consumer-smoke.json`
  );
}

export function parsePublishedDigestConsumerSmokeCliArgs(args, { cwd = process.cwd() } = {}) {
  if (args.length === 1 && args[0] === '--help') {
    return { help: true };
  }
  if (args.length === 0 || args.length % 2 !== 0) {
    throw new Error(PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.INVALID_INPUT);
  }

  const values = parseArgumentPairs(args);
  const allowedNames = new Set(['--image', '--project-name', '--source-revision', '--wait-timeout']);
  if ([...values.keys()].some(name => !allowedNames.has(name))) {
    throw new Error(PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.INVALID_INPUT);
  }

  const image = values.get('--image');
  const sourceRevision = values.get('--source-revision');
  if (!image || !sourceRevision) {
    throw new Error(PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.INVALID_INPUT);
  }
  const publishedImage = parsePublishedImageReference(image);
  const verifiedSourceRevision = assertSourceRevision(sourceRevision);

  const waitTimeoutRaw = values.get('--wait-timeout');
  const waitTimeoutSeconds = waitTimeoutRaw === undefined
    ? undefined
    : Number.parseInt(waitTimeoutRaw, 10);
  if (waitTimeoutRaw !== undefined && String(waitTimeoutSeconds) !== waitTimeoutRaw) {
    throw new Error(PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.INVALID_INPUT);
  }

  return {
    image: publishedImage.image,
    outputPath: resolveEvidenceOutputPath({ cwd, sourceRevision: verifiedSourceRevision }),
    projectName: values.get('--project-name'),
    sourceRevision: verifiedSourceRevision,
    waitTimeoutSeconds,
  };
}

export function writePublishedDigestConsumerSmokeEvidence({ cwd = process.cwd(), evidence, outputPath }) {
  const evidenceRoot = resolve(cwd, '.tmp', 'release-consumer-smoke');
  const resolvedOutputPath = resolve(cwd, outputPath);
  const outputRelativePath = relative(evidenceRoot, resolvedOutputPath);
  if (
    outputRelativePath === '' ||
    outputRelativePath.startsWith(`..${sep}`) ||
    outputRelativePath === '..'
  ) {
    throw new Error(PUBLISHED_DIGEST_CONSUMER_SMOKE_STATUS_IDS.INVALID_INPUT);
  }

  fs.mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  // The fixed .tmp evidence root is deliberate; the CLI never accepts an arbitrary output path.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return resolvedOutputPath;
}

function main() {
  try {
    const options = parsePublishedDigestConsumerSmokeCliArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }

    const evidence = runPublishedDigestConsumerSmoke(options);
    const outputPath = writePublishedDigestConsumerSmokeEvidence({
      evidence,
      outputPath: options.outputPath,
    });
    process.stdout.write(`Published digest consumer smoke passed. Evidence: ${outputPath}\n`);
  } catch (error) {
    const statusId = error?.statusId || error?.message || 'unexpected_failure';
    process.stderr.write(`Published digest consumer smoke failed: ${statusId}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
