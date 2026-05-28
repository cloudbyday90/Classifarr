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

import Docker from 'dockerode';
import {
    clearRuntime,
    getDockerConnection,
    getRuntimeRunId,
    readRuntime,
} from './runtime.mjs';

function isIgnorableCleanupError(error) {
    if (!error) {
        return false;
    }

    return error.statusCode === 304 ||
        error.statusCode === 404 ||
        /no such container/i.test(error.message || '') ||
        /is not running/i.test(error.message || '');
}

export default async () => {
    let runtime;
    let expectedRunId;

    try {
        expectedRunId = getRuntimeRunId();
        runtime = readRuntime();
    } catch (_error) {
        return;
    }

    if (runtime.runId !== expectedRunId) {
        return;
    }

    const { options } = getDockerConnection();
    const docker = new Docker(options);
    const container = docker.getContainer(runtime.containerId);
    const cleanupErrors = [];

    try {
        await container.stop({ t: 0 });
    } catch (error) {
        if (!isIgnorableCleanupError(error)) {
            cleanupErrors.push(`stop failed: ${error.message}`);
            // eslint-disable-next-line no-console -- infrastructure teardown logging
            console.error('[integration-test] Failed to stop container during teardown:', error.message);
        }
    }

    try {
        await container.remove({ force: true, v: true });
    } catch (error) {
        if (!isIgnorableCleanupError(error)) {
            cleanupErrors.push(`remove failed: ${error.message}`);
            // eslint-disable-next-line no-console -- infrastructure teardown logging
            console.error('[integration-test] Failed to remove container during teardown:', error.message);
        }
    }

    clearRuntime();

    if (cleanupErrors.length > 0) {
        throw new Error(`Integration global teardown failed for container ${runtime.containerId}: ${cleanupErrors.join('; ')}`);
    }
};