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
 * Custom error classes for Classifarr
 */

/**
 * Error thrown when a library is not found
 */
class LibraryNotFoundError extends Error {
  constructor(libraryId) {
    super(`Library not found: ${libraryId}`);
    this.name = 'LibraryNotFoundError';
    this.statusCode = 404;
    this.libraryId = libraryId;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LibraryNotFoundError);
    }
  }

  /**
   * Convert error to JSON format for API responses
   * Follows codebase convention of simple { error: "message" } format
   */
  toJSON() {
    return {
      error: 'Library not found'
    };
  }
}

module.exports = {
  LibraryNotFoundError
};
