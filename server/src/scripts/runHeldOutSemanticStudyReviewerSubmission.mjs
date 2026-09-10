/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

import {
  buildHeldOutSemanticStudyReviewerSubmissionTemplate,
  finalizeHeldOutSemanticStudyReviewerSubmission,
} from '../services/heldOutSemanticStudyReviewerSubmissionTemplate.mjs';
import {
  readPrivateStudyJsonFile,
  writePrivateStudyJsonFile,
} from './privateStudyFileBoundary.mjs';

export const HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_WORKFLOW_VERSION =
  'policy.held_out_semantic_study_reviewer_submission_workflow.v1';

export const HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_WORKFLOW_STATUS_IDS = Object.freeze({
  INVALID: 'invalid',
  SUBMISSION_CREATED: 'submission_created',
  TEMPLATE_CREATED: 'template_created',
});

const CREATE_TEMPLATE = 'create-template';
const FINALIZE_SUBMISSION = 'finalize-submission';

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length < 5) throw new Error('reviewer_submission_arguments_invalid');
  const [command, ...options] = argv;
  const requiredOptions = command === CREATE_TEMPLATE
    ? ['--packet-file', '--output-file']
    : command === FINALIZE_SUBMISSION
      ? ['--packet-file', '--template-file', '--output-file']
      : null;
  if (!requiredOptions || options.length !== requiredOptions.length * 2) {
    throw new Error('reviewer_submission_arguments_invalid');
  }
  const values = Object.create(null);
  for (let index = 0; index < options.length; index += 2) {
    const option = options[index];
    const value = options[index + 1];
    if (!requiredOptions.includes(option) || values[option] || typeof value !== 'string' || !value ||
        value.startsWith('--')) throw new Error('reviewer_submission_arguments_invalid');
    values[option] = value;
  }
  if (requiredOptions.some((option) => !values[option])) throw new Error('reviewer_submission_arguments_invalid');
  return Object.freeze({ command, values });
}

function report(statusId, fixtureCount = 0) {
  return Object.freeze({
    status: Object.freeze({ id: statusId }),
    summary: Object.freeze({ fixtureCount }),
    version: HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_WORKFLOW_VERSION,
  });
}

/**
 * Makes or finalizes an offline, content-free reviewer submission. The only
 * input bearing media context is the already private packet; output contains
 * no case content and is never echoed to stdout.
 */
export async function runHeldOutSemanticStudyReviewerSubmission({
  argv = process.argv.slice(2),
  buildTemplate = buildHeldOutSemanticStudyReviewerSubmissionTemplate,
  finalizeSubmission = finalizeHeldOutSemanticStudyReviewerSubmission,
  readJson = readPrivateStudyJsonFile,
  writeJson = writePrivateStudyJsonFile,
} = {}) {
  const { command, values } = parseArguments(argv);
  const packet = await readJson(values['--packet-file']);
  if (command === CREATE_TEMPLATE) {
    const template = buildTemplate({ packet });
    if (!template) return report(HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_WORKFLOW_STATUS_IDS.INVALID);
    await writeJson(values['--output-file'], template, { label: 'Reviewer submission template' });
    return report(HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_WORKFLOW_STATUS_IDS.TEMPLATE_CREATED,
      template.labels.length);
  }

  const template = await readJson(values['--template-file'], { label: 'Reviewer submission template' });
  const submission = finalizeSubmission({ packet, template });
  if (!submission) return report(HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_WORKFLOW_STATUS_IDS.INVALID);
  await writeJson(values['--output-file'], submission, { label: 'Reviewer submission' });
  return report(HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_WORKFLOW_STATUS_IDS.SUBMISSION_CREATED,
    submission.labels.length);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runHeldOutSemanticStudyReviewerSubmission().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status.id === HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_WORKFLOW_STATUS_IDS.INVALID) {
      process.exitCode = 1;
    }
  }).catch(() => {
    process.stderr.write('Held-out reviewer submission could not run.\n');
    process.exitCode = 1;
  });
}
