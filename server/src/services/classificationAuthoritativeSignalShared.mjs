/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function buildAuthoritativeResult({ library, libraries, method, reason }) {
  return {
    relatedEvidence: [],
    result: {
      library,
      confidence: 100,
      method,
      reason,
      libraries,
    },
  };
}

function buildRelatedEvidenceLogPayload(relatedEvidence = []) {
  const topEvidence = [...relatedEvidence].sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))[0];

  return {
    evidenceCount: relatedEvidence.length,
    topLibraryId: topEvidence?.libraryId ?? null,
    topConfidence: topEvidence?.confidence ?? 0,
    topScope: topEvidence?.scope ?? null,
    uniqueScopes: [...new Set(relatedEvidence.map((evidence) => evidence.scope).filter(Boolean))],
  };
}

export async function evaluateAuthoritativeSignals({
  metadata,
  mediaType,
  libraries,
  mediaSyncLibraryStateService,
  contentTypeAnalyzer,
  classificationEvidenceService,
  classificationLearnedCorrectionsService,
  logger,
}) {
  if (metadata.source_library_id) {
    const sourceLibrary = libraries.find((library) => library.id === metadata.source_library_id);
    if (sourceLibrary) {
      logger.info('Using source Plex library for classification', {
        title: metadata.title,
        library: sourceLibrary.name,
      });

      return buildAuthoritativeResult({
        library: sourceLibrary,
        libraries,
        method: 'source_library',
        reason: `Already in library: ${sourceLibrary.name} (from Plex)`,
      });
    }
  }

  const learnedCorrection = await classificationLearnedCorrectionsService.checkLearnedCorrections(
    metadata.tmdb_id,
    metadata.media_type,
  );
  if (learnedCorrection) {
    const correctedLibrary = libraries.find((library) => library.id === learnedCorrection.corrected_library_id);
    if (correctedLibrary) {
      logger.info('Matched learned correction from user', {
        title: metadata.title,
        library: correctedLibrary.name,
        correctedAt: learnedCorrection.created_at,
      });

      return buildAuthoritativeResult({
        library: correctedLibrary,
        libraries,
        method: 'manual_correction',
        reason: `Previously corrected by user: ${learnedCorrection.corrected_by || 'user'}`,
      });
    }
  }

  const existingMedia = await mediaSyncLibraryStateService.findExistingMedia(metadata.tmdb_id, mediaType);
  if (existingMedia) {
    logger.info('Media already exists in library', {
      tmdbId: metadata.tmdb_id,
      library: existingMedia.library_name,
    });

    return buildAuthoritativeResult({
      library: libraries.find((library) => library.id === existingMedia.library_id),
      libraries,
      method: 'existing_media',
      reason: `Already exists in ${existingMedia.library_name}`,
    });
  }

  const contentAnalysis = await contentTypeAnalyzer.analyze(metadata);
  if (contentAnalysis.analyzed && contentAnalysis.bestMatch) {
    logger.info('Content type detected', {
      type: contentAnalysis.bestMatch.type,
      confidence: contentAnalysis.bestMatch.confidence,
    });
    metadata.contentAnalysis = contentAnalysis;
  }

  const exactMatch = await classificationEvidenceService.findExactMatch({
    tmdbId: metadata.tmdb_id,
    mediaType,
  });
  if (exactMatch) {
    return buildAuthoritativeResult({
      library: libraries.find((library) => library.id === exactMatch.libraryId),
      libraries,
      method: 'exact_match',
      reason: 'Previously classified and confirmed',
    });
  }

  const relatedEvidence = await classificationEvidenceService.collectRelatedEvidence({ metadata });
  if (relatedEvidence.length > 0) {
    logger.info('Related evidence collected for PolicyEngine scoring', {
      title: metadata.title,
      ...buildRelatedEvidenceLogPayload(relatedEvidence),
    });
  }

  return { relatedEvidence, result: null };
}
