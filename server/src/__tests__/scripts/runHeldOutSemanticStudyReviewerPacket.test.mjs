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
  const cohortCapture = {
    captureForPrivateReviewerPacket: jest.fn(async () => ({
      bundle: { manifest: { fixtureDocumentFingerprint: `sha256:${'b'.repeat(64)}` } },
      reviewerPacket: packet,
      status: { id: 'captured_pending_independent_labels' },
    })),
  };
  const loadRuntime = jest.fn(async () => ({ cohortCapture, close, readReadiness: async () => ready }));
  const writePacket = jest.fn(async () => undefined);

  await expect(runHeldOutSemanticStudyReviewerPacket({
    argv: ['--output-file', '.tmp/reviewer-packet.json'],
    loadRuntime,
    writePacket,
  })).rejects.toThrow('arguments_invalid');
  expect(loadRuntime).not.toHaveBeenCalled();

  const result = await runHeldOutSemanticStudyReviewerPacket({
    argv: ['--confirm-private-reviewer-packet', '--output-file', '.tmp/reviewer-packet.json'],
    loadRuntime,
    writePacket,
  });
  expect(result.status.id).toBe('packet_created');
  expect(JSON.stringify(result)).not.toContain('not in report');
  expect(writePacket).toHaveBeenCalledWith('.tmp/reviewer-packet.json', packet);
  expect(close).toHaveBeenCalledTimes(1);
});
