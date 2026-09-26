/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { basename, dirname, extname, join } from 'node:path';

const primaryFiles = ['--reviewer-one-file', '--reviewer-two-file'];
const commands = Object.freeze({
  template: { required: ['--reviewer-id', '--provenance'], optional: [] },
  'adjudication-template': { required: ['--reviewer-id', ...primaryFiles], optional: [] },
  finalize: { required: ['--template-file'], optional: primaryFiles },
  compose: { required: primaryFiles, optional: ['--adjudication-file'] },
});
export function parseQualityReviewArguments(argv) {
  if (!Array.isArray(argv) || !Object.hasOwn(commands, argv[0]) || argv.length % 2 !== 1) throw new Error('quality_review_arguments_invalid');
  const operation = argv[0], command = commands[operation], required = ['--protocol-file', '--packet-file', '--output-file', ...command.required];
  const allowed = new Set([...required, ...command.optional]), values = Object.create(null);
  for (let i = 1; i < argv.length; i += 2) {
    const key = argv[i], value = argv[i + 1];
    if (!allowed.has(key) || Object.hasOwn(values, key) || typeof value !== 'string' || !value || value.startsWith('--')) throw new Error('quality_review_arguments_invalid');
    values[key] = value;
  }
  if (required.some(key => !Object.hasOwn(values, key)) || Boolean(values[primaryFiles[0]]) !== Boolean(values[primaryFiles[1]])) throw new Error('quality_review_arguments_invalid');
  return { operation, values };
}

export function qualityReviewReceiptFile(outputFile) {
  if (typeof outputFile !== 'string' || extname(outputFile).toLowerCase() !== '.json') throw new Error('quality_review_arguments_invalid');
  return join(dirname(outputFile), `${basename(outputFile, extname(outputFile))}.review.json`);
}

const guidance = Object.freeze({
  quality_review_arguments_invalid: 'Use template, adjudication-template, finalize, or compose with their required file options. Supply both primary submissions together.',
  quality_review_binding_invalid: 'Use the saved movie/TV protocol and its original blinded packet. Do not edit packet context or mix studies.',
  quality_review_template_invalid: 'Check worksheet fields, exact case membership, provenance, and same-media destination targets. Preserve the original binding fields.',
  quality_review_submission_invalid: 'Use finalized submissions from this packet and protocol. For adjudication, supply the exact unchanged primary submissions.',
  quality_review_window_closed: 'Check the clock and original 30-day protocol window. Expired studies require a new protocol, not altered timestamps.',
  quality_review_duplicate_reviewers: 'Use separate submissions from distinct reviewers with stable, distinct pseudonyms. Renaming copies does not establish independence.',
  quality_review_provenance_mismatch: 'Keep synthetic fixtures separate from declared human reviews. Do not relabel synthetic or model-generated judgments as human evidence.',
  quality_review_no_disputes: 'No fully labeled primary disagreement needs adjudication. Complete missing primary judgments separately or compose without a third review.',
  quality_review_attestation_required: 'For human provenance, the assigned reviewer must confirm independentReviewConfirmed after reviewing independently. Synthetic templates must keep it false.',
  STUDY_OUTPUT_CONFLICT: 'Existing output differs from the recomputed result. Preserve it and choose a new output filename.',
});
export function qualityReviewFailure(error) {
  const key = error?.code === 'STUDY_OUTPUT_CONFLICT' ? error.code : error?.message;
  return typeof key === 'string' && Object.hasOwn(guidance, key) ? { status: 'invalid', code: key, guidance: guidance[key] }
    : { status: 'invalid', code: 'quality_review_file_error', guidance: 'Check private .tmp JSON inputs, permissions, and fresh output filenames. Existing files are never overwritten.' };
}
