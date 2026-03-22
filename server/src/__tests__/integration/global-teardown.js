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

const Docker = require('dockerode');
const { clearRuntime, getDockerConnection, getRuntimeRunId, readRuntime } = require('./runtime');

module.exports = async () => {
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

    try {
        await container.stop({ t: 0 });
    } catch (_error) {
        // Container may already be stopped.
    }

    try {
        await container.remove({ force: true, v: true });
    } catch (_error) {
        // Container may already be removed.
    }

    clearRuntime();
};
