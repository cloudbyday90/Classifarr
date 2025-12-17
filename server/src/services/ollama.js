const axios = require('axios');

class OllamaService {
  constructor() {
    this.host = process.env.OLLAMA_HOST || 'host.docker.internal';
    this.port = process.env.OLLAMA_PORT || 11434;
    this.baseUrl = `http://${this.host}:${this.port}`;
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      return { success: true, models: response.data.models, version: response.data.version };
    } catch (error) {
      let code = 'CONNECTION_ERROR';
      let message = error.message;
      
      if (error.code === 'ECONNREFUSED') {
        code = 'ECONNREFUSED';
        message = 'Connection refused - Ollama may not be running';
      } else if (error.code === 'ETIMEDOUT') {
        code = 'ETIMEDOUT';
        message = 'Connection timed out';
      }
      
      return { success: false, error: message, code };
    }
  }

  async getModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      throw new Error(`Failed to fetch models: ${error.message}`);
    }
  }

  async generate(prompt, model = 'qwen3:14b', temperature = 0.30) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
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
