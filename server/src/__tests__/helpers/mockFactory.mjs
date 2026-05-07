/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Wraps a mock object so it satisfies both named-export and default-export
 * consumption patterns used by jest.unstable_mockModule.
 *
 * @param {object} obj
 * @returns {{ [key: string]: unknown, default: object }}
 */
export function createMockModule(obj) {
  return { ...obj, default: obj };
}
