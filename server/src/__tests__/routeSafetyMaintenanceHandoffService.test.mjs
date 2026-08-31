/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createRouteSafetyMaintenanceHandoffService,
} from '../services/routeSafetyMaintenanceHandoffService.mjs';

describe('routeSafetyMaintenanceHandoffService', () => {
  test('owns the fixed adjacent completed-day windows rather than accepting caller dimensions', async () => {
    const database = { query: jest.fn() };
    const loadGateCounts = jest.fn().mockResolvedValue([]);
    const service = createRouteSafetyMaintenanceHandoffService({
      database,
      loadGateCounts,
      now: () => new Date('2026-08-31T13:30:00.000Z'),
    });

    const report = await service.getReport();

    expect(loadGateCounts).toHaveBeenCalledWith(database, {
      previous: {
        days: 7,
        start: new Date('2026-08-17T00:00:00.000Z'),
        end: new Date('2026-08-24T00:00:00.000Z'),
      },
      current: {
        days: 7,
        start: new Date('2026-08-24T00:00:00.000Z'),
        end: new Date('2026-08-31T00:00:00.000Z'),
      },
    });
    expect(report).toMatchObject({
      status: { id: 'not_recommended' },
      handoff: null,
    });
  });
});
