/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { patternSignalCollector } from './patternSignalCollector.mjs';
import { classificationEvidenceKeyBuilder } from './classificationEvidenceKeyBuilder.mjs';

class DiscoveredPatternEvidenceAdapter {
  constructor(deps = {}) {
    this.patternSignalCollector = deps.patternSignalCollector || patternSignalCollector;
    this.evidenceKeyBuilder = deps.evidenceKeyBuilder || classificationEvidenceKeyBuilder;
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

const discoveredPatternEvidenceAdapter = new DiscoveredPatternEvidenceAdapter();

export { DiscoveredPatternEvidenceAdapter, discoveredPatternEvidenceAdapter };
