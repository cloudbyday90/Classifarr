/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  DATABASE_HEALTH_TRANSITION_OBSERVATION_CRON,
  DATABASE_HEALTH_TRANSITION_OBSERVATION_INITIAL_DELAY_MS,
  DATABASE_HEALTH_TRANSITION_OBSERVATION_TASK_NAME,
} from '../../services/databaseHealthTransitionObservationSchedule.mjs';
import {
  registerDatabaseHealthTransitionObservationSchedule,
} from '../../services/databaseHealthTransitionObservationScheduler.mjs';

describe('databaseHealthTransitionObservationScheduler', () => {
  test('registers automatic lock-protected observations without an operator path', async () => {
    const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
    const observe = jest.fn().mockResolvedValue({ status: { id: 'baseline_established' } });
    const log = { warn: jest.fn() };

    registerDatabaseHealthTransitionObservationSchedule(scheduler, {
      observe,
      log,
      lockKey: 2017,
    });

    expect(scheduler.schedule).toHaveBeenCalledWith(
      DATABASE_HEALTH_TRANSITION_OBSERVATION_TASK_NAME,
      DATABASE_HEALTH_TRANSITION_OBSERVATION_CRON,
      expect.any(Function),
      2017,
      { noOverlap: true },
    );
    expect(scheduler.scheduleInitial).toHaveBeenCalledWith(
      DATABASE_HEALTH_TRANSITION_OBSERVATION_TASK_NAME,
      DATABASE_HEALTH_TRANSITION_OBSERVATION_INITIAL_DELAY_MS,
      expect.any(Function),
      2017,
    );

    const run = scheduler.schedule.mock.calls[0][2];
    await expect(run()).resolves.toEqual({ status: { id: 'baseline_established' } });
    expect(observe).toHaveBeenCalledTimes(1);
  });

  test('contains observer failures without logging database error details', async () => {
    const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
    const log = { warn: jest.fn() };
    registerDatabaseHealthTransitionObservationSchedule(scheduler, {
      observe: jest.fn().mockRejectedValue(new Error('secret database address')),
      log,
      lockKey: 2017,
    });

    const run = scheduler.schedule.mock.calls[0][2];
    await expect(run()).resolves.toBeNull();
    expect(log.warn).toHaveBeenCalledWith('Passive database health transition observation unavailable');
  });
});
