/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { loadProjectJsonFile } from './project-json-input.mjs';

const OPTION_NAMES = Object.freeze([
  '--fixture-file',
  '--snapshot-file',
  '--manifest-file',
  '--reference-set-file',
  '--proposal-file',
]);
const OPTION_NAME_SET = new Set(OPTION_NAMES);

export function parsePolicyCandidateFrozenSemanticStudyInputs(argv = []) {
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 1) {
    const optionName = argv[index];
    const optionValue = argv[index + 1];
    if (!OPTION_NAME_SET.has(optionName) || !optionValue || optionValue.startsWith('--') ||
        values[optionName]) {
      throw new Error('Frozen semantic-study inputs are invalid.');
    }
    values[optionName] = optionValue;
    index += 1;
  }

  if (OPTION_NAMES.some((optionName) => !values[optionName])) {
    throw new Error('A frozen semantic study requires all five JSON inputs.');
  }

  return Object.freeze({
    fixtureFile: values['--fixture-file'],
    manifestFile: values['--manifest-file'],
    proposalFile: values['--proposal-file'],
    referenceSetFile: values['--reference-set-file'],
    snapshotFile: values['--snapshot-file'],
  });
}

/** Loads a complete project-contained study bundle without writing or retaining it. */
export async function loadPolicyCandidateFrozenSemanticStudyInputs({ argv = [] } = {}) {
  const selection = parsePolicyCandidateFrozenSemanticStudyInputs(argv);
  const [fixtureDocument, snapshotDocument, manifest, referenceSetDocument, proposal] = await Promise.all([
    loadProjectJsonFile(selection.fixtureFile),
    loadProjectJsonFile(selection.snapshotFile),
    loadProjectJsonFile(selection.manifestFile),
    loadProjectJsonFile(selection.referenceSetFile),
    loadProjectJsonFile(selection.proposalFile),
  ]);
  return Object.freeze({ fixtureDocument, manifest, proposal, referenceSetDocument, snapshotDocument });
}
