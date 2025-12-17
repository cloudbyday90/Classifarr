const axios = require('axios');

class OllamaService {
  constructor() {
    this.host = process.env.OLLAMA_HOST || 'host.docker.internal';
    this.port = process.env.OLLAMA_PORT || 11434;
    this.baseUrl = `http://${this.host}:${this.port}`;
  }

  async testConnection(host, port) {
    const testHost = host || this.host;
    const testPort = port || this.port;
    const testUrl = `http://${testHost}:${testPort}`;
    
    try {
      const response = await axios.get(`${testUrl}/api/version`, {
        timeout: 5000,
      });
      return { success: true, version: response.data.version || 'unknown' };
    } catch (error) {
      // If version endpoint doesn't exist, try tags endpoint
      try {
        await axios.get(`${testUrl}/api/tags`, {
          timeout: 5000,
        });
        return { success: true, version: 'connected' };
      } catch (err) {
        return { success: false, error: error.message };
      }
    }
  }

  async getModels(host, port) {
    try {
      const testHost = host || this.host;
      const testPort = port || this.port;
      const testUrl = `http://${testHost}:${testPort}`;
      
      const response = await axios.get(`${testUrl}/api/tags`);
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
