/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Backfill utility functions
 * Shared helpers for backfill configuration parsing and formatting
 */

/**
 * Parse days configuration from string to array of integers
 * @param {string|Array} days - Days as comma-separated string or array
 * @returns {Array<number>} Array of day numbers (0=Sunday, 6=Saturday)
 */
export function parseDaysConfig(days) {
  if (!days) {
    return [0, 1, 2, 3, 4, 5, 6]; // Default: all days
  }
  
  if (Array.isArray(days)) {
    return days.map(d => parseInt(d));
  }
  
  if (typeof days === 'string') {
    return days.split(',').map(d => parseInt(d));
  }
  
  return [0, 1, 2, 3, 4, 5, 6];
}

/**
 * Format days array to comma-separated string for database storage
 * @param {Array<number>} days - Array of day numbers
 * @returns {string} Comma-separated string
 */
export function formatDaysConfig(days) {
  if (!days || !Array.isArray(days)) {
    return '0,1,2,3,4,5,6';
  }
  return days.join(',');
}
