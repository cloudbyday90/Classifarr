/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { readPrivateStudyJsonFile, writePrivateStudyJsonFile } from './privateStudyFileBoundary.mjs';
import { writeOrVerifyPrivateStudyJsonFile } from './privateStudyFileReplay.mjs';
import { parseQualityReviewArguments, qualityReviewReceiptFile, qualityReviewFailure } from './qualityReviewCommandArguments.mjs';
import { createQualityReviewTemplate, finalizeQualityReviewSubmission } from '../services/qualityReviewTemplates.mjs';
import { composeQualityReviewReference } from '../services/qualityReviewConsensus.mjs';
import { QUALITY_REVIEW_LIMITS } from '../services/qualityReviewBinding.mjs';

/** Offline only: database, provider, and worker modules are intentionally absent. */
export async function runQualityReviewCommand({ argv = process.argv.slice(2), now = new Date().toISOString(),
  readJson = readPrivateStudyJsonFile, writeJson = writePrivateStudyJsonFile } = {}) {
  const { operation, values } = parseQualityReviewArguments(argv);
  const read = option => values[option] ? readJson(values[option]) : Promise.resolve(null);
  const [protocol, packet, reviewerOne, reviewerTwo] = await Promise.all([
    read('--protocol-file'), read('--packet-file'), read('--reviewer-one-file'), read('--reviewer-two-file'),
  ]);
  const input = { protocol, packet, reviewerOne, reviewerTwo, now };
  const receipt = { operation, ...QUALITY_REVIEW_LIMITS };
  if (['template', 'adjudication-template'].includes(operation)) {
    const template = createQualityReviewTemplate({ ...input, reviewerId: values['--reviewer-id'], provenance: values['--provenance'] });
    await writeJson(values['--output-file'], template, { label: 'Quality review template' });
    return { ...receipt, status: 'template_created', provenance: template.provenance, cases: template.labels.length };
  }
  if (operation === 'finalize') {
    const submission = finalizeQualityReviewSubmission({ ...input, template: await read('--template-file') });
    await writeJson(values['--output-file'], submission, { label: 'Quality review submission' });
    return { ...receipt, status: 'submission_created', provenance: submission.provenance, cases: submission.labels.length };
  }
  const { reference, receipt: result } = composeQualityReviewReference({ ...input, adjudication: await read('--adjudication-file') });
  const companion = qualityReviewReceiptFile(values['--output-file']);
  await writeOrVerifyPrivateStudyJsonFile(values['--output-file'], reference, { readJson, writeJson, options: { label: 'Quality reference' } });
  await writeOrVerifyPrivateStudyJsonFile(companion, result, { readJson, writeJson, options: { label: 'Quality review receipt' } });
  return { ...receipt, status: result.status, provenance: result.provenance, summary: result.summary };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runQualityReviewCommand().then(result => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.operation === 'compose' && (result.status !== 'complete' || result.provenance !== 'independent_human.v1')) process.exitCode = 2;
  }).catch(error => { process.stderr.write(`${JSON.stringify(qualityReviewFailure(error))}\n`); process.exitCode = 1; });
}
