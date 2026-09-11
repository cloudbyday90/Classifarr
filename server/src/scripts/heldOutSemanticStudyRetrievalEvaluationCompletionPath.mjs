/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { basename, dirname, extname, join } from 'node:path';

function deriveSiblingJsonFile(filePath, suffix) {
  if (typeof filePath !== 'string' || !filePath || typeof suffix !== 'string' || !suffix ||
      extname(filePath).toLowerCase() !== '.json') {
    return null;
  }
  const extension = extname(filePath);
  return join(dirname(filePath), `${basename(filePath, extension)}.${suffix}.json`);
}

/**
 * Derives every local companion needed to complete an independent-label study
 * from the existing packet and chosen aggregate-results output names. The
 * private file boundary remains the authority for `.tmp` containment.
 */
export function deriveHeldOutSemanticStudyRetrievalEvaluationCompletionPaths({
  packetFile,
  resultsOutputFile,
} = {}) {
  const bundleFile = deriveSiblingJsonFile(packetFile, 'evaluation-bundle');
  const scoringInputFile = deriveSiblingJsonFile(packetFile, 'scoring-input');
  const referenceSetFile = deriveSiblingJsonFile(resultsOutputFile, 'reference-set');
  const scorerSubmissionFile = deriveSiblingJsonFile(resultsOutputFile, 'scorer-submission');
  const representationArtifactFile = deriveSiblingJsonFile(resultsOutputFile, 'representation-artifact');
  if (!bundleFile || !scoringInputFile || !referenceSetFile || !scorerSubmissionFile ||
      !representationArtifactFile || !resultsOutputFile) {
    return null;
  }

  const values = [
    packetFile,
    resultsOutputFile,
    bundleFile,
    scoringInputFile,
    referenceSetFile,
    scorerSubmissionFile,
    representationArtifactFile,
  ];
  if (new Set(values).size !== values.length) return null;

  return Object.freeze({
    bundleFile,
    packetFile,
    referenceSetFile,
    representationArtifactFile,
    resultsOutputFile,
    scorerSubmissionFile,
    scoringInputFile,
  });
}
