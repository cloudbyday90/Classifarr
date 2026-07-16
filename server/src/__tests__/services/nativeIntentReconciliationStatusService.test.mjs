/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  NativeIntentReconciliationStatusService,
} from '../../services/nativeIntentReconciliationStatusService.mjs';

describe('NativeIntentReconciliationStatusService', () => {
  test('reads control, run, state, and bounded blocker data without changing conversion state', async () => {
    const controlService = {
      getStatus: jest.fn().mockResolvedValue({
        available: true,
        automationEnabled: true,
        circuitState: 'closed',
        recoveryRequirement: 'none',
      }),
    };
    const loadLatestRun = jest.fn().mockResolvedValue({
      run_key: 'a9cf9f4a-61e3-4ca7-8fe6-b810efff7c1c',
      run_state: 'failed',
      source_status_id: 'failed',
      reason_id: 'reconciliation_candidate_input_load_failed',
      finished_at: '2026-07-16T00:50:00.000Z',
    });
    const loadUnresolvedSummary = jest.fn().mockResolvedValue({ unresolved_count: 4 });
    const loadBlockerReasonGroups = jest.fn().mockResolvedValue([]);
    const loadRecentFailedRunCount = jest.fn().mockResolvedValue({ failed_run_count: 2 });
    const db = { query: jest.fn() };
    const service = new NativeIntentReconciliationStatusService({
      db,
      controlService,
      now: () => '2026-07-16T01:00:00.000Z',
      getNextScheduledAttemptAt: jest.fn().mockReturnValue('2026-07-16T01:10:00.000Z'),
      loadLatestRun,
      loadUnresolvedSummary,
      loadBlockerReasonGroups,
      loadRecentFailedRunCount,
    });

    const status = await service.getStatus();

    expect(status).toEqual(expect.objectContaining({
      statusId: 'attention_required',
      recentFailedRunCount: 2,
      rawPayloadExposed: false,
    }));
    expect(controlService.getStatus).toHaveBeenCalledWith({ dbClient: db });
    expect(loadBlockerReasonGroups).toHaveBeenCalledWith(expect.objectContaining({ limit: 12 }));
    expect(loadRecentFailedRunCount).toHaveBeenCalledWith(expect.objectContaining({
      since: '2026-07-16T00:00:00.000Z',
    }));
    expect(db.query).not.toHaveBeenCalled();
  });
});
