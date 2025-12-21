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

const PLEX_TV_API = 'https://plex.tv/api/v2';
const PLEX_AUTH_URL = 'https://app.plex.tv/auth';

// Classifarr identification headers for Plex API
const PLEX_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Plex-Product': 'Classifarr',
    'X-Plex-Version': '1.0.0',
    'X-Plex-Platform': 'Web',
    'X-Plex-Platform-Version': '1.0.0',
    'X-Plex-Device': 'Classifarr',
    'X-Plex-Device-Name': 'Classifarr Media Classifier',
};

class PlexOAuthService {
    constructor() {
        // Generate a unique client identifier for this installation
        this.clientIdentifier = null;
    }

    /**
     * Get or generate a unique client identifier for this Classifarr installation
     */
    getClientIdentifier() {
        if (!this.clientIdentifier) {
            // Generate a unique identifier - in production, this should be persisted
            this.clientIdentifier = crypto.randomUUID();
        }
        return this.clientIdentifier;
    }

    /**
     * Set a specific client identifier (called on startup with persisted value)
     */
    setClientIdentifier(identifier) {
        this.clientIdentifier = identifier;
    }

    /**
     * Create a new PIN for Plex OAuth authentication
     * @returns {Object} { id, code, authUrl }
     */
    async createPin() {
        try {
            const clientId = this.getClientIdentifier();

            const response = await axios.post(
                `${PLEX_TV_API}/pins`,
                { strong: true },
                {
                    headers: {
                        ...PLEX_HEADERS,
                        'X-Plex-Client-Identifier': clientId,
                    },
                }
            );

            const { id, code } = response.data;

            // Construct the auth URL for the user
            const authUrl = `${PLEX_AUTH_URL}#?clientID=${clientId}&code=${code}&context%5Bdevice%5D%5Bproduct%5D=Classifarr`;

            return {
                id,
                code,
                clientId,
                authUrl,
            };
        } catch (error) {
            console.error('Failed to create Plex PIN:', error.message);
            throw new Error(`Failed to create Plex PIN: ${error.message}`);
        }
    }

    /**
     * Check the status of a PIN and retrieve the auth token if available
     * @param {number} pinId - The PIN ID to check
     * @returns {Object} { authenticated, authToken }
     */
    async checkPin(pinId) {
        try {
            const clientId = this.getClientIdentifier();

            const response = await axios.get(
                `${PLEX_TV_API}/pins/${pinId}`,
                {
                    headers: {
                        ...PLEX_HEADERS,
                        'X-Plex-Client-Identifier': clientId,
                    },
                }
            );

            const { authToken } = response.data;

            return {
                authenticated: !!authToken,
                authToken: authToken || null,
            };
        } catch (error) {
            console.error('Failed to check Plex PIN:', error.message);
            throw new Error(`Failed to check Plex PIN: ${error.message}`);
        }
    }

    /**
     * Get user information from Plex.tv using an auth token
     * @param {string} authToken - The Plex auth token
     * @returns {Object} User information
     */
    async getUser(authToken) {
        try {
            const clientId = this.getClientIdentifier();

            const response = await axios.get(
                `${PLEX_TV_API}/user`,
                {
                    headers: {
                        ...PLEX_HEADERS,
                        'X-Plex-Client-Identifier': clientId,
                        'X-Plex-Token': authToken,
                    },
                }
            );

            return {
                id: response.data.id,
                uuid: response.data.uuid,
                username: response.data.username,
                email: response.data.email,
                thumb: response.data.thumb,
                title: response.data.title,
            };
        } catch (error) {
            console.error('Failed to get Plex user:', error.message);
            throw new Error(`Failed to get Plex user: ${error.message}`);
        }
    }

    /**
     * Get available Plex servers for the authenticated user
     * @param {string} authToken - The Plex auth token
     * @returns {Array} List of available servers
     */
    async getServers(authToken) {
        try {
            const clientId = this.getClientIdentifier();

            const response = await axios.get(
                `${PLEX_TV_API}/resources`,
                {
                    headers: {
                        ...PLEX_HEADERS,
                        'X-Plex-Client-Identifier': clientId,
                        'X-Plex-Token': authToken,
                    },
                    params: {
                        includeHttps: 1,
                        includeRelay: 1,
                    },
                }
            );

            // Filter to only Plex Media Server devices
            const servers = response.data
                .filter(resource => resource.provides === 'server')
                .map(server => ({
                    name: server.name,
                    clientIdentifier: server.clientIdentifier,
                    owned: server.owned,
                    accessToken: server.accessToken,
                    connections: server.connections.map(conn => ({
                        uri: conn.uri,
                        protocol: conn.protocol,
                        address: conn.address,
                        port: conn.port,
                        local: conn.local,
                        relay: conn.relay,
                    })),
                    // Get the best connection URL (prefer local, non-relay)
                    preferredConnection: this.getPreferredConnection(server.connections),
                }));

            return servers;
        } catch (error) {
            console.error('Failed to get Plex servers:', error.message);
            throw new Error(`Failed to get Plex servers: ${error.message}`);
        }
    }

    /**
     * Get the preferred connection URL for a server
     * Priority: Local HTTPS > Local HTTP > Remote HTTPS > Relay
     */
    getPreferredConnection(connections) {
        if (!connections || connections.length === 0) {
            return null;
        }

        // Sort by preference
        const sorted = [...connections].sort((a, b) => {
            // Prefer non-relay
            if (a.relay !== b.relay) return a.relay ? 1 : -1;
            // Prefer local
            if (a.local !== b.local) return a.local ? -1 : 1;
            // Prefer HTTPS
            if (a.protocol !== b.protocol) return a.protocol === 'https' ? -1 : 1;
            return 0;
        });

        return sorted[0];
    }

    /**
     * Test connection to a specific Plex server
     * @param {string} url - Server URL
     * @param {string} token - Access token for this server
     */
    async testServerConnection(url, token) {
        try {
            const response = await axios.get(
                `${url}/identity`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'X-Plex-Token': token,
                    },
                    timeout: 10000,
                }
            );

            return {
                success: true,
                serverName: response.data.MediaContainer?.friendlyName || 'Plex Server',
                version: response.data.MediaContainer?.version,
                machineIdentifier: response.data.MediaContainer?.machineIdentifier,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Find the best working connection for a server
     * Tests each connection and returns the first working one
     */
    async findWorkingConnection(server) {
        const connections = server.connections || [];
        const token = server.accessToken;

        // Sort connections by preference
        const sortedConnections = [...connections].sort((a, b) => {
            if (a.relay !== b.relay) return a.relay ? 1 : -1;
            if (a.local !== b.local) return a.local ? -1 : 1;
            if (a.protocol !== b.protocol) return a.protocol === 'https' ? -1 : 1;
            return 0;
        });

        for (const conn of sortedConnections) {
            const result = await this.testServerConnection(conn.uri, token);
            if (result.success) {
                return {
                    ...conn,
                    serverInfo: result,
                };
            }
        }

        return null;
    }
}

module.exports = new PlexOAuthService();
