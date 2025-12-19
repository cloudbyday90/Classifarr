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

class EmbyService {
  async testConnection(url, apiKey) {
    try {
      const response = await axios.get(`${url}/System/Info`, {
        headers: {
          'X-Emby-Token': apiKey,
        },
        timeout: 5000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLibraries(url, apiKey) {
    try {
      const response = await axios.get(`${url}/Library/VirtualFolders`, {
        headers: {
          'X-Emby-Token': apiKey,
        },
      });

      return response.data
        .filter(lib => lib.CollectionType === 'movies' || lib.CollectionType === 'tvshows')
        .map(lib => ({
          external_id: lib.ItemId,
          name: lib.Name,
          media_type: lib.CollectionType === 'tvshows' ? 'tv' : 'movie',
        }));
    } catch (error) {
      throw new Error(`Failed to fetch Emby libraries: ${error.message}`);
    }
  }
}

module.exports = new EmbyService();
