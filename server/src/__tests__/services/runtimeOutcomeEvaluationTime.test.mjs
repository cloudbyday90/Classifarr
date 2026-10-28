/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { captureRuntimeOutcomeEvaluationTime, readRuntimeOutcomeEvaluationTime } from '../../services/runtimeOutcomeEvaluationTime.mjs';

const now = new Date('2026-10-28T12:00:00.000Z');
const resolution = { contractFingerprint: 'abcdefghijklmnopqrstuv', actionId: 'confirm_destination',
  contractVersion: 'policy.runtime_question_answer.v1', finalDestinationLibraryId: '2' };
function classification(observed = now.toISOString()) {
  return { evaluation_now: now, metadata: { classification_details: { outcome_link: { runtime_question_answer: {
    contract_fingerprint: resolution.contractFingerprint, action_id: resolution.actionId,
    contract_version: resolution.contractVersion, destination_library_id: 2, evaluation_observed_at: observed,
  } } } } };
}

test('new resolutions use the transaction clock, with no host-clock fallback', async () => {
  const statements = [];
  expect(await captureRuntimeOutcomeEvaluationTime({ query: async sql => { statements.push(sql); return { rows: [{ evaluation_observed_at: now }] }; } }))
    .toBe(now.toISOString());
  expect(statements).toEqual(['SELECT transaction_timestamp() AS evaluation_observed_at']);
  expect(await captureRuntimeOutcomeEvaluationTime({ query: async () => ({ rows: [] }) })).toBeNull();
});

test.each([undefined, 'invalid', '2026-09-28T12:00:00.000Z', '2026-10-29T12:00:00.000Z', '2026-02-30T12:00:00.000Z'])(
  'missing, expired, future or noncanonical event time remains unknown: %s', value => {
    const input = classification(); input.metadata.classification_details.outcome_link.runtime_question_answer.evaluation_observed_at = value;
    expect(readRuntimeOutcomeEvaluationTime(input, resolution)).toBeNull();
  });

test('later receipts retain the event clock, while changed action/fingerprint/destination cannot inherit it', () => {
  const input = classification('2026-10-01T12:00:00.000Z');
  expect(readRuntimeOutcomeEvaluationTime(input, resolution)).toBe('2026-10-01T12:00:00.000Z');
  for (const changed of [{ actionId: 'change_destination' }, { contractFingerprint: 'different' }, { finalDestinationLibraryId: '3' }]) {
    expect(readRuntimeOutcomeEvaluationTime(input, { ...resolution, ...changed })).toBeNull();
  }
});
