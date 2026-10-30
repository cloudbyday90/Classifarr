/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parentPort, workerData } from 'node:worker_threads';
import { serialize } from 'node:v8';
import { createHash } from 'node:crypto';
import { buildPurposeEvaluationReport } from './purposeEvaluationProjection.mjs';
import { PURPOSE_EVALUATION_VERSION, readPurposeEvaluationReport } from './purposeEvaluationContract.mjs';

if (workerData?.role !== 'purpose-evaluation') throw new Error('purpose_evaluation_thread_role');
const { inputs, state } = workerData;
// Include the complete fixed window: unchanged counts cannot refresh an older source snapshot.
const fingerprint = createHash('sha256').update(serialize({ revision: PURPOSE_EVALUATION_VERSION, inputs })).digest('hex');
const unchanged = state?.input_fingerprint === fingerprint && readPurposeEvaluationReport(state.report) !== null;
try {
  const report = unchanged ? state.report : buildPurposeEvaluationReport(inputs);
  parentPort.postMessage({ fingerprint, report, unchanged });
} catch (error) {
  const failure = error?.message === 'purpose_cohort_input_budget' ? 'evidence_budget'
    : /^(authorized_evaluation_invalid_|purpose_cohort_|purpose_cases_|purpose_evaluation_invalid_)/.test(error?.message ?? '')
      ? 'invalid_evidence' : 'evaluation_unavailable';
  parentPort.postMessage({ failure });
}
