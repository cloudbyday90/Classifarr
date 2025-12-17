const express = require('express');
const router = express.Router();
const radarrService = require('../services/radarr');
const sonarrService = require('../services/sonarr');
const ollamaService = require('../services/ollama');

/**
 * @openapi
 * /api/settings:
 *   get:
 *     summary: Get all settings
 *     description: Retrieves all application settings
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Application settings
 */
router.get('/', async (req, res) => {
  try {
    // TODO: Fetch from database
    res.json({
      general: {},
      radarr: {},
      sonarr: {},
      ollama: {},
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/settings:
 *   put:
 *     summary: Update settings
 *     description: Updates application settings
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.put('/', async (req, res) => {
  try {
    const settings = req.body;
    // TODO: Update in database
    res.json({
      success: true,
      message: 'Settings updated',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/settings/radarr:
 *   get:
 *     summary: Get Radarr configuration
 *     description: Retrieves the Radarr configuration
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Radarr configuration
 */
router.get('/radarr', async (req, res) => {
  try {
    // TODO: Fetch from database
    res.json({
      host: null,
      port: null,
      apiKey: null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/settings/radarr:
 *   post:
 *     summary: Save Radarr configuration
 *     description: Saves the Radarr configuration
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - host
 *               - port
 *               - apiKey
 *             properties:
 *               host:
 *                 type: string
 *               port:
 *                 type: number
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Configuration saved successfully
 */
router.post('/radarr', async (req, res) => {
  try {
    const { host, port, apiKey } = req.body;
    
    if (!host || !port || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Save to database
    res.json({
      success: true,
      message: 'Radarr configuration saved',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/settings/radarr/test:
 *   post:
 *     summary: Test Radarr connection
 *     description: Tests the connection to Radarr
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - host
 *               - port
 *               - apiKey
 *             properties:
 *               host:
 *                 type: string
 *               port:
 *                 type: number
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connection test result
 */
router.post('/radarr/test', async (req, res) => {
  try {
    const { host, port, apiKey } = req.body;
    
    if (!host || !port || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await radarrService.testConnection(host, port, apiKey);
    
    res.json({
      success: result,
      message: result ? 'Connection successful' : 'Connection failed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @openapi
 * /api/settings/sonarr:
 *   get:
 *     summary: Get Sonarr configuration
 *     description: Retrieves the Sonarr configuration
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Sonarr configuration
 */
router.get('/sonarr', async (req, res) => {
  try {
    // TODO: Fetch from database
    res.json({
      host: null,
      port: null,
      apiKey: null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/settings/sonarr:
 *   post:
 *     summary: Save Sonarr configuration
 *     description: Saves the Sonarr configuration
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - host
 *               - port
 *               - apiKey
 *             properties:
 *               host:
 *                 type: string
 *               port:
 *                 type: number
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Configuration saved successfully
 */
router.post('/sonarr', async (req, res) => {
  try {
    const { host, port, apiKey } = req.body;
    
    if (!host || !port || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Save to database
    res.json({
      success: true,
      message: 'Sonarr configuration saved',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/settings/sonarr/test:
 *   post:
 *     summary: Test Sonarr connection
 *     description: Tests the connection to Sonarr
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - host
 *               - port
 *               - apiKey
 *             properties:
 *               host:
 *                 type: string
 *               port:
 *                 type: number
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connection test result
 */
router.post('/sonarr/test', async (req, res) => {
  try {
    const { host, port, apiKey } = req.body;
    
    if (!host || !port || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await sonarrService.testConnection(host, port, apiKey);
    
    res.json({
      success: result,
      message: result ? 'Connection successful' : 'Connection failed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @openapi
 * /api/settings/ollama:
 *   get:
 *     summary: Get Ollama configuration
 *     description: Retrieves the Ollama configuration
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Ollama configuration
 */
router.get('/ollama', async (req, res) => {
  try {
    // TODO: Fetch from database
    res.json({
      host: null,
      port: null,
      model: null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/settings/ollama:
 *   post:
 *     summary: Save Ollama configuration
 *     description: Saves the Ollama configuration
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - host
 *               - port
 *             properties:
 *               host:
 *                 type: string
 *               port:
 *                 type: number
 *               model:
 *                 type: string
 *     responses:
 *       200:
 *         description: Configuration saved successfully
 */
router.post('/ollama', async (req, res) => {
  try {
    const { host, port, model } = req.body;
    
    if (!host || !port) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Save to database
    res.json({
      success: true,
      message: 'Ollama configuration saved',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/settings/ollama/test:
 *   post:
 *     summary: Test Ollama connection
 *     description: Tests the connection to Ollama
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - host
 *               - port
 *             properties:
 *               host:
 *                 type: string
 *               port:
 *                 type: number
 *     responses:
 *       200:
 *         description: Connection test result
 */
router.post('/ollama/test', async (req, res) => {
  try {
    const { host, port } = req.body;
    
    if (!host || !port) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await ollamaService.testConnection(host, port);
    
    res.json({
      success: result,
      message: result ? 'Connection successful' : 'Connection failed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
