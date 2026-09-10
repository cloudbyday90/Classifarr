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
    const createPacket = jest.fn(() => packet);
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
    const writePacket = jest.fn(async () => undefined);
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture,
      createPacket,
      now: () => new Date('2026-09-10T12:00:00.000Z'),
      readReadiness: jest.fn(async () => ready),
      writePacket,
    });

    const result = await workflow.create({ outputFile: '.tmp/reviewers/packet.json' });

    expect(result.status.id).toBe(STATUS_IDS.PACKET_CREATED);
    expect(result.receipt).toEqual({
      fixtureDocumentFingerprint: `sha256:${'b'.repeat(64)}`,
      packetPrepared: true,
      packetId: packet.packetId,
      statusId: 'captured_pending_independent_labels',
    });
    expect(JSON.stringify(result)).not.toContain('private-title');
    expect(writePacket).toHaveBeenCalledWith('.tmp/reviewers/packet.json', packet);
  });

  test('does not select, capture, or write when the aggregate handoff is absent', async () => {
    const cohortCapture = { captureForPrivateReviewerPacket: jest.fn() };
    const writePacket = jest.fn();
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture,
      readReadiness: async () => ({ ...ready, privateCohortCaptureReady: false }),
      writePacket,
    });

    await expect(workflow.create({ outputFile: '.tmp/reviewers/packet.json' })).resolves.toMatchObject({
      status: { id: STATUS_IDS.NOT_READY },
      receipt: null,
    });
    expect(cohortCapture.captureForPrivateReviewerPacket).not.toHaveBeenCalled();
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
      readReadiness: async () => ready,
      writePacket: async () => { throw new Error('write failure'); },
    });

    const result = await workflow.create({ outputFile: '.tmp/reviewers/packet.json' });
    expect(result.status.id).toBe(STATUS_IDS.PACKET_WRITE_FAILED);
    expect(JSON.stringify(result)).not.toContain('private');
  });
});
