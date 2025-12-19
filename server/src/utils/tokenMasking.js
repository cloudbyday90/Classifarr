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
  
  // Always return consistent mask format to avoid revealing token length
  if (token.length <= 4) {
    return '••••••••••••';
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
