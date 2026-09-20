/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {
  getClassificationRetryEligibility,
  getExhaustedRetryRecovery,
} from '../../services/classificationRetryEligibility.mjs';

const exhausted = {
  status: 'failed', method: 'queued_for_retry', library_id: null,
  retry_after: null, retry_count: 3, max_retries: 3,
};

describe('classification retry eligibility', () => {
  test('recovers existing exhausted AI failures without trusting metadata or reason text', () => {
    expect(getExhaustedRetryRecovery(exhausted)).toEqual({ eligible: true, reasonCode: 'retry_exhausted' });
    expect(getClassificationRetryEligibility(exhausted)).toEqual({ eligible: true, reasonCode: null });
    expect(getExhaustedRetryRecovery({ ...exhausted, retry_count: 4 })).not.toBeNull();
  });

  test.each([
    null, {}, { status: 'routed' }, { status: 'completed' }, { status: 'reclassified' },
    { status: 'pending_retry' }, { method: 'ai_analysis' }, { method: null },
    { library_id: 1 }, { library_id: undefined }, { retry_after: new Date() },
    { retry_after: undefined }, { retry_count: 2 }, { retry_count: -1 },
    { retry_count: '3' }, { retry_count: null }, { retry_count: Infinity },
    { retry_count: 3.1 }, { retry_count: Number.MAX_SAFE_INTEGER + 1 },
    { max_retries: 0 }, { max_retries: -1 }, { max_retries: null },
    { max_retries: '3' }, { max_retries: 3.5 }, { max_retries: NaN },
  ])('does not offer exhaustion recovery for invalid/non-exhausted state %j', patch => {
    const row = patch === null || Object.keys(patch).length === 0 ? patch : { ...exhausted, ...patch };
    expect(getExhaustedRetryRecovery(row)).toBeNull();
  });

  test.each(['retry_queue', 'historic_route_safety_refresh', 'unrecognized'])('does not redrive failures from %s', source => {
    expect(getClassificationRetryEligibility(exhausted, source)).toEqual({ eligible: false, reasonCode: 'status_ineligible' });
  });

  test.each(['awaiting_decision', 'pending_retry'])('preserves existing manual retry for %s', status => {
    expect(getClassificationRetryEligibility({ status }).eligible).toBe(true);
  });

  test('scheduler admits only pending retries with remaining budget', () => {
    expect(getClassificationRetryEligibility({ ...exhausted, status: 'pending_retry', retry_count: 2 }, 'retry_queue').eligible).toBe(true);
    expect(getClassificationRetryEligibility({ ...exhausted, status: 'awaiting_decision' }, 'retry_queue').eligible).toBe(false);
    for (const retry_count of [3, 4, null, -1, '2']) {
      expect(getClassificationRetryEligibility({ ...exhausted, status: 'pending_retry', retry_count }, 'retry_queue'))
        .toEqual({ eligible: false, reasonCode: 'retry_budget_exhausted' });
    }
    expect(getClassificationRetryEligibility(null)).toEqual({ eligible: false, reasonCode: 'status_ineligible' });
  });
});
