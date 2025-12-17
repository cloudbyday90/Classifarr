const axios = require('axios');

/**
 * Ollama AI Service
 * Provides methods to interact with Ollama for AI classification
 */

/**
 * Test connection to Ollama
 * @param {string} host - Ollama hostname/IP
 * @param {number} port - Ollama port
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection(host, port) {
  try {
    const url = `http://${host}:${port}/api/tags`;
    const response = await axios.get(url, {
      timeout: 5000,
    });
    
    return response.status === 200 && response.data;
  } catch (error) {
    console.error('Ollama connection test failed:', error.message);
    return false;
  }
}

/**
 * Get available models from Ollama
 * @param {string} host - Ollama hostname/IP
 * @param {number} port - Ollama port
 * @returns {Promise<Array>} Array of available models
 */
async function getModels(host, port) {
  try {
    const url = `http://${host}:${port}/api/tags`;
    const response = await axios.get(url, {
      timeout: 5000,
    });
    
    return response.data?.models || [];
  } catch (error) {
    console.error('Failed to get Ollama models:', error.message);
    throw new Error(`Failed to retrieve Ollama models: ${error.message}`);
  }
}

/**
 * Classify media using Ollama AI
 * @param {string} host - Ollama hostname/IP
 * @param {number} port - Ollama port
 * @param {string} model - Model name to use
 * @param {Object} mediaData - Media metadata to classify
 * @param {Array} libraryDefinitions - Available library definitions
 * @param {Array} pastCorrections - Previous corrections for learning
 * @returns {Promise<Object>} Classification result
 */
async function classify(host, port, model, mediaData, libraryDefinitions, pastCorrections = []) {
  try {
    // Build the prompt for classification
    const prompt = buildClassificationPrompt(mediaData, libraryDefinitions, pastCorrections);
    
    const url = `http://${host}:${port}/api/generate`;
    const response = await axios.post(
      url,
      {
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more consistent results
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds for AI processing
      }
    );
    
    // Parse the AI response to extract classification
    const aiResponse = response.data?.response || '';
    return parseClassificationResponse(aiResponse, libraryDefinitions);
  } catch (error) {
    console.error('Failed to classify with Ollama:', error.message);
    throw new Error(`Failed to classify media: ${error.message}`);
  }
}

/**
 * Build the classification prompt
 * @param {Object} mediaData - Media metadata
 * @param {Array} libraryDefinitions - Available libraries
 * @param {Array} pastCorrections - Previous corrections
 * @returns {string} Classification prompt
 */
function buildClassificationPrompt(mediaData, libraryDefinitions, pastCorrections) {
  let prompt = `You are a media classification assistant. Your task is to classify the following media item into one of the available libraries.\n\n`;
  
  prompt += `Media Information:\n`;
  prompt += `Title: ${mediaData.title}\n`;
  prompt += `Type: ${mediaData.type}\n`;
  if (mediaData.year) prompt += `Year: ${mediaData.year}\n`;
  if (mediaData.genres) prompt += `Genres: ${mediaData.genres.join(', ')}\n`;
  if (mediaData.keywords) prompt += `Keywords: ${mediaData.keywords.join(', ')}\n`;
  if (mediaData.overview) prompt += `Overview: ${mediaData.overview}\n`;
  
  prompt += `\nAvailable Libraries:\n`;
  libraryDefinitions.forEach(lib => {
    prompt += `- ${lib.name}: ${lib.description || 'No description'}\n`;
    if (lib.rules && lib.rules.length > 0) {
      prompt += `  Rules: ${lib.rules.join('; ')}\n`;
    }
  });
  
  if (pastCorrections && pastCorrections.length > 0) {
    prompt += `\nPast Corrections (learn from these):\n`;
    pastCorrections.slice(-10).forEach(correction => {
      prompt += `- "${correction.title}" was corrected to library "${correction.correctLibrary}"\n`;
    });
  }
  
  prompt += `\nRespond with ONLY the library name that best matches this media item.`;
  
  return prompt;
}

/**
 * Parse the AI classification response
 * @param {string} aiResponse - Raw AI response
 * @param {Array} libraryDefinitions - Available libraries
 * @returns {Object} Parsed classification
 */
function parseClassificationResponse(aiResponse, libraryDefinitions) {
  // Extract the library name from the response
  const cleanedResponse = aiResponse.trim();
  
  // Find matching library
  const matchedLibrary = libraryDefinitions.find(lib => 
    cleanedResponse.toLowerCase().includes(lib.name.toLowerCase())
  );
  
  if (matchedLibrary) {
    return {
      library: matchedLibrary.name,
      libraryId: matchedLibrary.id,
      confidence: 'high',
      reasoning: aiResponse,
    };
  }
  
  // If no match found, return the first library with low confidence
  return {
    library: libraryDefinitions[0]?.name || 'unknown',
    libraryId: libraryDefinitions[0]?.id || null,
    confidence: 'low',
    reasoning: aiResponse,
  };
}

module.exports = {
  testConnection,
  getModels,
  classify,
};
