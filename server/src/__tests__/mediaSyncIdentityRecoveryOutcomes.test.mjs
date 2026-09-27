/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createSyncIdentityOutcomeRecorder, recordSyncIdentityRecoveryOutcome } from '../services/mediaSyncIdentityRecoveryOutcomes.mjs';

const context = { libraryId: 1, mediaServerId: 2, generation: 3 };
const item = { external_id: 'fixture', source_identity_evidence: { snapshotDigest: 'a'.repeat(64) } };
test.each([{ reason: 'secret' }, { reason: 'source_changed', attemptId: 'invalid' }])('rejects invalid outcomes %j before SQL', async outcome => {
  const store = { withCurrentCapture: jest.fn() };
  await expect(recordSyncIdentityRecoveryOutcome(store, context, item, outcome)).rejects.toThrow('Invalid source recovery outcome');
  expect(store.withCurrentCapture).not.toHaveBeenCalled();
});
test('diagnostic storage errors emit only a deduplicated, redacted warning', async () => {
  const store = { withCurrentCapture: jest.fn().mockRejectedValue(new Error('secret token and URL')) };
  const logger = { warn: jest.fn() };
  const record = createSyncIdentityOutcomeRecorder(store, context, logger);
  expect(await record(item, { reason: 'source_unavailable' })).toBe(false);
  expect(logger.warn).toHaveBeenCalledWith('Source recovery outcome could not be recorded', { libraryId: 1 },
    { dedupeKey: 'identity-outcome:1', dedupeWindowMs: 3600000 });
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secret');
});
