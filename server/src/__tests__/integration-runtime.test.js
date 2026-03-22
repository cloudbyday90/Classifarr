/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

describe('integration runtime helper', () => {
    const runtimeModulePath = '../__tests__/integration/runtime';
    let previousRunId;
    let previousRuntimeFile;

    beforeEach(() => {
        previousRunId = process.env.CLASSIFARR_INTEGRATION_RUN_ID;
        previousRuntimeFile = process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE;
        delete process.env.CLASSIFARR_INTEGRATION_RUN_ID;
        delete process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE;
    });

    afterEach(() => {
        if (previousRunId === undefined) {
            delete process.env.CLASSIFARR_INTEGRATION_RUN_ID;
        } else {
            process.env.CLASSIFARR_INTEGRATION_RUN_ID = previousRunId;
        }

        if (previousRuntimeFile === undefined) {
            delete process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE;
        } else {
            process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE = previousRuntimeFile;
        }
    });

    it('requires explicit integration runtime env vars', () => {
        const runtime = require(runtimeModulePath);

        expect(() => runtime.getRuntimeRunId()).toThrow('CLASSIFARR_INTEGRATION_RUN_ID is required');
        expect(() => runtime.getRuntimeFilePath()).toThrow('CLASSIFARR_INTEGRATION_RUNTIME_FILE is required');
    });

    it('writes and reads a runtime payload bound to the active run id', () => {
        const runtimePath = path.join(os.tmpdir(), `classifarr-runtime-test-${crypto.randomUUID()}.json`);
        process.env.CLASSIFARR_INTEGRATION_RUN_ID = 'test-run-id';
        process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE = runtimePath;

        const runtime = require(runtimeModulePath);
        const payload = {
            runId: 'test-run-id',
            containerId: 'container-1',
            host: '127.0.0.1',
            port: 5432,
        };

        runtime.writeRuntime(payload);

        expect(fs.existsSync(runtimePath)).toBe(true);
        expect(runtime.readRuntime()).toEqual(payload);

        runtime.clearRuntime();
        expect(fs.existsSync(runtimePath)).toBe(false);
    });

    it('rejects runtime payloads with a mismatched run id', () => {
        const runtimePath = path.join(os.tmpdir(), `classifarr-runtime-test-${crypto.randomUUID()}.json`);
        process.env.CLASSIFARR_INTEGRATION_RUN_ID = 'expected-run-id';
        process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE = runtimePath;

        const runtime = require(runtimeModulePath);

        expect(() => runtime.writeRuntime({
            runId: 'different-run-id',
            containerId: 'container-1',
        })).toThrow('Integration runtime runId mismatch');
    });
});
