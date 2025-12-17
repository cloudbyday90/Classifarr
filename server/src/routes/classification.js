const express = require('express');
const router = express.Router();

/**
 * @openapi
 * /api/classify:
 *   post:
 *     summary: Classify a media item
 *     description: Webhook endpoint to classify a media item using AI
 *     tags: [Classification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mediaId
 *               - title
 *               - type
 *             properties:
 *               mediaId:
 *                 type: string
 *               title:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [movie, tv]
 *               year:
 *                 type: number
 *               tmdbId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Classification result
 *       400:
 *         description: Invalid request
 */
router.post('/classify', async (req, res) => {
  try {
    const { mediaId, title, type, year, tmdbId } = req.body;
    
    if (!mediaId || !title || !type) {
      return res.status(400).json({ error: 'Missing required fields: mediaId, title, type' });
    }

    // TODO: Implement classification logic
    // 1. Fetch media details from TMDB if tmdbId provided
    // 2. Get library definitions and rules
    // 3. Call Ollama AI service for classification
    // 4. Apply classification to media server
    // 5. Log result to history
    
    res.json({
      success: true,
      mediaId,
      classification: 'pending',
      message: 'Classification queued',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/history:
 *   get:
 *     summary: Get classification history
 *     description: Retrieves the classification history with pagination
 *     tags: [Classification]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: libraryId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Classification history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: number
 *                 page:
 *                   type: number
 *                 limit:
 *                   type: number
 */
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 50, libraryId } = req.query;
    
    // TODO: Fetch from database with pagination
    res.json({
      items: [],
      total: 0,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/corrections:
 *   post:
 *     summary: Submit a correction
 *     description: Submits a correction for an AI classification
 *     tags: [Classification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - classificationId
 *               - correctLibrary
 *             properties:
 *               classificationId:
 *                 type: string
 *               correctLibrary:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Correction submitted successfully
 */
router.post('/corrections', async (req, res) => {
  try {
    const { classificationId, correctLibrary, reason } = req.body;
    
    if (!classificationId || !correctLibrary) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Save correction to database
    // This will be used to improve future classifications
    
    res.json({
      success: true,
      message: 'Correction submitted',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
