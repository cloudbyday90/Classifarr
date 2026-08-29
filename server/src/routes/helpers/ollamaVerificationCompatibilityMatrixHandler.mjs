/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  OllamaVerificationCompatibilityMatrixInProgressError,
} from '../../services/ollamaVerificationCompatibilityMatrixService.mjs';

/** Keeps HTTP error translation separate from the matrix execution service. */
export function createOllamaVerificationCompatibilityMatrixHandler({ matrixService }) {
  if (!matrixService || typeof matrixService.run !== 'function') {
    throw new TypeError('Ollama verification compatibility matrix handler requires a runnable matrix service.');
  }

  return Object.freeze({
    async run(req, res) {
      const body = req?.body;
      const hasBody = Array.isArray(body)
        ? true
        : Boolean(body && typeof body === 'object' && Object.keys(body).length > 0);
      if (hasBody) {
        res.set('Cache-Control', 'no-store');
        return res.status(400).json({
          error: 'This Ollama compatibility check does not accept a request body.',
          code: 'ollama_verification_compatibility_matrix_request_body_not_allowed',
        });
      }

      try {
        const report = await matrixService.run();
        res.set('Cache-Control', 'no-store');
        return res.json(report);
      } catch (error) {
        if (error instanceof OllamaVerificationCompatibilityMatrixInProgressError) {
          res.set('Cache-Control', 'no-store');
          return res.status(409).json({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  });
}
