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
const db = require('../config/database');

class OllamaService {
  constructor() {
    this.host = null;
    this.port = null;
    this.baseUrl = null;
  }

  async getConfig() {
    if (this.baseUrl) {
      return { host: this.host, port: this.port, baseUrl: this.baseUrl };
    }

    // Try to load from database
    const result = await db.query('SELECT host, port FROM ollama_config WHERE is_active = true LIMIT 1');
    if (result.rows.length > 0) {
      this.host = result.rows[0].host;
      this.port = result.rows[0].port;
    } else {
      // Fall back to environment variables
      this.host = process.env.OLLAMA_HOST || 'host.docker.internal';
      this.port = process.env.OLLAMA_PORT || 11434;
    }

    this.baseUrl = `http://${this.host}:${this.port}`;
    return { host: this.host, port: this.port, baseUrl: this.baseUrl };
  }

  async testConnection(host = null, port = null) {
    try {
      const config = await this.getConfig();
      const testHost = host || config.host;
      const testPort = port || config.port;
      const testUrl = `http://${testHost}:${testPort}`;

      const response = await axios.get(`${testUrl}/api/tags`, {
        timeout: 5000,
      });

      return { 
        success: true, 
        models: response.data.models,
        message: 'Connection successful'
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.code === 'ECONNREFUSED' 
          ? 'Connection refused - is Ollama running?' 
          : error.message 
      };
    }
  }

  async getModels(host = null, port = null) {
    try {
      const config = await this.getConfig();
      const testHost = host || config.host;
      const testPort = port || config.port;
      const testUrl = `http://${testHost}:${testPort}`;

      const response = await axios.get(`${testUrl}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      throw new Error(`Failed to fetch models: ${error.message}`);
    }
  }

  async generate(prompt, model = 'qwen3:14b', temperature = 0.30) {
    try {
      const config = await this.getConfig();
      const response = await axios.post(`${config.baseUrl}/api/generate`, {
        model,
        prompt,
        temperature,
        stream: false,
      }, {
        timeout: 60000, // 60 second timeout for AI generation
      });
      return response.data.response;
    } catch (error) {
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }
}

module.exports = new OllamaService();
