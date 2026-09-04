/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import { Readable } from 'node:stream';
import { runHeldOutSemanticStudyCapture } from '../../scripts/runHeldOutSemanticStudyCapture.mjs';

test('closes the private runtime on success and failure and accepts no file arguments', async () => {
  const close = jest.fn();
  const capture = { capture: jest.fn(async () => ({ status: { id: 'complete' }, document: { redacted: true } })) };
  const loadRuntime = jest.fn(async () => ({ capture, close }));
  const run = (argv = []) => runHeldOutSemanticStudyCapture({ argv, stdin: Readable.from(['{}']), loadRuntime });
  await expect(run(['private.json'])).rejects.toThrow('stdin_only');
  expect(loadRuntime).not.toHaveBeenCalled();
  await expect(run()).resolves.toEqual({ redacted: true });
  capture.capture.mockRejectedValueOnce(new Error('sensitive provider detail'));
  await expect(run()).rejects.toThrow();
  expect(close).toHaveBeenCalledTimes(2);
});
