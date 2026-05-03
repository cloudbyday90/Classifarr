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

class DiscoveredPatternEvidenceAdapter {
  constructor(deps = {}) {
    this._patternSignalCollector = deps.patternSignalCollector || null;
    this._evidenceKeyBuilder = deps.evidenceKeyBuilder || null;
  }

  get patternSignalCollector() {
    if (!this._patternSignalCollector) {
      this._patternSignalCollector = require('./patternSignalCollector.shared');
    }
    return this._patternSignalCollector;
  }

  get evidenceKeyBuilder() {
    if (!this._evidenceKeyBuilder) {
      this._evidenceKeyBuilder = require('./classificationEvidenceKeyBuilder.shared');
    }
    return this._evidenceKeyBuilder;
  }

  async collectRelatedEvidence({ metadata, minConfidence = 0 }) {
    const signals = await this.patternSignalCollector.collectSignals(metadata, minConfidence);
    return signals.map((signal) => ({
      scope: signal.pattern_type,
      libraryId: signal.library?.id || null,
      confidence: signal.confidence ?? 0,
      usageCount: signal.sample_size ?? 0,
      successRate: null,
      evidenceKey: signal.pattern_value ? this.evidenceKeyBuilder.buildForScope(signal.pattern_type, signal.pattern_value) : null,
      evidenceData: {
        patternId: signal.pattern_id,
        patternType: signal.pattern_type,
        patternValue: signal.pattern_value
      },
      provenance: 'mined',
      source: 'discovered_patterns',
      status: signal.status || 'candidate',
      mediaType: metadata?.media_type || metadata?.mediaType || null
    }));
  }
}

const singleton = new DiscoveredPatternEvidenceAdapter();

module.exports = singleton;
module.exports.DiscoveredPatternEvidenceAdapter = DiscoveredPatternEvidenceAdapter;
module.exports.default = singleton;
