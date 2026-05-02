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

export function createConfidenceRouter({
  express,
  confidenceCalculator,
  signalTypes,
  logger,
}) {
  const router = express.Router();

  router.get('/weights', async (_req, res) => {
    try {
      await confidenceCalculator.loadWeights();

      return res.json({
        weights: confidenceCalculator.getWeights(),
        threshold: confidenceCalculator.getThreshold(),
        signalTypes,
        defaults: confidenceCalculator.getDefaultWeights(),
      });
    } catch (error) {
      logger.error('Failed to get weights', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.put('/weights', async (req, res) => {
    try {
      const { weights } = req.body;

      if (!weights || typeof weights !== 'object') {
        return res.status(400).json({ error: 'Invalid weights object' });
      }

      for (const [key, value] of Object.entries(weights)) {
        if (typeof value !== 'number' || value < 0 || value > 100) {
          return res.status(400).json({
            error: `Invalid weight for ${key}: must be a number between 0 and 100`,
          });
        }
      }

      await confidenceCalculator.saveWeights(weights);

      return res.json({
        success: true,
        weights: confidenceCalculator.getWeights(),
      });
    } catch (error) {
      logger.error('Failed to save weights', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.put('/threshold', async (req, res) => {
    try {
      const { threshold } = req.body;

      if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
        return res.status(400).json({
          error: 'Threshold must be a number between 0 and 100',
        });
      }

      await confidenceCalculator.saveThreshold(threshold);

      return res.json({
        success: true,
        threshold: confidenceCalculator.getThreshold(),
      });
    } catch (error) {
      logger.error('Failed to save threshold', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/reset', async (_req, res) => {
    try {
      const defaults = confidenceCalculator.getDefaultWeights();
      await confidenceCalculator.saveWeights(defaults);
      await confidenceCalculator.saveThreshold(80);

      return res.json({
        success: true,
        weights: defaults,
        threshold: 80,
      });
    } catch (error) {
      logger.error('Failed to reset weights', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}