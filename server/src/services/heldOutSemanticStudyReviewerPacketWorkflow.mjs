/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { createHeldOutSemanticStudyCohortCapture } from './heldOutSemanticStudyCohortCapture.mjs';
import {
  buildHeldOutSemanticStudyEvaluationBundle,
} from './heldOutSemanticStudyEvaluationBundle.mjs';
import { buildHeldOutSemanticStudyReviewerPacket } from './heldOutSemanticStudyReviewerPacket.mjs';

export const HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_VERSION =
  'policy.held_out_semantic_study_reviewer_packet_workflow.v1';

export const HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS = Object.freeze({
  CAPTURE_FAILED: 'capture_failed',
  EVALUATION_BUNDLE_WRITE_FAILED: 'evaluation_bundle_write_failed',
  NOT_READY: 'not_ready',
  PACKET_CREATED: 'packet_created',
  PACKET_WRITE_FAILED: 'packet_write_failed',
});

function isCaptureReady(readiness) {
  return readiness?.privateCohortCaptureReady === true &&
    readiness?.measuredBlockerId === 'private_cohort_capture_ready' &&
    readiness?.statusId === 'eligibility_audit_available';
}

function safeReceipt(result, { evaluationBundlePrepared = false } = {}) {
  return Object.freeze({
    evaluationBundlePrepared,
    fixtureDocumentFingerprint: typeof result?.bundle?.manifest?.fixtureDocumentFingerprint === 'string'
      ? result.bundle.manifest.fixtureDocumentFingerprint
      : null,
    // Preparation is distinct from a successful exclusive file write. This
    // allows a failed write to be diagnosed without implying a packet exists.
    packetPrepared: result?.status?.id === 'captured_pending_independent_labels',
    packetId: typeof result?.reviewerPacket?.packetId === 'string' ? result.reviewerPacket.packetId : null,
    statusId: result?.status?.id ?? null,
  });
}

function response(statusId, receipt = null) {
  return Object.freeze({
    receipt,
    status: Object.freeze({ id: statusId }),
    version: HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_VERSION,
  });
}

/**
 * Runs a locally authorised, one-off packet creation. It requires a current
 * aggregate handoff, writes only through the injected 0600 temporary-file
 * boundary, and returns an aggregate receipt rather than packet contents.
 */
export function createHeldOutSemanticStudyReviewerPacketWorkflow({
  cohortCapture = createHeldOutSemanticStudyCohortCapture(),
  createEvaluationBundle = buildHeldOutSemanticStudyEvaluationBundle,
  createPacket = buildHeldOutSemanticStudyReviewerPacket,
  now = () => new Date(),
  readReadiness,
  writeBundle,
  writePacket,
} = {}) {
  return Object.freeze({
    async create({ bundleOutputFile, outputFile } = {}) {
      if (typeof readReadiness !== 'function' || typeof writeBundle !== 'function' ||
          typeof writePacket !== 'function' ||
          typeof cohortCapture?.captureForPrivateReviewerPacket !== 'function') {
        return response(HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS.CAPTURE_FAILED);
      }
      let readiness;
      try {
        readiness = await readReadiness();
      } catch {
        return response(HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS.NOT_READY);
      }
      if (!isCaptureReady(readiness)) {
        return response(HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS.NOT_READY);
      }
      if (typeof outputFile !== 'string' || typeof bundleOutputFile !== 'string' ||
          !outputFile || !bundleOutputFile || outputFile === bundleOutputFile) {
        return response(HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS.CAPTURE_FAILED);
      }

      const result = await cohortCapture.captureForPrivateReviewerPacket({
        buildPacket: (input) => createPacket({ ...input, now: now() }),
      });
      if (result?.status?.id !== 'captured_pending_independent_labels' || !result.reviewerPacket) {
        return response(HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS.CAPTURE_FAILED,
          safeReceipt(result));
      }
      const evaluationBundle = createEvaluationBundle({
        bundle: result.bundle,
        packet: result.reviewerPacket,
      });
      if (!evaluationBundle) {
        return response(HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS.CAPTURE_FAILED,
          safeReceipt(result));
      }
      try {
        await writeBundle(bundleOutputFile, evaluationBundle);
      } catch {
        return response(
          HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS.EVALUATION_BUNDLE_WRITE_FAILED,
          safeReceipt(result),
        );
      }
      try {
        await writePacket(outputFile, result.reviewerPacket);
        return response(HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS.PACKET_CREATED,
          safeReceipt(result, { evaluationBundlePrepared: true }));
      } catch {
        return response(HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS.PACKET_WRITE_FAILED,
          safeReceipt(result, { evaluationBundlePrepared: true }));
      }
    },
  });
}
