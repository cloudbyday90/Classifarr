/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  createOllamaVerificationCompatibilityMatrixHandler,
} from '../routes/helpers/ollamaVerificationCompatibilityMatrixHandler.mjs';
import {
  OllamaVerificationCompatibilityMatrixInProgressError,
} from '../services/ollamaVerificationCompatibilityMatrixService.mjs';

function createResponse() {
  return {
    set: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

test('compatibility matrix handler returns only the transient service report', async () => {
  const report = { stateId: 'completed', outcomes: [] };
  const handler = createOllamaVerificationCompatibilityMatrixHandler({
    matrixService: { run: jest.fn().mockResolvedValue(report) },
  });
  const res = createResponse();

  await handler.run({}, res);

  expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(res.json).toHaveBeenCalledWith(report);
});

test('compatibility matrix handler returns a bounded busy response', async () => {
  const handler = createOllamaVerificationCompatibilityMatrixHandler({
    matrixService: { run: jest.fn().mockRejectedValue(new OllamaVerificationCompatibilityMatrixInProgressError()) },
  });
  const res = createResponse();

  await handler.run({}, res);

  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith({
    error: 'An Ollama compatibility matrix is already running. Wait for it to finish before trying again.',
    code: 'ollama_verification_compatibility_matrix_in_progress',
  });
});

test('compatibility matrix handler rejects a browser-supplied request body before starting provider work', async () => {
  const matrixService = { run: jest.fn() };
  const handler = createOllamaVerificationCompatibilityMatrixHandler({ matrixService });
  const res = createResponse();

  await handler.run({ body: { host: 'attacker.invalid' } }, res);

  expect(matrixService.run).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({
    error: 'This Ollama compatibility check does not accept a request body.',
    code: 'ollama_verification_compatibility_matrix_request_body_not_allowed',
  });
});
