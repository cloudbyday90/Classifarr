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

// Device ID for Emby authorization
let deviceId = null;
const getDeviceId = () => {
    if (!deviceId) {
        deviceId = crypto.randomUUID();
    }
    return deviceId;
};

// Emby authorization header format
const getEmbyHeaders = (token = null) => {
    let auth = `Emby UserId="", Client="Classifarr", Device="Server", DeviceId="${getDeviceId()}", Version="1.0.0"`;

    if (token) {
        auth += `, Token="${token}"`;
    }

    return {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Emby-Authorization': auth,
    };
};

class EmbyAuthService {
    /**
     * Test connection to an Emby server (no auth required)
     * @param {string} serverUrl - The Emby server URL
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
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Authenticate with username and password
     * @param {string} serverUrl - The Emby server URL
     * @param {string} username - Username
     * @param {string} password - Password (can be empty for no password)
     */
    async authenticateWithPassword(serverUrl, username, password = '') {
        try {
            const url = serverUrl.replace(/\/$/, '');

            const response = await axios.post(
                `${url}/Users/AuthenticateByName`,
                {
                    Username: username,
                    Pw: password,
                },
                {
                    headers: getEmbyHeaders(),
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
            console.error('Failed to authenticate with Emby:', error.message);

            // Parse error message
            let errorMessage = 'Authentication failed';
            if (error.response?.status === 401) {
                errorMessage = 'Invalid username or password';
            } else if (error.response?.data) {
                errorMessage = error.response.data.Message || error.response.data;
            } else if (error.message) {
                errorMessage = error.message;
            }

            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Get server info with an authenticated token
     * @param {string} serverUrl - The Emby server URL
     * @param {string} token - Access token
     */
    async getServerInfo(serverUrl, token) {
        try {
            const url = serverUrl.replace(/\/$/, '');

            const response = await axios.get(
                `${url}/System/Info`,
                {
                    headers: getEmbyHeaders(token),
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
     * @param {string} serverUrl - The Emby server URL
     * @param {string} token - Access token
     */
    async verifyToken(serverUrl, token) {
        try {
            const url = serverUrl.replace(/\/$/, '');

            await axios.get(
                `${url}/System/Info`,
                {
                    headers: getEmbyHeaders(token),
                    timeout: 5000,
                }
            );

            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Get list of users (requires admin token)
     * Useful for verifying connection with elevated permissions
     * @param {string} serverUrl - The Emby server URL
     * @param {string} token - Admin access token
     */
    async getUsers(serverUrl, token) {
        try {
            const url = serverUrl.replace(/\/$/, '');

            const response = await axios.get(
                `${url}/Users`,
                {
                    headers: getEmbyHeaders(token),
                    timeout: 10000,
                }
            );

            return {
                success: true,
                users: response.data.map(user => ({
                    id: user.Id,
                    name: user.Name,
                    isAdmin: user.Policy?.IsAdministrator,
                })),
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

module.exports = new EmbyAuthService();
