/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile, realpath } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';

import {
  buildPolicyCandidateSemanticReferenceSetArtifact,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS,
} from '../server/src/services/policyCandidateSemanticReferenceSetArtifact.mjs';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== '--fixture-file' && argument !== '--reference-set-file') {
      throw new Error('Unsupported argument.');
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--') || values[argument]) {
      throw new Error('Each required JSON input must be supplied exactly once.');
    }
    values[argument] = value;
    index += 1;
  }

  if (!values['--fixture-file'] || !values['--reference-set-file']) {
    throw new Error('Both JSON inputs are required.');
  }

  return Object.freeze({
    fixtureFile: values['--fixture-file'],
    referenceSetFile: values['--reference-set-file'],
  });
}

async function resolveProjectJsonFile(value) {
  if (typeof value !== 'string' || isAbsolute(value) || extname(value).toLowerCase() !== '.json') {
    throw new Error('Input must be a project-relative JSON file.');
  }
  const requestedPath = resolve(PROJECT_ROOT, value);
  const requestedProjectRelativePath = relative(PROJECT_ROOT, requestedPath);
  if (!requestedProjectRelativePath || requestedProjectRelativePath.startsWith('..') ||
      isAbsolute(requestedProjectRelativePath)) {
    throw new Error('Input must remain inside the project.');
  }

  const [realProjectRoot, realInputPath] = await Promise.all([
    realpath(PROJECT_ROOT),
    realpath(requestedPath),
  ]);
  const resolvedProjectRelativePath = relative(realProjectRoot, realInputPath);
  if (!resolvedProjectRelativePath || resolvedProjectRelativePath.startsWith('..') ||
      isAbsolute(resolvedProjectRelativePath)) {
    throw new Error('Input must resolve inside the project.');
  }
  return realInputPath;
}

export async function loadProjectJsonFile(value) {
  const path = await resolveProjectJsonFile(value);
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function generatePolicyCandidateSemanticReferenceSetArtifact(argv = process.argv.slice(2)) {
  const { fixtureFile, referenceSetFile } = parseArguments(argv);
  const [fixtureDocument, referenceSetDocument] = await Promise.all([
    loadProjectJsonFile(fixtureFile),
    loadProjectJsonFile(referenceSetFile),
  ]);
  return buildPolicyCandidateSemanticReferenceSetArtifact({ fixtureDocument, referenceSetDocument });
}

async function main() {
  const artifact = await generatePolicyCandidateSemanticReferenceSetArtifact();
  process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  if (artifact.status.id === POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INVALID) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main().catch(() => {
    process.stderr.write('Semantic reference-set artifact generation could not run.\n');
    process.exitCode = 1;
  });
}
