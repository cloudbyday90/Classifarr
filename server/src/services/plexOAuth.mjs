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

import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('plexOAuth');

const PLEX_TV_API = 'https://plex.tv/api/v2';
const PLEX_AUTH_URL = 'https://app.plex.tv/auth';

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
    this.clientIdentifier = null;
  }

  getClientIdentifier() {
    if (!this.clientIdentifier) {
      this.clientIdentifier = randomUUID();
    }
    return this.clientIdentifier;
  }

  setClientIdentifier(identifier) {
    this.clientIdentifier = identifier;
  }

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

      const authUrl = `${PLEX_AUTH_URL}#?clientID=${clientId}&code=${code}&context%5Bdevice%5D%5Bproduct%5D=Classifarr`;

      return {
        id,
        code,
        clientId,
        authUrl,
      };
    } catch (error) {
      logger.error('Failed to create Plex PIN:', { error: error.message });
      throw new Error(`Failed to create Plex PIN: ${error.message}`);
    }
  }

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
      logger.error('Failed to check Plex PIN:', { error: error.message });
      throw new Error(`Failed to check Plex PIN: ${error.message}`);
    }
  }

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
      logger.error('Failed to get Plex user:', { error: error.message });
      throw new Error(`Failed to get Plex user: ${error.message}`);
    }
  }

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
          preferredConnection: this.getPreferredConnection(server.connections),
        }));

      return servers;
    } catch (error) {
      logger.error('Failed to get Plex servers:', { error: error.message });
      throw new Error(`Failed to get Plex servers: ${error.message}`);
    }
  }

  getPreferredConnection(connections) {
    if (!connections || connections.length === 0) {
      return null;
    }

    const sorted = [...connections].sort((a, b) => {
      if (a.relay !== b.relay) return a.relay ? 1 : -1;
      if (a.local !== b.local) return a.local ? -1 : 1;
      if (a.protocol !== b.protocol) return a.protocol === 'https' ? -1 : 1;
      return 0;
    });

    return sorted[0];
  }

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

  async findWorkingConnection(server) {
    const connections = server.connections || [];
    const token = server.accessToken;

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

const instance = new PlexOAuthService();
export default instance;
export { PlexOAuthService };
