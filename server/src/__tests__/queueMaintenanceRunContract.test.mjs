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

import {
    assertTaskQueueCleanupOrigin,
    createCleanupSkipResult,
    getBackgroundDrainLogDescriptor,
    TASK_QUEUE_CLEANUP_ORIGINS,
} from '../services/queueMaintenanceRunContract.mjs';

describe('queueMaintenanceRunContract', () => {
    test.each(Object.values(TASK_QUEUE_CLEANUP_ORIGINS))(
        'accepts the supported cleanup origin %s',
        cleanupOrigin => {
            expect(assertTaskQueueCleanupOrigin(cleanupOrigin)).toBe(cleanupOrigin);
        },
    );

    test('rejects an unsupported cleanup origin', () => {
        expect(() => assertTaskQueueCleanupOrigin('manual')).toThrow(
            'Unsupported task queue cleanup origin: manual',
        );
    });

    test('classifies age-only drains as routine retention work', () => {
        expect(getBackgroundDrainLogDescriptor('age')).toEqual({
            level: 'info',
            message: 'task_queue retention backlog detected at worker startup; running background drain',
        });
        expect(getBackgroundDrainLogDescriptor('count')).toEqual({
            level: 'warn',
            message: 'task_queue capacity pressure detected at worker startup; running background drain',
        });
    });

    test('creates bounded skip results without exposing internal state', () => {
        expect(createCleanupSkipResult('cron', 'advisory_lock_held')).toEqual({
            status: 'skipped',
            cleanupOrigin: 'cron',
            reason: 'advisory_lock_held',
        });
    });
});
