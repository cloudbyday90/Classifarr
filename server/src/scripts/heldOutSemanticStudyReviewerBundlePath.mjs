/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { basename, dirname, extname, join } from 'node:path';

/**
 * Derives the content-free study companion from the authorised packet path.
 * The private file boundary independently enforces the `.tmp` containment and
 * rejects an invalid path before anything is written.
 */
export function deriveHeldOutSemanticStudyReviewerBundleFile(packetOutputFile) {
  if (typeof packetOutputFile !== 'string' || !packetOutputFile ||
      extname(packetOutputFile).toLowerCase() !== '.json') {
    return null;
  }
  const extension = extname(packetOutputFile);
  return join(
    dirname(packetOutputFile),
    `${basename(packetOutputFile, extension)}.evaluation-bundle.json`,
  );
}

/** Derives the private scorer input pinned to the same captured cohort. */
export function deriveHeldOutSemanticStudyReviewerScoringInputFile(packetOutputFile) {
  if (typeof packetOutputFile !== 'string' || !packetOutputFile ||
      extname(packetOutputFile).toLowerCase() !== '.json') {
    return null;
  }
  const extension = extname(packetOutputFile);
  return join(
    dirname(packetOutputFile),
    `${basename(packetOutputFile, extension)}.scoring-input.json`,
  );
}

function deriveHeldOutSemanticStudyReviewerTemplateFile(packetOutputFile, reviewerId) {
  if (typeof reviewerId !== 'string' || !['one', 'two'].includes(reviewerId) ||
      typeof packetOutputFile !== 'string' || !packetOutputFile ||
      extname(packetOutputFile).toLowerCase() !== '.json') {
    return null;
  }
  const extension = extname(packetOutputFile);
  return join(
    dirname(packetOutputFile),
    `${basename(packetOutputFile, extension)}.reviewer-${reviewerId}-template.json`,
  );
}

/** Derives an opaque, content-free worksheet for the first independent reviewer. */
export function deriveHeldOutSemanticStudyReviewerOneTemplateFile(packetOutputFile) {
  return deriveHeldOutSemanticStudyReviewerTemplateFile(packetOutputFile, 'one');
}

/** Derives an opaque, content-free worksheet for the second independent reviewer. */
export function deriveHeldOutSemanticStudyReviewerTwoTemplateFile(packetOutputFile) {
  return deriveHeldOutSemanticStudyReviewerTemplateFile(packetOutputFile, 'two');
}
