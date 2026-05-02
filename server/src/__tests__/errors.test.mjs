/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { LibraryNotFoundError, isLibraryNotFoundError } from '../utils/errors.mjs';

describe('errors', () => {
  test('LibraryNotFoundError sets the expected API shape', () => {
    const error = new LibraryNotFoundError(42);

    expect(error.message).toBe('Library not found: 42');
    expect(error.name).toBe('LibraryNotFoundError');
    expect(error.statusCode).toBe(404);
    expect(error.libraryId).toBe(42);
    expect(error.toJSON()).toEqual({ error: 'Library not found' });
  });

  test('isLibraryNotFoundError recognizes the class and compatible shapes', () => {
    expect(isLibraryNotFoundError(new LibraryNotFoundError(42))).toBe(true);
    expect(isLibraryNotFoundError({ name: 'LibraryNotFoundError' })).toBe(true);
    expect(isLibraryNotFoundError({ statusCode: 404 })).toBe(true);
    expect(isLibraryNotFoundError(new Error('other'))).toBe(false);
  });
});