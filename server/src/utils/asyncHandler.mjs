/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function asyncHandler(fn) {
  return (req, res, next) => {
    try {
      const result = fn(req, res, next);
      return Promise.resolve(result).catch(next);
    } catch (err) {
      next(err);
    }
  };
}
