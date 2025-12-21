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

const axios = require('axios');
const crypto = require('crypto');

// Classifarr identification headers for Jellyfin API
const getJellyfinHeaders = (token = null) => {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Emby-Authorization': `MediaBrowser Client="Classifarr", Device="Server", DeviceId="${getDeviceId()}", Version="1.0.0"`,
    };

    if (token) {
        headers['X-Emby-Authorization'] += `, Token="${token}"`;
    }

    return headers;
};

// Generate or get a consistent device ID
let deviceId = null;
const getDeviceId = () => {
    if (!deviceId) {
        deviceId = crypto.randomUUID();
    }
    return deviceId;
};

class JellyfinAuthService {
    /**
     * Test connection to a Jellyfin server (no auth required)
     * @param {string} serverUrl - The Jellyfin server URL
     */
    async testConnection(serverUrl) {
        try {
            const url = serverUrl.replace(/\/$/, '');
            const response = await axios.get(`${url}/System/Info/Public`, {
                headers: { 'Accept': 'application/json' },
                timeout: 10000,
            });

            return {
                success: true,
                serverName: response.data.ServerName,
                version: response.data.Version,
                id: response.data.Id,
                startupWizardCompleted: response.data.StartupWizardCompleted,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Check if Quick Connect is enabled on the server
     * @param {string} serverUrl - The Jellyfin server URL
     */
    async isQuickConnectEnabled(serverUrl) {
        try {
            const url = serverUrl.replace(/\/$/, '');
            const response = await axios.get(`${url}/QuickConnect/Enabled`, {
                headers: getJellyfinHeaders(),
                timeout: 5000,
            });

            return response.data === true;
        } catch (error) {
            console.error('Failed to check Quick Connect status:', error.message);
            return false;
        }
    }

    /**
     * Initiate a Quick Connect session
     * @param {string} serverUrl - The Jellyfin server URL
     * @returns {Object} { code, secret }
     */
    async initiateQuickConnect(serverUrl) {
        try {
            const url = serverUrl.replace(/\/$/, '');

            const response = await axios.post(
                `${url}/QuickConnect/Initiate`,
                null,
                {
                    headers: getJellyfinHeaders(),
                    timeout: 10000,
                }
            );

            return {
                success: true,
                code: response.data.Code,
                secret: response.data.Secret,
            };
        } catch (error) {
            console.error('Failed to initiate Quick Connect:', error.message);
            return {
                success: false,
                error: error.response?.data?.Message || error.message,
            };
        }
    }

    /**
     * Check the status of a Quick Connect session
     * @param {string} serverUrl - The Jellyfin server URL
     * @param {string} secret - The Quick Connect secret
     */
    async checkQuickConnect(serverUrl, secret) {
        try {
            const url = serverUrl.replace(/\/$/, '');

            const response = await axios.get(
                `${url}/QuickConnect/Connect`,
                {
                    params: { secret },
                    headers: getJellyfinHeaders(),
                    timeout: 5000,
                }
            );

            return {
                authenticated: response.data.Authenticated === true,
                secret: response.data.Secret,
            };
        } catch (error) {
            return {
                authenticated: false,
                error: error.message,
            };
        }
    }

    /**
     * Exchange Quick Connect secret for an access token
     * @param {string} serverUrl - The Jellyfin server URL  
     * @param {string} secret - The Quick Connect secret
     */
    async authenticateWithQuickConnect(serverUrl, secret) {
        try {
            const url = serverUrl.replace(/\/$/, '');

            const response = await axios.post(
                `${url}/Users/AuthenticateWithQuickConnect`,
                { Secret: secret },
                {
                    headers: getJellyfinHeaders(),
                    timeout: 10000,
                }
            );

            return {
                success: true,
                accessToken: response.data.AccessToken,
                userId: response.data.User?.Id,
                username: response.data.User?.Name,
                serverId: response.data.ServerId,
            };
        } catch (error) {
            console.error('Failed to authenticate with Quick Connect:', error.message);
            return {
                success: false,
                error: error.response?.data?.Message || error.message,
            };
        }
    }

    /**
     * Authenticate with username and password (fallback)
     * @param {string} serverUrl - The Jellyfin server URL
     * @param {string} username - Username
     * @param {string} password - Password
     */
    async authenticateWithPassword(serverUrl, username, password) {
        try {
            const url = serverUrl.replace(/\/$/, '');

            const response = await axios.post(
                `${url}/Users/AuthenticateByName`,
                {
                    Username: username,
                    Pw: password,
                },
                {
                    headers: getJellyfinHeaders(),
                    timeout: 10000,
                }
            );

            return {
                success: true,
                accessToken: response.data.AccessToken,
                userId: response.data.User?.Id,
                username: response.data.User?.Name,
                serverId: response.data.ServerId,
                isAdmin: response.data.User?.Policy?.IsAdministrator,
            };
        } catch (error) {
            console.error('Failed to authenticate with password:', error.message);
            return {
                success: false,
                error: error.response?.data?.Message || error.message || 'Authentication failed',
            };
        }
    }

    /**
     * Get server info with an authenticated token
     * @param {string} serverUrl - The Jellyfin server URL
     * @param {string} token - Access token
     */
    async getServerInfo(serverUrl, token) {
        try {
            const url = serverUrl.replace(/\/$/, '');

            const response = await axios.get(
                `${url}/System/Info`,
                {
                    headers: getJellyfinHeaders(token),
                    timeout: 10000,
                }
            );

            return {
                success: true,
                serverName: response.data.ServerName,
                version: response.data.Version,
                id: response.data.Id,
                operatingSystem: response.data.OperatingSystem,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Verify a token is still valid
     * @param {string} serverUrl - The Jellyfin server URL
     * @param {string} token - Access token
     */
    async verifyToken(serverUrl, token) {
        try {
            const url = serverUrl.replace(/\/$/, '');

            await axios.get(
                `${url}/System/Info`,
                {
                    headers: getJellyfinHeaders(token),
                    timeout: 5000,
                }
            );

            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
}

module.exports = new JellyfinAuthService();
