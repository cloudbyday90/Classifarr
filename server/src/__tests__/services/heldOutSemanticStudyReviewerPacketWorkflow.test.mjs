/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createHeldOutSemanticStudyReviewerPacketWorkflow,
  HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS as STATUS_IDS,
} from '../../services/heldOutSemanticStudyReviewerPacketWorkflow.mjs';

const ready = Object.freeze({
  measuredBlockerId: 'private_cohort_capture_ready',
  privateCohortCaptureReady: true,
  statusId: 'eligibility_audit_available',
});

describe('held-out semantic study reviewer packet workflow', () => {
  test('requires the current aggregate handoff and emits only a non-content receipt', async () => {
    const packet = Object.freeze({ packetId: `review_packet_${'a'.repeat(64)}`, sensitive: 'private-title' });
    const evaluationBundle = Object.freeze({ version: 'redacted-bundle' });
    const createPacket = jest.fn(() => packet);
    const createEvaluationBundle = jest.fn(() => evaluationBundle);
    const cohortCapture = {
      captureForPrivateReviewerPacket: jest.fn(async ({ buildPacket }) => {
        expect(buildPacket({ privateReviewCases: [] })).toBe(packet);
        return {
          bundle: { manifest: { fixtureDocumentFingerprint: `sha256:${'b'.repeat(64)}` } },
          reviewerPacket: packet,
          status: { id: 'captured_pending_independent_labels' },
        };
      }),
    };
    const writeBundle = jest.fn(async () => undefined);
    const writePacket = jest.fn(async () => undefined);
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture,
      createEvaluationBundle,
      createPacket,
      now: () => new Date('2026-09-10T12:00:00.000Z'),
      readReadiness: jest.fn(async () => ready),
      writeBundle,
      writePacket,
    });

    const result = await workflow.create({
      bundleOutputFile: '.tmp/reviewers/packet.evaluation-bundle.json',
      outputFile: '.tmp/reviewers/packet.json',
    });

    expect(result.status.id).toBe(STATUS_IDS.PACKET_CREATED);
    expect(result.receipt).toEqual({
      evaluationBundlePrepared: true,
      fixtureDocumentFingerprint: `sha256:${'b'.repeat(64)}`,
      packetPrepared: true,
      packetId: packet.packetId,
      statusId: 'captured_pending_independent_labels',
    });
    expect(JSON.stringify(result)).not.toContain('private-title');
    expect(writeBundle).toHaveBeenCalledWith('.tmp/reviewers/packet.evaluation-bundle.json', evaluationBundle);
    expect(writePacket).toHaveBeenCalledWith('.tmp/reviewers/packet.json', packet);
  });

  test('does not select, capture, or write when the aggregate handoff is absent', async () => {
    const cohortCapture = { captureForPrivateReviewerPacket: jest.fn() };
    const writeBundle = jest.fn();
    const writePacket = jest.fn();
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture,
      readReadiness: async () => ({ ...ready, privateCohortCaptureReady: false }),
      writeBundle,
      writePacket,
    });

    await expect(workflow.create({
      bundleOutputFile: '.tmp/reviewers/packet.evaluation-bundle.json',
      outputFile: '.tmp/reviewers/packet.json',
    })).resolves.toMatchObject({
      status: { id: STATUS_IDS.NOT_READY },
      receipt: null,
    });
    expect(cohortCapture.captureForPrivateReviewerPacket).not.toHaveBeenCalled();
    expect(writeBundle).not.toHaveBeenCalled();
    expect(writePacket).not.toHaveBeenCalled();
  });

  test('reports a write failure without exposing the packet', async () => {
    const packet = { packetId: `review_packet_${'c'.repeat(64)}`, title: 'private' };
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture: {
        captureForPrivateReviewerPacket: async () => ({
          bundle: { manifest: { fixtureDocumentFingerprint: `sha256:${'d'.repeat(64)}` } },
          reviewerPacket: packet,
          status: { id: 'captured_pending_independent_labels' },
        }),
      },
      createEvaluationBundle: () => ({ version: 'redacted-bundle' }),
      readReadiness: async () => ready,
      writeBundle: async () => undefined,
      writePacket: async () => { throw new Error('write failure'); },
    });

    const result = await workflow.create({
      bundleOutputFile: '.tmp/reviewers/packet.evaluation-bundle.json',
      outputFile: '.tmp/reviewers/packet.json',
    });
    expect(result.status.id).toBe(STATUS_IDS.PACKET_WRITE_FAILED);
    expect(result.receipt.evaluationBundlePrepared).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private');
  });

  test('does not write the private packet when the redacted companion cannot be written', async () => {
    const writePacket = jest.fn();
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture: {
        captureForPrivateReviewerPacket: async () => ({
          bundle: { manifest: { fixtureDocumentFingerprint: `sha256:${'e'.repeat(64)}` } },
          reviewerPacket: { packetId: `review_packet_${'f'.repeat(64)}`, title: 'private' },
          status: { id: 'captured_pending_independent_labels' },
        }),
      },
      createEvaluationBundle: () => ({ version: 'redacted-bundle' }),
      readReadiness: async () => ready,
      writeBundle: async () => { throw new Error('bundle write failure'); },
      writePacket,
    });

    const result = await workflow.create({
      bundleOutputFile: '.tmp/reviewers/packet.evaluation-bundle.json',
      outputFile: '.tmp/reviewers/packet.json',
    });

    expect(result.status.id).toBe(STATUS_IDS.EVALUATION_BUNDLE_WRITE_FAILED);
    expect(result.receipt.evaluationBundlePrepared).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private');
    expect(writePacket).not.toHaveBeenCalled();
  });
});
