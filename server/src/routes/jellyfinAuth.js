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
const jellyfinAuth = require('../services/jellyfinAuth');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/jellyfin/test:
 *   post:
 *     summary: Test connection to a Jellyfin server
 *     tags: [Jellyfin Auth]
 */
router.post('/test', async (req, res) => {
    try {
        const { serverUrl } = req.body;

        if (!serverUrl) {
            return res.status(400).json({ error: 'serverUrl is required' });
        }

        const result = await jellyfinAuth.testConnection(serverUrl);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/jellyfin/quick-connect/enabled:
 *   post:
 *     summary: Check if Quick Connect is enabled on the server
 *     tags: [Jellyfin Auth]
 */
router.post('/quick-connect/enabled', async (req, res) => {
    try {
        const { serverUrl } = req.body;

        if (!serverUrl) {
            return res.status(400).json({ error: 'serverUrl is required' });
        }

        const enabled = await jellyfinAuth.isQuickConnectEnabled(serverUrl);
        res.json({ enabled });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/jellyfin/quick-connect/initiate:
 *   post:
 *     summary: Initiate a Quick Connect session
 *     tags: [Jellyfin Auth]
 */
router.post('/quick-connect/initiate', async (req, res) => {
    try {
        const { serverUrl } = req.body;

        if (!serverUrl) {
            return res.status(400).json({ error: 'serverUrl is required' });
        }

        const result = await jellyfinAuth.initiateQuickConnect(serverUrl);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/jellyfin/quick-connect/check:
 *   post:
 *     summary: Check Quick Connect session status
 *     tags: [Jellyfin Auth]
 */
router.post('/quick-connect/check', async (req, res) => {
    try {
        const { serverUrl, secret } = req.body;

        if (!serverUrl || !secret) {
            return res.status(400).json({ error: 'serverUrl and secret are required' });
        }

        const result = await jellyfinAuth.checkQuickConnect(serverUrl, secret);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/jellyfin/quick-connect/authenticate:
 *   post:
 *     summary: Exchange Quick Connect secret for access token
 *     tags: [Jellyfin Auth]
 */
router.post('/quick-connect/authenticate', async (req, res) => {
    try {
        const { serverUrl, secret } = req.body;

        if (!serverUrl || !secret) {
            return res.status(400).json({ error: 'serverUrl and secret are required' });
        }

        const result = await jellyfinAuth.authenticateWithQuickConnect(serverUrl, secret);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/jellyfin/authenticate:
 *   post:
 *     summary: Authenticate with username and password
 *     tags: [Jellyfin Auth]
 */
router.post('/authenticate', async (req, res) => {
    try {
        const { serverUrl, username, password } = req.body;

        if (!serverUrl || !username) {
            return res.status(400).json({ error: 'serverUrl and username are required' });
        }

        const result = await jellyfinAuth.authenticateWithPassword(serverUrl, username, password || '');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/jellyfin/save:
 *   post:
 *     summary: Save Jellyfin server configuration
 *     tags: [Jellyfin Auth]
 */
router.post('/save', async (req, res) => {
    try {
        const { serverUrl, token, serverName } = req.body;

        if (!serverUrl || !token) {
            return res.status(400).json({ error: 'serverUrl and token are required' });
        }

        // Get server info for the name if not provided
        let name = serverName;
        if (!name) {
            const info = await jellyfinAuth.getServerInfo(serverUrl, token);
            name = info.success ? info.serverName : 'Jellyfin Server';
        }

        // Deactivate existing servers
        await db.query('UPDATE media_server SET is_active = false');

        // Insert new server
        const result = await db.query(
            `INSERT INTO media_server (type, name, url, api_key, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, type, name, url, is_active, created_at`,
            ['jellyfin', name, serverUrl, token]
        );

        res.json({
            success: true,
            server: result.rows[0],
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
