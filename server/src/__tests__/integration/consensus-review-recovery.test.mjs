/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { restoreConsensusReview } from '../../services/classificationConsensusReviewRecovery.mjs';

let client;
beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`CREATE TEMP TABLE classification_history (id integer, method text, status text,
    library_id integer, library_name text, pending_reason text, policy_question jsonb, metadata jsonb);
    INSERT INTO classification_history VALUES
    (1,'library_consensus_auto','completed',2,'Destination',NULL,NULL,'{"preserve":true}'),
    (2,'library_consensus_auto','routed',2,'Destination',NULL,NULL,'{}'),
    (3,'policy_auto','completed',2,'Destination',NULL,NULL,'{}');`);
});
afterEach(() => { client?.release(true); client = null; });

test('expired consensus returns to actionable review without erasing evidence', async () => {
  const result = { method: 'library_consensus_auto', needs_clarification: false };
  const question = { question: 'Choose a destination', context: "Quotes ' remain data" };
  await restoreConsensusReview({ classificationId: 1, metadata: {}, result }, {
    db: client,
    ensureDecisionQuestion: async ({ result: pending }) => {
      pending.policy_question = question;
      pending.pending_reason = 'Fresh comparison required';
    },
  });
  expect(result.needs_clarification).toBe(true);
  expect((await client.query('SELECT * FROM classification_history WHERE id=1')).rows[0]).toMatchObject({
    status: 'awaiting_decision', library_id: null, library_name: null,
    pending_reason: 'Fresh comparison required', policy_question: question, metadata: { preserve: true },
  });
});

test.each([2, 3])('does not overwrite an already routed or unrelated decision (%s)', async classificationId => {
  const before = (await client.query('SELECT * FROM classification_history WHERE id=$1', [classificationId])).rows[0];
  await restoreConsensusReview({ classificationId, metadata: {}, result: { method: 'library_consensus_auto' } }, {
    db: client, ensureDecisionQuestion: async () => {},
  });
  expect((await client.query('SELECT * FROM classification_history WHERE id=$1', [classificationId])).rows[0]).toEqual(before);
});
