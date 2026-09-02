/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { loadProjectJsonFile } from './project-json-input.mjs';

export const POLICY_CANDIDATE_SEMANTIC_STUDY_INPUT_SOURCE_IDS = Object.freeze({
  CHECKED_IN_FIXTURE: 'checked_in_fixture',
  PROJECT_REDACTED_STUDY: 'project_redacted_study',
});

const EXTERNAL_STUDY_OPTION_NAMES = Object.freeze([
  '--fixture-file',
  '--snapshot-file',
  '--manifest-file',
]);
const SUPPORTED_OPTION_NAMES = new Set([
  ...EXTERNAL_STUDY_OPTION_NAMES,
  '--reference-set-file',
]);

function parseValues(argv) {
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 1) {
    const optionName = argv[index];
    const optionValue = argv[index + 1];
    if (!SUPPORTED_OPTION_NAMES.has(optionName) || !optionValue ||
        optionValue.startsWith('--') || values[optionName]) {
      throw new Error('Offline study inputs are invalid.');
    }
    values[optionName] = optionValue;
    index += 1;
  }
  return values;
}

/**
 * A baseline may replace only its label document. A project study must submit
 * every fingerprint-bound source together so checked-in and external records
 * cannot be silently combined.
 */
export function parsePolicyCandidateSemanticCounterEvidenceStudyInputs(argv = []) {
  const values = parseValues(argv);
  const externalInputCount = EXTERNAL_STUDY_OPTION_NAMES.filter((optionName) => (
    Boolean(values[optionName])
  )).length;

  if (externalInputCount === 0) {
    return Object.freeze({
      referenceSetFile: values['--reference-set-file'] ?? null,
      sourceId: POLICY_CANDIDATE_SEMANTIC_STUDY_INPUT_SOURCE_IDS.CHECKED_IN_FIXTURE,
    });
  }

  if (externalInputCount !== EXTERNAL_STUDY_OPTION_NAMES.length ||
      !values['--reference-set-file']) {
    throw new Error('An external study requires all four JSON inputs.');
  }

  return Object.freeze({
    fixtureFile: values['--fixture-file'],
    manifestFile: values['--manifest-file'],
    referenceSetFile: values['--reference-set-file'],
    snapshotFile: values['--snapshot-file'],
    sourceId: POLICY_CANDIDATE_SEMANTIC_STUDY_INPUT_SOURCE_IDS.PROJECT_REDACTED_STUDY,
  });
}

/**
 * Reads an explicit, complete, redacted study bundle. It does not write a
 * file, retain any input, or select a runtime routing authority.
 */
export async function loadPolicyCandidateSemanticCounterEvidenceStudyInputs({
  argv = [],
  loadCheckedInStudyDocuments,
} = {}) {
  const selection = parsePolicyCandidateSemanticCounterEvidenceStudyInputs(argv);
  if (selection.sourceId === POLICY_CANDIDATE_SEMANTIC_STUDY_INPUT_SOURCE_IDS.CHECKED_IN_FIXTURE) {
    if (typeof loadCheckedInStudyDocuments !== 'function') {
      throw new Error('Checked-in study input loader is unavailable.');
    }
    const [checkedInDocuments, referenceSetDocument] = await Promise.all([
      loadCheckedInStudyDocuments(),
      selection.referenceSetFile ? loadProjectJsonFile(selection.referenceSetFile) : undefined,
    ]);
    return Object.freeze({
      ...checkedInDocuments,
      referenceSetDocument,
      sourceId: selection.sourceId,
    });
  }

  const [fixtureDocument, snapshotDocument, manifest, referenceSetDocument] = await Promise.all([
    loadProjectJsonFile(selection.fixtureFile),
    loadProjectJsonFile(selection.snapshotFile),
    loadProjectJsonFile(selection.manifestFile),
    loadProjectJsonFile(selection.referenceSetFile),
  ]);
  return Object.freeze({
    fixtureDocument,
    manifest,
    referenceSetDocument,
    snapshotDocument,
    sourceId: selection.sourceId,
  });
}
