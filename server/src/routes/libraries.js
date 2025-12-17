const express = require('express');
const router = express.Router();

/**
 * @openapi
 * /api/libraries:
 *   get:
 *     summary: List all libraries
 *     description: Retrieves all media libraries from the database
 *     tags: [Libraries]
 *     responses:
 *       200:
 *         description: List of libraries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   type:
 *                     type: string
 *                   path:
 *                     type: string
 */
router.get('/', async (req, res) => {
  try {
    // TODO: Fetch from database
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/libraries/{id}:
 *   get:
 *     summary: Get a single library
 *     description: Retrieves details of a specific library by ID
 *     tags: [Libraries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Library ID
 *     responses:
 *       200:
 *         description: Library details
 *       404:
 *         description: Library not found
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Fetch from database
    res.json({
      id,
      name: 'Example Library',
      type: 'movie',
      path: '/media/movies',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/libraries/{id}:
 *   put:
 *     summary: Update library settings
 *     description: Updates the settings for a specific library
 *     tags: [Libraries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Library ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               autoClassify:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Library updated successfully
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // TODO: Update in database
    res.json({
      success: true,
      message: 'Library settings updated',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/libraries/{id}/rules:
 *   post:
 *     summary: Update classification rules
 *     description: Updates the classification rules for a specific library
 *     tags: [Libraries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Library ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rules:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Classification rules updated successfully
 */
router.post('/:id/rules', async (req, res) => {
  try {
    const { id } = req.params;
    const { rules } = req.body;
    
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ error: 'Invalid rules format' });
    }

    // TODO: Update rules in database
    res.json({
      success: true,
      message: 'Classification rules updated',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
