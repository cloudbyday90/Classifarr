/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
class ClassificationEvidenceKeyBuilder {
  buildKey(scope, value) {
    if (!scope || value == null || value === '') return null;
    return `${String(scope).toLowerCase()}:${String(value).toLowerCase()}`;
  }

  buildSingleGenreKey(genre) {
    if (!genre) return null;
    return `genre:${String(genre).toLowerCase()}`;
  }

  buildGenreKey(genres) {
    if (!Array.isArray(genres) || genres.length === 0) return null;
    const normalized = genres.map((genre) => String(genre).toLowerCase()).sort();
    return `genre:${normalized.join('|')}`;
  }

  buildStudioKey(studio) {
    return this.buildKey('studio', studio);
  }

  buildFranchiseKey(franchise) {
    return this.buildKey('franchise', franchise);
  }

  buildCertificationKey(certification) {
    return this.buildKey('certification', certification);
  }

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

const classificationEvidenceKeyBuilder = new ClassificationEvidenceKeyBuilder();

export default classificationEvidenceKeyBuilder;
export { ClassificationEvidenceKeyBuilder };
