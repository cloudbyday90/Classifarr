/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

import {
  buildPolicyCandidateSemanticReferenceSetArtifact,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS,
} from '../server/src/services/policyCandidateSemanticReferenceSetArtifact.mjs';
import {
  loadProjectJsonFile as loadProjectJsonFileInternal,
} from './lib/project-json-input.mjs';

export { loadProjectJsonFile } from './lib/project-json-input.mjs';

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

export async function generatePolicyCandidateSemanticReferenceSetArtifact(argv = process.argv.slice(2)) {
  const { fixtureFile, referenceSetFile } = parseArguments(argv);
  const [fixtureDocument, referenceSetDocument] = await Promise.all([
    loadProjectJsonFileInternal(fixtureFile),
    loadProjectJsonFileInternal(referenceSetFile),
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
