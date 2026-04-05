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

/**
 * Canonical evidence-key normalization for classification_evidence.
 *
 * All evidence keys follow the format:  {scope}:{lowercase_value}
 * Multi-value scopes (e.g. genre array) sort values and separate with |.
 *
 * Examples:
 *   genre:documentary
 *   genre:documentary|nature
 *   studio:a24
 *   franchise:mcu
 *   certification:r
 *
 * This is the single source of truth for key construction.
 * Both legacy adapters and the Phase 2 backfill script must use this builder.
 */
class ClassificationEvidenceKeyBuilder {
  /**
   * Build a canonical evidence key for a single-value scope.
   * Returns null if scope or value is missing.
   *
   * @param {string} scope  - e.g. 'studio', 'franchise', 'certification'
   * @param {string} value  - the raw value before normalization
   * @returns {string|null}
   */
  buildKey(scope, value) {
    if (!scope || value == null || value === '') return null;
    return `${String(scope).toLowerCase()}:${String(value).toLowerCase()}`;
  }

  /**
   * Build a canonical genre key from a single genre string.
   *
   * @param {string} genre
   * @returns {string|null}
   */
  buildSingleGenreKey(genre) {
    if (!genre) return null;
    return `genre:${String(genre).toLowerCase()}`;
  }

  /**
   * Build a canonical genre key from an array of genre strings.
   * Values are sorted and joined with | to form a stable composite key.
   * Falls back to a single-value key when only one genre is provided.
   *
   * @param {string[]} genres
   * @returns {string|null}
   */
  buildGenreKey(genres) {
    if (!Array.isArray(genres) || genres.length === 0) return null;
    const normalized = genres.map((g) => String(g).toLowerCase()).sort();
    return `genre:${normalized.join('|')}`;
  }

  /**
   * Build a canonical studio evidence key.
   * @param {string} studio
   * @returns {string|null}
   */
  buildStudioKey(studio) {
    return this.buildKey('studio', studio);
  }

  /**
   * Build a canonical franchise evidence key.
   * @param {string} franchise
   * @returns {string|null}
   */
  buildFranchiseKey(franchise) {
    return this.buildKey('franchise', franchise);
  }

  /**
   * Build a canonical certification evidence key.
   * @param {string} certification
   * @returns {string|null}
   */
  buildCertificationKey(certification) {
    return this.buildKey('certification', certification);
  }

  /**
   * Build a key from a scope string and an arbitrary value.
   * Delegates to scope-specific builders for recognized scopes;
   * falls back to the generic buildKey for unknown scopes.
   *
   * Used by the discovered-pattern adapter and the Phase 2 backfill script
   * to avoid each needing its own inline key construction.
   *
   * @param {string} scope
   * @param {string} value
   * @returns {string|null}
   */
  buildForScope(scope, value) {
    switch (String(scope).toLowerCase()) {
      case 'genre':
        return this.buildSingleGenreKey(value);
      case 'studio':
        return this.buildStudioKey(value);
      case 'franchise':
        return this.buildFranchiseKey(value);
      case 'certification':
        return this.buildCertificationKey(value);
      default:
        return this.buildKey(scope, value);
    }
  }
}

module.exports = new ClassificationEvidenceKeyBuilder();
module.exports.ClassificationEvidenceKeyBuilder = ClassificationEvidenceKeyBuilder;
