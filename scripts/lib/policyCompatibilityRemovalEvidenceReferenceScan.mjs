/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function collectPolicyCompatibilityRemovalReferenceScan({
  missingRequiredInputs = [],
  cwd,
  executionPlanArtifact,
  resolveExecutionPlanSource,
  scanReferences,
} = {}) {
  if (missingRequiredInputs.length > 0) {
    return null;
  }

  const executionPlanSource = resolveExecutionPlanSource({
    executionPlanArtifact,
  });

  return scanReferences({
    cwd,
    manifestPaths: executionPlanSource.manifestPaths,
  });
}

export {
  collectPolicyCompatibilityRemovalReferenceScan,
};
