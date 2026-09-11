/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';

import {
  runHeldOutSemanticStudyReviewerPacket,
} from '../../scripts/runHeldOutSemanticStudyReviewerPacket.mjs';

const ready = {
  measuredBlockerId: 'private_cohort_capture_ready',
  privateCohortCaptureReady: true,
  statusId: 'eligibility_audit_available',
};

test('requires explicit local confirmation, writes the private packet, and closes the read-only runtime', async () => {
  const close = jest.fn();
  const packet = { packetId: `review_packet_${'a'.repeat(64)}`, privateTitle: 'not in report' };
  const scoringInput = { privateTitle: 'not in report scorer input' };
  const cohortCapture = {
    captureForPrivateReviewerPacket: jest.fn(async () => ({
      bundle: { manifest: { fixtureDocumentFingerprint: `sha256:${'b'.repeat(64)}` } },
      reviewerPacket: packet,
      scoringInput,
      status: { id: 'captured_pending_independent_labels' },
  })),
  };
  const loadRuntime = jest.fn(async () => ({ cohortCapture, close, readReadiness: async () => ready }));
  const evaluationBundle = { version: 'redacted-bundle' };
  const createEvaluationBundle = jest.fn(() => evaluationBundle);
  const writeBundle = jest.fn(async () => undefined);
  const writePacket = jest.fn(async () => undefined);
  const writeReviewerTemplate = jest.fn(async () => undefined);
  const writeScoringInput = jest.fn(async () => undefined);

  await expect(runHeldOutSemanticStudyReviewerPacket({
    argv: ['--output-file', '.tmp/reviewer-packet.json'],
    createEvaluationBundle,
    loadRuntime,
    writeBundle,
    writePacket,
    writeScoringInput,
  })).rejects.toThrow('arguments_invalid');
  expect(loadRuntime).not.toHaveBeenCalled();

  const result = await runHeldOutSemanticStudyReviewerPacket({
    argv: ['--confirm-private-reviewer-packet', '--output-file', '.tmp/reviewer-packet.json'],
    createEvaluationBundle,
    createReviewerTemplatePair: () => ({
      reviewerOne: { submissionId: 'reviewer-one' },
      reviewerTwo: { submissionId: 'reviewer-two' },
    }),
    loadRuntime,
    writeBundle,
    writePacket,
    writeReviewerTemplate,
    writeScoringInput,
  });
  expect(result.status.id).toBe('packet_created');
  expect(JSON.stringify(result)).not.toContain('not in report');
  expect(result.receipt.evaluationBundlePrepared).toBe(true);
  expect(result.receipt.reviewerTemplatesPrepared).toBe(true);
  expect(result.receipt.scoringInputPrepared).toBe(true);
  expect(writeBundle).toHaveBeenCalledWith('.tmp\\reviewer-packet.evaluation-bundle.json', evaluationBundle);
  expect(writePacket).toHaveBeenCalledWith('.tmp/reviewer-packet.json', packet);
  expect(writeReviewerTemplate).toHaveBeenCalledWith(
    '.tmp\\reviewer-packet.reviewer-one-template.json', { submissionId: 'reviewer-one' },
  );
  expect(writeReviewerTemplate).toHaveBeenCalledWith(
    '.tmp\\reviewer-packet.reviewer-two-template.json', { submissionId: 'reviewer-two' },
  );
  expect(writeScoringInput).toHaveBeenCalledWith('.tmp\\reviewer-packet.scoring-input.json', scoringInput);
  expect(close).toHaveBeenCalledTimes(1);
});
