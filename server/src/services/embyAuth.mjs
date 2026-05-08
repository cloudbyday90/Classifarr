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

import { httpGet, httpPost } from '../utils/httpClient.mjs';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('embyAuth');

let deviceId = null;
const getDeviceId = () => {
  if (!deviceId) {
    deviceId = randomUUID();
  }
  return deviceId;
};

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

export class EmbyAuthService {
  async testConnection(serverUrl) {
    try {
      const url = serverUrl.replace(/\/$/, '');
      const response = await httpGet(`${url}/System/Info/Public`, {
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

  async authenticateWithPassword(serverUrl, username, password = '') {
    try {
      const url = serverUrl.replace(/\/$/, '');

      const response = await httpPost(
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
      logger.error('Failed to authenticate with Emby:', { error: error.message });

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

  async getServerInfo(serverUrl, token) {
    try {
      const url = serverUrl.replace(/\/$/, '');

      const response = await httpGet(
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

  async verifyToken(serverUrl, token) {
    try {
      const url = serverUrl.replace(/\/$/, '');

      await httpGet(
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

  async getUsers(serverUrl, token) {
    try {
      const url = serverUrl.replace(/\/$/, '');

      const response = await httpGet(
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

export const embyAuthService = new EmbyAuthService();
