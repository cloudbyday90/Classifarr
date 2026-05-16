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

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess } from '../utils/responseHelpers.mjs';
import { ValidationError } from '../utils/appError.mjs';

export function createConfidenceRouter({
  express,
  confidenceCalculator,
  signalTypes,
}) {
  const router = express.Router();

  router.get('/weights', asyncHandler(async (_req, res) => {
    await confidenceCalculator.loadWeights();

    return sendData(res, {
      weights: confidenceCalculator.getWeights(),
      threshold: confidenceCalculator.getThreshold(),
      signalTypes,
      defaults: confidenceCalculator.getDefaultWeights(),
    });
  }));

  router.put('/weights', asyncHandler(async (req, res) => {
    const { weights } = req.body;

    if (!weights || typeof weights !== 'object') {
      throw new ValidationError('Invalid weights object');
    }

    for (const [key, value] of Object.entries(weights)) {
      if (typeof value !== 'number' || value < 0 || value > 100) {
        throw new ValidationError(`Invalid weight for ${key}: must be a number between 0 and 100`);
      }
    }

    await confidenceCalculator.saveWeights(weights);

    return sendSuccess(res, { weights: confidenceCalculator.getWeights() });
  }));

  router.put('/threshold', asyncHandler(async (req, res) => {
    const { threshold } = req.body;

    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
      throw new ValidationError('Threshold must be a number between 0 and 100');
    }

    await confidenceCalculator.saveThreshold(threshold);

    return sendSuccess(res, { threshold: confidenceCalculator.getThreshold() });
  }));

  router.post('/reset', asyncHandler(async (_req, res) => {
    const defaults = confidenceCalculator.getDefaultWeights();
    await confidenceCalculator.saveWeights(defaults);
    await confidenceCalculator.saveThreshold(80);

    return sendSuccess(res, { weights: defaults, threshold: 80 });
  }));

  return router;
}
