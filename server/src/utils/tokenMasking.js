/**
 * Mask a token/API key for display purposes
 * Shows 8 dots followed by the last 4 characters
 * @param {string} token - The token to mask
 * @returns {string} - Masked token (e.g., "••••••••xyz1")
 */
function maskToken(token) {
  if (!token || typeof token !== 'string') {
    return '';
  }
  
  if (token.length <= 4) {
    return '••••••••';
  }
  
  const lastFour = token.slice(-4);
  return `••••••••${lastFour}`;
}

/**
 * Check if a token appears to be masked
 * @param {string} token - The token to check
 * @returns {boolean} - True if the token appears to be masked
 */
function isMaskedToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  return token.startsWith('••••••••');
}

module.exports = {
  maskToken,
  isMaskedToken,
};
