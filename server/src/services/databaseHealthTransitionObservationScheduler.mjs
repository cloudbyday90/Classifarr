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

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  observeDatabaseHealthTransition,
} from './databaseHealthTransitionObservation.mjs';
import {
  DATABASE_HEALTH_TRANSITION_OBSERVATION_CRON,
  DATABASE_HEALTH_TRANSITION_OBSERVATION_INITIAL_DELAY_MS,
  DATABASE_HEALTH_TRANSITION_OBSERVATION_TASK_NAME,
} from './databaseHealthTransitionObservationSchedule.mjs';

const logger = createLogger('DatabaseHealthTransitionObservation');

/**
 * Registers one daily, server-owned health observation plus a delayed startup
 * observation. It neither requests operator input nor schedules database work;
 * a database advisory lock prevents duplicated observations across replicas.
 */
export function registerDatabaseHealthTransitionObservationSchedule(scheduler, {
  observe = observeDatabaseHealthTransition,
  log = logger,
  lockKey = db.DB_ADVISORY_LOCKS.DATABASE_HEALTH_TRANSITION_OBSERVATION,
} = {}) {
  if (!scheduler || typeof scheduler.schedule !== 'function' || typeof scheduler.scheduleInitial !== 'function') {
    throw new TypeError('Database health transition observation requires a scheduler.');
  }

  const run = async () => {
    try {
      return await observe();
    } catch {
      log.warn('Passive database health transition observation unavailable');
      return null;
    }
  };

  scheduler.schedule(
    DATABASE_HEALTH_TRANSITION_OBSERVATION_TASK_NAME,
    DATABASE_HEALTH_TRANSITION_OBSERVATION_CRON,
    run,
    lockKey,
    { noOverlap: true },
  );
  scheduler.scheduleInitial(
    DATABASE_HEALTH_TRANSITION_OBSERVATION_TASK_NAME,
    DATABASE_HEALTH_TRANSITION_OBSERVATION_INITIAL_DELAY_MS,
    run,
    lockKey,
  );
}
