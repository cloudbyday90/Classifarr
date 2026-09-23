/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { assessProfileRefreshWorkerHealth } from '../services/profileRefreshWorkerHealth.mjs';
import { recordProfileRefreshWorkerProgress } from '../services/profileRefreshWorkerProgress.mjs';

const asOf = '2026-09-23T12:00:00.000Z';
const base = { worker_last_tick_at: '2026-09-23T11:59:00.000Z',
    worker_last_success_at: '2026-09-23T11:59:00.000Z',
    worker_last_completed_at: '2026-09-23T11:58:00.000Z',
    worker_last_outcome_id: 'completed', claimable_count: 2,
    oldest_claimable_at: '2026-09-23T11:30:00.000Z' };

test.each([
    [{ ...base, worker_last_tick_at: null }, 'not_observed'],
    [{ ...base, worker_last_tick_at: '2026-09-23T11:54:00.000Z' }, 'check_in_overdue'],
    [{ ...base, worker_last_outcome_id: 'partial_failure' }, 'cycle_failed'],
    [{ ...base, worker_last_completed_at: null }, 'no_recent_completion'],
    [base, 'backlog_progressing'],
    [{ ...base, claimable_count: 0, oldest_claimable_at: null }, 'overdue_without_claimable_work'],
])('classifies bounded worker health %#', (row, statusId) => {
    expect(assessProfileRefreshWorkerHealth(row, { asOf, overdueCount: 1 }).statusId).toBe(statusId);
});

test('records only fixed outcome and counts with an atomic singleton upsert', async () => {
    const db = { query: jest.fn().mockResolvedValue({}) };
    await recordProfileRefreshWorkerProgress(db, { outcomeId: 'completed', claimedCount: 2,
        completedCount: 1 });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (singleton_id) DO UPDATE'),
        ['completed', 2, 1]);
    await expect(recordProfileRefreshWorkerProgress(db, { outcomeId: 'untrusted', claimedCount: 1 }))
        .rejects.toThrow('Invalid profile refresh worker progress');
    expect(db.query).toHaveBeenCalledTimes(1);
});

test('reports the oldest claimable age without exposing work payloads', () => {
    const health = assessProfileRefreshWorkerHealth(base, { asOf, overdueCount: 1 });
    expect(health.oldestClaimableAgeMinutes).toBe(30);
    expect(health.lastSuccessAgeMinutes).toBe(1);
    expect(JSON.stringify(health)).not.toContain('Private title');
});
