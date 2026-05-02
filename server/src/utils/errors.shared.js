/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Error thrown when a library is not found.
 */
class LibraryNotFoundError extends Error {
  constructor(libraryId) {
    super(`Library not found: ${libraryId}`);
    this.name = 'LibraryNotFoundError';
    this.statusCode = 404;
    this.libraryId = libraryId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LibraryNotFoundError);
    }
  }

  toJSON() {
    return {
      error: 'Library not found',
    };
  }
}

function isLibraryNotFoundError(error) {
  return Boolean(
    error && (
      error instanceof LibraryNotFoundError ||
      error.name === 'LibraryNotFoundError' ||
      error.statusCode === 404
    )
  );
}

const errors = {
  LibraryNotFoundError,
  isLibraryNotFoundError,
};

module.exports = errors;
module.exports.LibraryNotFoundError = LibraryNotFoundError;
module.exports.isLibraryNotFoundError = isLibraryNotFoundError;
module.exports.default = errors;
