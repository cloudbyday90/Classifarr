/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const express = require('express');
const plexOAuth = require('../services/plexOAuth');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/plex/pin:
 *   post:
 *     summary: Create a Plex PIN for OAuth authentication
 *     description: Initiates the Plex OAuth flow by creating a PIN that the user will enter on plex.tv
 *     tags: [Plex OAuth]
 *     responses:
 *       200:
 *         description: PIN created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: number
 *                   description: PIN ID for polling
 *                 code:
 *                   type: string
 *                   description: PIN code (for display)
 *                 authUrl:
 *                   type: string
 *                   description: URL to redirect user to for authentication
 */
router.post('/pin', async (req, res) => {
    try {
        const pin = await plexOAuth.createPin();
        res.json(pin);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/plex/pin/{pinId}:
 *   get:
 *     summary: Check the status of a Plex PIN
 *     description: Poll this endpoint to check if the user has authenticated with the PIN
 *     tags: [Plex OAuth]
 *     parameters:
 *       - in: path
 *         name: pinId
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: PIN status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                 authToken:
 *                   type: string
 *                   nullable: true
 */
router.get('/pin/:pinId', async (req, res) => {
    try {
        const { pinId } = req.params;
        const status = await plexOAuth.checkPin(pinId);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/plex/servers:
 *   post:
 *     summary: Get available Plex servers for an authenticated user
 *     description: Returns all Plex Media Servers accessible by the authenticated user
 *     tags: [Plex OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - authToken
 *             properties:
 *               authToken:
 *                 type: string
 *                 description: Plex auth token obtained from PIN authentication
 *     responses:
 *       200:
 *         description: List of available servers
 */
router.post('/servers', async (req, res) => {
    try {
        const { authToken } = req.body;

        if (!authToken) {
            return res.status(400).json({ error: 'authToken is required' });
        }

        const servers = await plexOAuth.getServers(authToken);
        res.json({ servers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/plex/user:
 *   post:
 *     summary: Get Plex user information
 *     tags: [Plex OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - authToken
 *             properties:
 *               authToken:
 *                 type: string
 */
router.post('/user', async (req, res) => {
    try {
        const { authToken } = req.body;

        if (!authToken) {
            return res.status(400).json({ error: 'authToken is required' });
        }

        const user = await plexOAuth.getUser(authToken);
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/plex/test-connection:
 *   post:
 *     summary: Test connection to a specific Plex server
 *     tags: [Plex OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - token
 *             properties:
 *               url:
 *                 type: string
 *                 description: Server URL to test
 *               token:
 *                 type: string
 *                 description: Access token for the server
 */
router.post('/test-connection', async (req, res) => {
    try {
        const { url, token } = req.body;

        if (!url || !token) {
            return res.status(400).json({ error: 'url and token are required' });
        }

        const result = await plexOAuth.testServerConnection(url, token);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/plex/find-connection:
 *   post:
 *     summary: Find the best working connection for a server
 *     description: Tests each connection for a server and returns the first working one
 *     tags: [Plex OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - server
 *             properties:
 *               server:
 *                 type: object
 *                 description: Server object from /servers endpoint
 */
router.post('/find-connection', async (req, res) => {
    try {
        const { server } = req.body;

        if (!server) {
            return res.status(400).json({ error: 'server object is required' });
        }

        const connection = await plexOAuth.findWorkingConnection(server);

        if (connection) {
            res.json({ success: true, connection });
        } else {
            res.json({ success: false, error: 'No working connection found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/plex/save-server:
 *   post:
 *     summary: Save a Plex server configuration
 *     description: Save the selected Plex server to the database
 *     tags: [Plex OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - url
 *               - token
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *               token:
 *                 type: string
 */
router.post('/save-server', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { name, url, token } = req.body;

        if (!name || !url || !token) {
            return res.status(400).json({ error: 'name, url, and token are required' });
        }

        await client.query('BEGIN');

        // Deactivate existing servers
        await client.query('UPDATE media_server SET is_active = false');

        // Insert new server
        const result = await client.query(
            `INSERT INTO media_server (type, name, url, api_key, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, type, name, url, is_active, created_at`,
            ['plex', name, url, token]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            server: result.rows[0],
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Failed to save Plex server:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;
