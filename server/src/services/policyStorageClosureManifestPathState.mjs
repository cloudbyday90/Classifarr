/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function buildManifestPathState({
  manifestPaths = [],
  fileExists = () => false,
} = {}) {
  const normalizedManifestPaths = asArray(manifestPaths)
    .map(normalizePath)
    .filter(Boolean);
  const existingPaths = [];
  const removedPaths = [];

  normalizedManifestPaths.forEach(repositoryPath => {
    if (fileExists(repositoryPath)) {
      existingPaths.push(repositoryPath);
    } else {
      removedPaths.push(repositoryPath);
    }
  });

  return {
    totalCount: normalizedManifestPaths.length,
    existingCount: existingPaths.length,
    removedCount: removedPaths.length,
    manifestPaths: normalizedManifestPaths,
    existingPaths,
    removedPaths,
  };
}

export {
  buildManifestPathState,
};
