/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomBytes } from 'node:crypto';
import {
  getPolicyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration,
} from './policyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration.mjs';
import {
  lockPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
} from './policyCandidateCorrectionRepresentativeReviewCorpusControlPersistence.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
} from './policyCandidateCorrectionRepresentativeReviewCorpusVocabulary.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_AUDIT_ACTION_IDS,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_STATUS_IDS,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureAttribution,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCaptureContract.mjs';
import {
  insertPolicyCandidateCorrectionRepresentativeReviewCorpusCapture,
  insertPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureAuditEvent,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCapturePersistence.mjs';

function normalizeActorId(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeNow(value) {
  const now = value instanceof Date ? value : new Date(value);
  return Number.isNaN(now.getTime()) ? new Date() : now;
}

function buildExpiresAt(capturedAt, reviewRecordRetentionDays) {
  const expiresAt = new Date(capturedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + reviewRecordRetentionDays);
  return expiresAt;
}

/**
 * Records a future operator-reviewed evaluation row only after the original
 * answer has passed the runtime contract and its outcome attribution has been
 * reduced to the fixed allow-list. This service has no routing or scoring
 * authority and deliberately accepts a transaction client instead of a
 * browser request.
 */
export function createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureService({
  randomHex = byteLength => randomBytes(byteLength).toString('hex'),
  persistence = {
    lockControl: lockPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
    insertCapture: insertPolicyCandidateCorrectionRepresentativeReviewCorpusCapture,
    insertAuditEvent: insertPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureAuditEvent,
  },
} = {}) {
  async function capture({
    client,
    actorId,
    outcomeAttribution,
    now = new Date(),
  } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    const attribution = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureAttribution(
      outcomeAttribution,
    );
    if (!client || typeof client.query !== 'function' || !normalizedActorId || !attribution) {
      return Object.freeze({
        statusId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_STATUS_IDS.NOT_ELIGIBLE,
      });
    }

    const controlRow = await persistence.lockControl({ client });
    const configuration =
      getPolicyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration(controlRow);

    const capturedAt = normalizeNow(now);
    const capture = {
      captureId: randomHex(32),
      purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
      configurationRevision: configuration.revision,
      scoreMarginBandId: attribution.score_margin_band_id,
      selectionStatusId: attribution.selection_status_id,
      evidenceSourceStates: attribution.evidence_source_states,
      actorId: normalizedActorId,
      capturedAt: capturedAt.toISOString(),
      expiresAt: buildExpiresAt(capturedAt, configuration.reviewRecordRetentionDays).toISOString(),
    };
    const persisted = await persistence.insertCapture({ client, capture });
    if (!persisted) {
      throw new Error('Review-corpus capture persistence did not create a record.');
    }

    await persistence.insertAuditEvent({
      client,
      event: {
        actionId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_AUDIT_ACTION_IDS.CAPTURE_RECORDED,
        actorId: normalizedActorId,
        captureId: capture.captureId,
        captureRecordedAt: capture.capturedAt,
        configurationRevision: configuration.revision,
        occurredAt: capture.capturedAt,
      },
    });

    return Object.freeze({
      statusId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_STATUS_IDS.CAPTURED,
    });
  }

  return Object.freeze({ capture });
}

export const policyCandidateCorrectionRepresentativeReviewCorpusCaptureService =
  createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureService();
