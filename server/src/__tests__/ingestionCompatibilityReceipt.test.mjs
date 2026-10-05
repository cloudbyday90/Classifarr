/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { projectCompatibilityReceipt } from '../services/ingestionCompatibilityReceipt.mjs';
import { ingestionConnectionOptions } from '../config/ingestionProtocol.mjs';
const record = () => ({ id: 1, user_id: null, created_at: new Date(), metadata: {
  version: 1, requestId: randomUUID(), libraryId: 4, verification: 'compatibility_protocol_1',
  syncIds: [1, 2], moreBatches: false, privateField: 'not projected',
} });
test('protocol is per connection, overrides conflicting options, and preserves existing read-only controls', () => {
  expect(ingestionConnectionOptions()).toBe('-c classifarr.ingestion_protocol=1');
  expect(ingestionConnectionOptions('-c default_transaction_read_only=on -c classifarr.ingestion_protocol=0'))
    .toBe('-c default_transaction_read_only=on -c classifarr.ingestion_protocol=0 -c classifarr.ingestion_protocol=1');
});
test('system receipts are projected without impersonating an administrator or exposing internal metadata', () => {
  const row = record();
  expect(projectCompatibilityReceipt(row, { libraryId: 4, actorId: 9 })).toEqual({ auditId: 1,
    confirmedAt: row.created_at, requestId: row.metadata.requestId, libraryId: 4,
    status: 'reconciled', replay: 'scheduled', automatic: true });
});
test.each([{ version: 2 }, { requestId: 'bad' }, { libraryId: 5 }, { verification: 'guessed' },
  { moreBatches: true }, { syncIds: [-1] }, { syncIds: Array(101).fill(1) }])('invalid automatic receipt fails closed: %p', patch => {
  const row = record(); Object.assign(row.metadata, patch);
  expect(() => projectCompatibilityReceipt(row, { libraryId: 4 })).toThrow(expect.objectContaining({ status: 503 }));
});
test('an actor-owned record cannot pose as automatic recovery', () => {
  const row = record(); row.user_id = 9;
  expect(() => projectCompatibilityReceipt(row, { libraryId: 4 })).toThrow(expect.objectContaining({ status: 503 }));
});
