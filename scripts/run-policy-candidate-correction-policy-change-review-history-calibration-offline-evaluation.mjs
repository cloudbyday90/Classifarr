/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketReadModel,
} from '../server/src/services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketContract.mjs';
import {
  evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_STATUS_IDS,
} from '../server/src/services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationOfflineEvaluation.mjs';
import {
  evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_OFFLINE_EVALUATION_STATUS_IDS,
} from '../server/src/services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandOfflineEvaluation.mjs';

const FIXTURE_CORPUS_URL = new URL(
  './fixtures/policy-candidate-correction-policy-change-review-history-calibration.fixtures.json',
  import.meta.url,
);
const BAND_FIXTURE_CORPUS_URL = new URL(
  './fixtures/policy-candidate-correction-policy-change-review-history-calibration-bands.fixtures.json',
  import.meta.url,
);

async function main() {
  const corpus = JSON.parse(await readFile(FIXTURE_CORPUS_URL, 'utf8'));
  const bandCorpus = JSON.parse(await readFile(BAND_FIXTURE_CORPUS_URL, 'utf8'));
  const evaluation = evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(corpus);
  const bandEvaluation = evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus(bandCorpus);
  const approvalPacket = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketReadModel({
    evaluation,
    bandEvaluation,
  });
  const report = Object.freeze({
    version: 'policy.candidate_correction_policy_change_calibration_offline_evaluation_run.v1',
    authority: evaluation.authority,
    evaluation: Object.freeze({
      version: evaluation.version,
      statusId: evaluation.statusId,
      fixtureCorpusVersion: evaluation.fixtureCorpusVersion,
      validation: evaluation.validation,
      summary: evaluation.summary,
    }),
    bandEvaluation: Object.freeze({
      version: bandEvaluation.version,
      statusId: bandEvaluation.statusId,
      fixtureCorpusVersion: bandEvaluation.fixtureCorpusVersion,
      specificationVersion: bandEvaluation.specificationVersion,
      validation: bandEvaluation.validation,
      summary: bandEvaluation.summary,
    }),
    approvalPacket,
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (evaluation.statusId !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_STATUS_IDS.PASSED ||
      bandEvaluation.statusId !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_OFFLINE_EVALUATION_STATUS_IDS.PASSED ||
      !approvalPacket.packetAvailable) {
    process.exitCode = 1;
  }
}

main().catch(() => {
  process.stderr.write('Offline policy-change calibration evaluation could not run.\n');
  process.exitCode = 1;
});
