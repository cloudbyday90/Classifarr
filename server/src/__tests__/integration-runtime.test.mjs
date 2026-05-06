/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
    clearRuntime,
    getRuntimeFilePath,
    getRuntimeRunId,
    readRuntime,
    writeRuntime,
} from './integration/runtime.mjs';

describe('integration runtime helper', () => {
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

    it('requires explicit integration runtime env vars', async () => {
        expect(() => getRuntimeRunId()).toThrow('CLASSIFARR_INTEGRATION_RUN_ID is required');
        expect(() => getRuntimeFilePath()).toThrow('CLASSIFARR_INTEGRATION_RUNTIME_FILE is required');
    });

    it('writes and reads a runtime payload bound to the active run id', async () => {
        const runtimePath = path.join(os.tmpdir(), `classifarr-runtime-test-${crypto.randomUUID()}.json`);
        process.env.CLASSIFARR_INTEGRATION_RUN_ID = 'test-run-id';
        process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE = runtimePath;

        const payload = {
            runId: 'test-run-id',
            containerId: 'container-1',
            host: '127.0.0.1',
            port: 5432,
        };

        writeRuntime(payload);

        expect(fs.existsSync(runtimePath)).toBe(true);
        expect(readRuntime()).toEqual(payload);

        clearRuntime();
        expect(fs.existsSync(runtimePath)).toBe(false);
    });

    it('rejects runtime payloads with a mismatched run id', async () => {
        const runtimePath = path.join(os.tmpdir(), `classifarr-runtime-test-${crypto.randomUUID()}.json`);
        process.env.CLASSIFARR_INTEGRATION_RUN_ID = 'expected-run-id';
        process.env.CLASSIFARR_INTEGRATION_RUNTIME_FILE = runtimePath;

        expect(() => writeRuntime({
            runId: 'different-run-id',
            containerId: 'container-1',
        })).toThrow('Integration runtime runId mismatch');
    });
});
