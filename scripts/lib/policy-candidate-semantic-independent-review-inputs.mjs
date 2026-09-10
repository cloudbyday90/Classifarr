/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { loadProjectJsonFile } from './project-json-input.mjs';

const REQUIRED_OPTION_NAMES = Object.freeze([
  '--reviewer-one-file',
  '--reviewer-two-file',
  '--reference-set-id',
  '--output-file',
]);
const OPTIONAL_OPTION_NAMES = Object.freeze(['--adjudication-file']);
const SUPPORTED_OPTION_NAMES = new Set([...REQUIRED_OPTION_NAMES, ...OPTIONAL_OPTION_NAMES]);

function parseValues(argv) {
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 1) {
    const optionName = argv[index];
    const optionValue = argv[index + 1];
    if (!SUPPORTED_OPTION_NAMES.has(optionName) || !optionValue ||
        optionValue.startsWith('--') || values[optionName]) {
      throw new Error('Independent review inputs are invalid.');
    }
    values[optionName] = optionValue;
    index += 1;
  }
  if (REQUIRED_OPTION_NAMES.some((optionName) => !values[optionName])) {
    throw new Error('Independent review inputs are incomplete.');
  }
  return values;
}

/** Parses and loads only the bounded redacted documents needed for consensus. */
export async function loadPolicyCandidateSemanticIndependentReviewInputs({ argv = [] } = {}) {
  const values = parseValues(argv);
  const [reviewerOneSubmission, reviewerTwoSubmission, adjudicationSubmission] = await Promise.all([
    loadProjectJsonFile(values['--reviewer-one-file']),
    loadProjectJsonFile(values['--reviewer-two-file']),
    values['--adjudication-file']
      ? loadProjectJsonFile(values['--adjudication-file'])
      : Promise.resolve(null),
  ]);
  return Object.freeze({
    adjudicationSubmission,
    outputFile: values['--output-file'],
    referenceSetId: values['--reference-set-id'],
    reviewerOneSubmission,
    reviewerTwoSubmission,
  });
}
