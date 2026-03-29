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

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

function getRuntimeRunId() {
    const runId = String(process.env.CLASSIFARR_INTEGRATION_RUN_ID || '').trim();
    if (!runId) {
        throw new Error('CLASSIFARR_INTEGRATION_RUN_ID is required for integration runs');
    }
    return runId;
}

function getRuntimeFilePath() {
    const runtimeFile = String(process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE || '').trim();
    if (!runtimeFile) {
        throw new Error('CLASSIFARR_INTEGRATION_RUNTIME_FILE is required for integration runs');
    }
    return runtimeFile;
}

function normalizeRuntime(runtime) {
    const runId = getRuntimeRunId();
    if (!runtime || typeof runtime !== 'object') {
        throw new Error('Integration runtime payload is invalid');
    }
    if (!runtime.runId) {
        throw new Error('Integration runtime payload is missing runId');
    }
    if (runtime.runId !== runId) {
        throw new Error(`Integration runtime runId mismatch: expected ${runId}, received ${runtime.runId}`);
    }
    return runtime;
}

function writeRuntime(runtime) {
    const runtimePath = getRuntimeFilePath();
    const normalized = normalizeRuntime({
        ...runtime,
        runId: runtime.runId || getRuntimeRunId(),
    });
    const runtimeDir = path.dirname(runtimePath);
    fs.mkdirSync(runtimeDir, { recursive: true });
    const tempPath = path.join(
        runtimeDir,
        `${path.basename(runtimePath)}.${process.pid}.${Date.now()}.tmp`
    );
    fs.writeFileSync(tempPath, JSON.stringify(normalized, null, 2), 'utf8');
    fs.renameSync(tempPath, runtimePath);
    return runtimePath;
}

function readRuntime() {
    const runtimePath = getRuntimeFilePath();

    if (!fs.existsSync(runtimePath)) {
        throw new Error(`Integration runtime file not found at ${runtimePath}`);
    }

    return normalizeRuntime(JSON.parse(fs.readFileSync(runtimePath, 'utf8')));
}

function clearRuntime() {
    const runtimePath = getRuntimeFilePath();
    if (fs.existsSync(runtimePath)) {
        fs.unlinkSync(runtimePath);
    }
}

function getDockerConnection() {
    const dockerHost = process.env.DOCKER_HOST;

    if (dockerHost) {
        const parsed = new URL(dockerHost);

        if (parsed.protocol === 'npipe:') {
            return {
                label: dockerHost,
                options: {
                    socketPath: parsed.pathname.replace(/^\/+/, '//')
                }
            };
        }

        if (parsed.protocol === 'unix:') {
            return {
                label: dockerHost,
                options: {
                    socketPath: parsed.pathname
                }
            };
        }

        return {
            label: dockerHost,
            options: {
                host: parsed.hostname,
                port: parsed.port
            }
        };
    }

    if (process.platform === 'win32') {
        return {
            label: '//./pipe/docker_engine',
            options: {
                socketPath: '//./pipe/docker_engine'
            }
        };
    }

    return {
        label: '/var/run/docker.sock',
        options: {
            socketPath: '/var/run/docker.sock'
        }
    };
}

module.exports = {
    clearRuntime,
    getDockerConnection,
    getRuntimeFilePath,
    getRuntimeRunId,
    readRuntime,
    writeRuntime
};
